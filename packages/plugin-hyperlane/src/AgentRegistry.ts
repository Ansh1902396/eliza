import { BaseRegistry, IRegistry, RegistryType,RegistryContent , AddWarpRouteOptions , GithubRegistry, ChainAddresses  } from "@hyperlane-xyz/registry";
import { MaybePromise, WarpRouteConfigMap, WarpRouteId } from './types';


import { promises as fs } from 'fs';
import type {
    ChainMap,
    ChainMetadata,
    ChainName,
    WarpCoreConfig,
  } from '@hyperlane-xyz/sdk';
import pino from "pino";
import path from "path";
import { Chain } from "viem";
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';


export interface UpdateChainParams {
    chainName: ChainName;
    metadata?: ChainMetadata;
    addresses?: ChainAddresses;
}


export interface WarpRouteFilterParams {
    symbol?: string;
    chainName?: ChainName;
}


export class AgentRegistry extends BaseRegistry implements IRegistry {
    readonly type = RegistryType.FileSystem;
    private registryData: RegistryContent;


      /** Path on the local filesystem to store our JSON file. */
    private localRootDir: string;

    private githubRegistry: GithubRegistry;
    private isInitialized ;

    constructor({
        uri,
        localRootDir,
        logger,
        githubRegistry,
      }: {
        uri: string;
        localRootDir: string;
        logger?: pino.Logger<string , boolean>;
        githubRegistry: GithubRegistry;
      })  {
        super({ uri });


        this.githubRegistry = githubRegistry;
        this.localRootDir = localRootDir;
        this.isInitialized = false;
        this.registryData = {
            chains: {},
            deployments: {
                warpRoutes: {},
                warpDeployConfig: {},
            },
        };
      }








      public async init(): Promise<void> {
        // Ensure chains/ and warp-routes/ subfolders exist
        await fs.mkdir(this.getChainsDir(), { recursive: true });
        await fs.mkdir(this.getWarpRoutesDir(), { recursive: true });

        // If you want to only fetch from GitHub if local is empty:
        const chainFolders = await fs.readdir(this.getChainsDir());
        if (chainFolders.length === 0 && this.githubRegistry) {
          // Pull chain list from GitHub
          const githubChainNames = await this.githubRegistry.getChains();
          for (const chainName of githubChainNames) {
            // load metadata + addresses from GitHub
            const [metadata, addresses] = await Promise.all([
              this.githubRegistry.getChainMetadata(chainName),
              this.githubRegistry.getChainAddresses(chainName),
            ]);
            if (!metadata && !addresses) continue; // skip empty chain

            // Save them locally
            await this.saveChain(chainName, metadata, addresses);
          }

          // Warp routes
          const warpRoutes = await this.githubRegistry.getWarpRoutes();
          for (const [routeId, routeConfig] of Object.entries(warpRoutes)) {
            await this.saveWarpRoute(routeId, routeConfig);
          }
        }

        this.isInitialized = true;
      }


      private async saveChain(
        chainName: ChainName,
        metadata?: ChainMetadata | null,
        addresses?: ChainAddresses | null
      ) {
        const chainDir = this.getChainsDir();
        await fs.mkdir(chainDir, { recursive: true });

        if (metadata) {
          const metadataPath = path.join(chainDir, 'metadata.yaml');
          await fs.writeFile(metadataPath, stringifyYaml(metadata), 'utf8');
        }
        if (addresses) {
          const addressesPath = path.join(chainDir, 'addresses.yaml');
          await fs.writeFile(addressesPath, stringifyYaml(addresses), 'utf8');
        }
      }

      private getWarpRoutesDir(): string {
        return path.join(this.localRootDir, 'warp-routes');
      }

      private async saveWarpRoute(routeId: string, config: WarpCoreConfig) {
        const routePath = path.join(this.getWarpRoutesDir(), `${routeId}.yaml`);
        await fs.writeFile(routePath, stringifyYaml(config), 'utf8');
      }


