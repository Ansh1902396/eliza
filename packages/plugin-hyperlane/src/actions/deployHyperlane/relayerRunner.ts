import Docker from "dockerode";
import path from "path";
import fs from "fs";
import pino from "pino";

import { elizaLogger as logger } from "@elizaos/core";


const docker = new Docker();

// Utility to create directories if they don't exist
const createDirectory = (directoryPath: string): void => {
  if (!fs.existsSync(directoryPath)) {
    logger.info({ path: directoryPath }, `Creating directory: ${directoryPath}`);
    fs.mkdirSync(directoryPath, { recursive: true });
  } else {
    logger.debug({ path: directoryPath }, `Directory already exists: ${directoryPath}`);
  }
};

// Class for running a Relayer
export class RelayerRunner {
  private relayChains: string[];
  private relayerKey: string;
  private configFilePath: string;
  private relayerDbPath: string;
  private validatorSignaturesDir: string;
  private containerId: string | null = null;

  constructor(relayChains: string[], relayerKey: string, configFilePath: string, validatorChainName: string) {
    this.relayChains = relayChains;
    this.relayerKey = relayerKey;
    this.configFilePath = path.resolve(configFilePath);
    
    // Use the cache directory structure for consistency
    const cacheDir = path.join(process.cwd(), 'cache');
    const relayerDir = path.join(cacheDir, 'relayer');
    this.relayerDbPath = path.join(relayerDir, 'db');
    this.validatorSignaturesDir = path.join(cacheDir, validatorChainName, 'validator-signatures');

    logger.info({ 
      chains: relayChains,
      configPath: this.configFilePath,
      dbPath: this.relayerDbPath,
      signaturesDir: this.validatorSignaturesDir
    }, `Initializing RelayerRunner for chains: ${relayChains.join(', ')}`);

    // Ensure required directories exist
    createDirectory(this.relayerDbPath);
  }

  async run(): Promise<void> {
    try {
      logger.info(`Pulling latest Hyperlane agent Docker image...`);
      
      // Pull the Docker image
      await new Promise<void>((resolve, reject) => {
        docker.pull("gcr.io/abacus-labs-dev/hyperlane-agent:agents-v1.1.0", (err: Error | null, stream: any) => {
          if (err) {
            logger.error({ error: err }, "Error pulling Docker image");
            reject(err);
            return;
          }
          
          docker.modem.followProgress(stream, 
            (err: Error | null, output: any[]) => {
              if (err) {
                logger.error({ error: err }, "Error pulling Docker image");
                reject(err);
              } else {
                logger.info("Docker image pulled successfully.");
                resolve();
              }
            },
            (event: any) => {
              logger.debug(event, "Downloading Docker image...");
            }
          );
        });
      });

      logger.info({ chains: this.relayChains }, `Creating container for relayer on chains: ${this.relayChains.join(", ")}...`);
      
      // Prepare mount paths for the container
      const containerConfigPath = "/config/agent-config.json";
      
      const container = await docker.createContainer({
        Image: "gcr.io/abacus-labs-dev/hyperlane-agent:agents-v1.1.0",
        Env: [`CONFIG_FILES=${containerConfigPath}`],
        HostConfig: {
          Mounts: [
            {
              Source: this.configFilePath,
              Target: containerConfigPath,
              Type: "bind",
              ReadOnly: true,
            },
            {
              Source: this.relayerDbPath,
              Target: "/hyperlane_db",
              Type: "bind",
            },
            {
              Source: this.validatorSignaturesDir,
              Target: "/tmp/validator-signatures",
              Type: "bind",
              ReadOnly: true,
            },
          ],
        },
        Cmd: [
          "./relayer",
          "--db",
          "/hyperlane_db",
          "--relayChains",
          this.relayChains.join(","),
          "--allowLocalCheckpointSyncers",
          "true",
          "--defaultSigner.key",
          this.relayerKey,
        ],
        Tty: true,
      });

      this.containerId = container.id;
      logger.info({ containerId: this.containerId }, `Created container for relayer on chains: ${this.relayChains.join(", ")}`);

      logger.info({ chains: this.relayChains }, `Starting relayer for chains: ${this.relayChains.join(", ")}...`);
      await container.start();
      logger.info({ chains: this.relayChains }, `Relayer for chains: ${this.relayChains.join(", ")} started successfully.`);

      logger.debug("Fetching container logs...");
      const logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
      });
      logStream.on("data", (chunk) => {
        logger.info(`[Relayer ${this.relayChains.join(',')}] ${chunk.toString().trim()}`);
      });

      logger.info({ chains: this.relayChains }, "Relayer is now running. Monitoring logs...");
    } catch (error) {
      logger.error({ chains: this.relayChains, error }, `Error starting relayer for chains: ${this.relayChains.join(", ")}`);
      throw error;
    }
  }

  async checkStatus(): Promise<void> {
    try {
      logger.info({ chains: this.relayChains }, `Checking status of relayer for chains: ${this.relayChains.join(", ")}`);
      const containers = await docker.listContainers({ all: true });
      const runningContainer = containers.find((c) => c.Id === this.containerId);
      
      if (runningContainer) {
        logger.info({ 
          chains: this.relayChains, 
          containerId: this.containerId,
          state: runningContainer.State
        }, `Relayer container is running: ${runningContainer.Id}`);
      } else {
        logger.warn({ 
          chains: this.relayChains, 
          containerId: this.containerId 
        }, "Relayer container is not running.");
      }
    } catch (error) {
      logger.error({ chains: this.relayChains, error }, "Error checking container status");
      throw error;
    }
  }
}
