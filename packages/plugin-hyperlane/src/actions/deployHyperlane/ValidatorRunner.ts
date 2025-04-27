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

// Class for running a Validator
export class ValidatorRunner {
  private chainName: string;
  private validatorKey: string;
  private configFilePath: string;
  private validatorSignaturesDir: string;
  private validatorDbPath: string;
  private containerId: string | null = null;

  constructor(chainName: string, validatorKey: string, configFilePath: string) {
    this.chainName = chainName;
    this.validatorKey = validatorKey;
    this.configFilePath = path.resolve(configFilePath);
    
    // Use the cache directory structure for consistency
    const cacheDir = path.join(process.cwd(), 'cache', chainName);
    this.validatorSignaturesDir = path.join(cacheDir, 'validator-signatures');
    this.validatorDbPath = path.join(cacheDir, 'validator-db');

    logger.info({ 
      chain: chainName,
      configPath: this.configFilePath,
      signaturesDir: this.validatorSignaturesDir,
      dbPath: this.validatorDbPath
    }, `Initializing ValidatorRunner for chain: ${chainName}`);

    // Ensure required directories exist
    createDirectory(this.validatorSignaturesDir);
    createDirectory(this.validatorDbPath);
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

      logger.info({ chain: this.chainName }, `Creating container for validator on chain: ${this.chainName}...`);
      
      // Prepare mount paths for the container
      const containerConfigPath = "/configs/agent-config.json";
      
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
              Source: this.validatorDbPath,
              Target: "/hyperlane_db",
              Type: "bind",
            },
            {
              Source: this.validatorSignaturesDir,
              Target: "/tmp/validator-signatures",
              Type: "bind",
            },
          ],
        },
        Cmd: [
          "./validator",
          "--db",
          "/hyperlane_db",
          "--originChainName",
          this.chainName,
          "--checkpointSyncer.type",
          "localStorage",
          "--checkpointSyncer.path",
          "/tmp/validator-signatures",
          "--validator.key",
          this.validatorKey,
        ],
        Tty: true,
      });

      this.containerId = container.id;
      logger.info({ containerId: this.containerId }, `Created container for validator on chain: ${this.chainName}`);

      logger.info({ chain: this.chainName }, `Starting validator for chain: ${this.chainName}...`);
      await container.start();
      logger.info({ chain: this.chainName }, `Validator for chain: ${this.chainName} started successfully.`);

      logger.debug("Fetching container logs...");
      const logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
      });
      logStream.on("data", (chunk) => {
        logger.info(`[Validator ${this.chainName}] ${chunk.toString().trim()}`);
      });

      logger.info({ chain: this.chainName }, "Validator is now running. Monitoring logs...");
    } catch (error) {
      logger.error({ chain: this.chainName, error }, `Error starting validator for chain: ${this.chainName}`);
      throw error;
    }
  }

  async checkStatus(): Promise<void> {
    try {
      logger.info({ chain: this.chainName }, `Checking status of validator for chain: ${this.chainName}`);
      const containers = await docker.listContainers({ all: true });
      const runningContainer = containers.find((c) => c.Id === this.containerId);
      
      if (runningContainer) {
        logger.info({ 
          chain: this.chainName, 
          containerId: this.containerId,
          state: runningContainer.State
        }, `Validator container is running: ${runningContainer.Id}`);
      } else {
        logger.warn({ 
          chain: this.chainName, 
          containerId: this.containerId 
        }, "Validator container is not running.");
      }
    } catch (error) {
      logger.error({ chain: this.chainName, error }, "Error checking container status");
      throw error;
    }
  }
}