      private async loadAllWarpRoutes(): Promise<WarpRouteConfigMap> {
        const routeDir = this.getWarpRoutesDir();
        const files = await fs.readdir(routeDir);
        const result: WarpRouteConfigMap = {};
        for (const filename of files) {
          if (!filename.endsWith('.yaml')) continue;
          const routeId = path.basename(filename, '.yaml');
          const config = await this.loadWarpRoute(routeId);
          if (config) {
            result[routeId] = config;
          }
        }
        return result;
      }

      private async loadWarpRoute(routeId: string): Promise<WarpCoreConfig | null> {
        const routePath = path.join(this.getWarpRoutesDir(), `${routeId}.yaml`);
        try {
          const raw = await fs.readFile(routePath, 'utf8');
          return parseYaml(raw) as WarpCoreConfig;
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw err;
        }
      }

      private getChainsDir(): string {
        return path.join(this.localRootDir, 'chains');
      }


      private getChainDir(chainName: ChainName): string {
        return path.join(this.getChainsDir(), chainName);
      }

      private async loadChainMetadata(chainName: ChainName): Promise<ChainMetadata | null> {
        const metadataPath = path.join(this.getChainDir(chainName), 'metadata.yaml');
        try {
          const raw = await fs.readFile(metadataPath, 'utf8');
          return parseYaml(raw) as ChainMetadata;
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw err;
        }
      }


      private async saveLocalFile() {
        try {
          // Make sure the directory exists
          const dirname = path.dirname(this.localRootDir);
          this.logger.debug(`Ensuring directory exists: ${dirname}`);
          await fs.mkdir(dirname, { recursive: true });

          // Write the file
          this.logger.debug(`Writing registry data to: ${this.localRootDir}`);
          await fs.writeFile(
              this.localRootDir,
              JSON.stringify(this.registryData, null, 2),
              'utf-8'
          );

          this.logger.info(`Saved local registry file to ${this.localRootDir}`);
        } catch (error) {
          this.logger.error({ error }, `Failed to save local registry file to ${this.localRootDir}`);
          throw new Error(`Failed to save local registry file: ${error.message}`);
        }
      }


      private async loadLocalFile(): Promise<boolean> {
        try{
             const contents = await fs.readFile(this.localRootDir , 'utf-8');

             const json = JSON.parse(contents) as RegistryContent;

             this.registryData = json;

             return true ;
        }catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }

            throw err;
        }
      }

      private ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('Registry not initialized');
        }
      }


       /* ------------------------
   * Implementation of IRegistry
   * ------------------------ */
       public async listRegistryContent(): Promise<RegistryContent> {
        this.ensureInitialized();
        const chainNames = await this.getChains();
        const warpRoutes = await this.loadAllWarpRoutes();

        // Each chain references a set of files:
        const chains: RegistryContent['chains'] = {};
        for (const chainName of chainNames) {
          // We'll store the *paths* to these local files, if you want.
          // But if you prefer to store them as strings or ignore them, adjust as needed.
          const chainDir = this.getChainDir(chainName);
          chains[chainName] = {
            metadata: path.join(chainDir, 'metadata.yaml'),
            addresses: path.join(chainDir, 'addresses.yaml'),
            // no explicit 'logo' in this example, but you could do so
          };
        }

        return {
          chains,
          deployments: {
            warpRoutes: Object.fromEntries(
              Object.keys(warpRoutes).map((id) => [
                id,
                path.join(this.getWarpRoutesDir(), `${id}.yaml`),
              ])
            ),
            warpDeployConfig: {},
          },
        };
      }


      public async getChainMetadata(chainName: ChainName): Promise<ChainMetadata | null> {
        this.ensureInitialized();
        return this.loadChainMetadata(chainName);
      }

      private async loadChainAddresses(chainName: ChainName): Promise<ChainAddresses | null> {
        const addressesPath = path.join(this.getChainDir(chainName), 'addresses.yaml');
        try {
          const raw = await fs.readFile(addressesPath, 'utf8');
          return parseYaml(raw) as ChainAddresses;
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw err;
        }
      }

      public async getChains(): Promise<ChainName[]> {
        this.ensureInitialized();
        const chainFolders = await fs.readdir(this.getChainsDir());
        // Filter out anything that's not a directory
        const result: ChainName[] = [];
        for (const folder of chainFolders) {
          const fullPath = path.join(this.getChainsDir(), folder);
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            result.push(folder as ChainName);
          }
        }
        return result;
      }

      public async getMetadata(): Promise<ChainMap<ChainMetadata>> {
        this.ensureInitialized();
        const chainNames = await this.getChains();
        const result: ChainMap<ChainMetadata> = {};
        for (const chainName of chainNames) {
          const metadata = await this.loadChainMetadata(chainName);
          if (metadata) result[chainName] = metadata;
        }
        return result;
      }


      public async getAddresses(): Promise<ChainMap<ChainAddresses>> {
        this.ensureInitialized();

        const result: ChainMap<ChainAddresses> = {};

        for (const [chainName, chainData] of Object.entries(this.registryData.chains)) {
            if (chainData.addresses) {
                result[chainName] = JSON.parse(chainData.addresses);
            }
        }

        return result;
      }


      public async getChainAddresses(chainName: ChainName): Promise<ChainAddresses | null> {
        this.ensureInitialized();
        return this.loadChainAddresses(chainName);
      }


      public async addChain(params: UpdateChainParams): Promise<void> {
        this.ensureInitialized();

        const chainNames = await this.getChains();
        if (chainNames.includes(params.chainName)) {
          throw new Error(`Chain ${params.chainName} already exists.`);
        }

        await this.saveChain(params.chainName, params.metadata ?? null, params.addresses ?? null);
      }



       public async updateChain(params: UpdateChainParams): Promise<void> {
        this.ensureInitialized();
        const chainNames = await this.getChains();
        if (!chainNames.includes(params.chainName)) {
          throw new Error(`Chain ${params.chainName} does not exist.`);
        }
        // Overwrite existing chain files
        await this.saveChain(params.chainName, params.metadata ?? null, params.addresses ?? null);
      }


       public async removeChain(chain: ChainName): Promise<void> {
        this.ensureInitialized();
        const chainDir = this.getChainDir(chain);
        try {
          const stat = await fs.stat(chainDir);
          if (stat.isDirectory()) {
            // remove entire chain folder
            // CAUTION: This recursively deletes everything in that folder
            // If you only want to remove metadata/addresses but keep the folder, do so carefully
            await fs.rm(chainDir, { recursive: true, force: true });
          }
        } catch (err) {
          throw new Error(`Chain ${chain} does not exist or cannot be removed. ${err}`);
        }
      }
      public async getWarpRoute(routeId: string): Promise<WarpCoreConfig | null> {
        this.ensureInitialized();
        return this.loadWarpRoute(routeId);
      }


      public async getWarpRoutes(filter?: WarpRouteFilterParams): Promise<WarpRouteConfigMap> {
        this.ensureInitialized();
        const all = await this.loadAllWarpRoutes();
        const result: WarpRouteConfigMap = {};
        for (const [id, config] of Object.entries(all)) {
          if (filter) {
            const symbolFilter = filter.symbol && config.tokens?.includes(filter.symbol);
            const chainFilter =
              filter.chainName &&
              (config.source === filter.chainName || config.destination === filter.chainName);

            const passes =
              filter.symbol && filter.chainName
                ? symbolFilter && chainFilter
                : filter.symbol
                ? symbolFilter
                : filter.chainName
                ? chainFilter
                : true;
            if (!passes) continue;
          }
          result[id] = config;
        }
        return result;
      }


      public async addWarpRoute(
        config: WarpCoreConfig,
        _options?: AddWarpRouteOptions
      ): Promise<void> {
        this.ensureInitialized();
        const routeId = config.tokens.join('-');
        const existing = await this.getWarpRoute(routeId);
        if (existing) {
          throw new Error(`Warp route with ID '${routeId}' already exists.`);
        }
        await this.saveWarpRoute(routeId, config);
      }

      public async getWarpDeployConfig(deployId: string): Promise<any | null> {
        // Provide a real implementation or remove from BaseRegistry if not needed.
        // For now, just a stub returning null.
        return null;
      }

      public async getWarpDeployConfigs(): Promise<Record<string, any>> {
        // Provide a real implementation or remove from BaseRegistry if not needed.
        // For now, just returning an empty object.
        return {};
      }

}