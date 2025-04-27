import type {
    DeployedOwnableConfig,
    IsmConfig,
    WarpRouteDeployConfig,
  } from '@hyperlane-xyz/sdk';
  import { MINIMUM_WARP_DEPLOY_GAS } from './types';
  import {  TokenType } from '@hyperlane-xyz/sdk';
  import { WarpRouteDeployConfigSchema } from '@hyperlane-xyz/sdk';
  import {  writeYamlOrJson } from "../../utils/configOps";
  import { ProtocolType } from '@hyperlane-xyz/utils';
  import type { ChainName } from '@hyperlane-xyz/sdk';
  import { assertSigner } from '../core/utils';
  import { CommandContext , WriteCommandContext } from '../core/context';
  import { DeployParams } from './types';
  import { readWarpRouteDeployConfig , setProxyAdminConfig , createDefaultWarpIsmConfig , writeDeploymentArtifacts , getWarpCoreConfig } from './config';
  import { nativeBalancesAreSufficient , requestAndSaveApiKeys , prepareDeploy ,executeDeploy } from './deploy';
  import path from 'path';
  import os from 'os';
  import fs from 'fs';

// Helper function for retry logic
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 2000,
  operationName = 'Operation'
): Promise<T> {
  let lastError: Error = new Error(`${operationName} failed after ${retries} attempts`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      console.log(`${operationName} failed (attempt ${attempt}/${retries}): ${err.message}`);

      if (attempt < retries) {
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next retry (exponential backoff)
        delay *= 1.5;
      }
    }
  }

  throw lastError;
}

export class WarpDeployerClass{

    private tokenAddress: string;
    private type: TokenType;
    private outPath: string;
    private isNft: boolean = false;

    constructor(
        tokenAddress: string,
        type: TokenType,
        outPath: string = "",
    ) {
        this.tokenAddress = tokenAddress;
        this.type = type;

        // Create default output path if none is provided
        if (!outPath) {
            const configDir = path.join(os.homedir(), ".hyperlane", "warp");
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            this.outPath = path.join(configDir, "warp-route-deploy-config.yaml");
        } else {
            this.outPath = outPath;
        }

        // If token type is NFT, set isNft to true
        this.isNft = type === TokenType.syntheticUri || type === TokenType.collateralUri;
    }

    private async runPreflightChecksForChains({
      chains,
      minGas,
      chainsToGasCheck,
      context
    }: {

      chains: ChainName[];
      minGas: string;
      chainsToGasCheck?: ChainName[];
      context :WriteCommandContext
    }) {
      console.log('Running pre-flight checks for chains...');

      if (!chains?.length) throw new Error('Empty chain selection');

      for (const chain of chains) {
        console.log(`Checking chain: ${chain}`);
        const metadata = context.multiProvider.tryGetChainMetadata(chain);
        if (!metadata) throw new Error(`No chain config found for ${chain}`);
        if (metadata.protocol !== ProtocolType.Ethereum)
          throw new Error(`Only Ethereum chains are supported for now. Chain ${chain} is ${metadata.protocol}`);

        const signer = context.signer;
        assertSigner(signer);
        console.log(`✅ ${metadata.displayName ?? chain} signer is valid`);
      }
      console.log('✅ Chains are valid');

      try {
        await nativeBalancesAreSufficient(
          context,
          context.multiProvider,
          chainsToGasCheck ?? chains,
          minGas,
        );
      } catch (error) {
        console.log(`⚠️ Failed to check balances: ${error.message}`);
        console.log('Continuing deployment, but it may fail due to insufficient funds');
      }
    }


    public async createWarpRouteDeployConfig({
        context,
        chains
    }: {
        context: CommandContext ,
        chains : string[]
    }) {
        console.log('Creating Warp Route deployment configuration...');

        if (!chains || chains.length === 0) {
            throw new Error('No chains specified for Warp Route deployment');
        }

        const result :WarpRouteDeployConfig = {};
        const warpChains = chains;

        for (const chain of warpChains) {
            console.log(`Configuring chain: ${chain}`);

            if (!context.signerAddress) {
                throw new Error('Signer address is required');
            }

            const owner = context.signerAddress;

            // Use retry logic for chain address lookup
            let chainAddress;
            try {
                chainAddress = await withRetry(
                    async () => await context.registry.getChainAddresses(chain),
                    3,
                    2000,
                    `Getting chain addresses for ${chain}`
                );
                console.log(`Chain address for ${chain} is ${JSON.stringify(chainAddress)}`);
            } catch (error) {
                throw new Error(`Failed to get chain addresses for ${chain}: ${error.message}`);
            }

            const mailbox = chainAddress?.mailbox;
            if (!mailbox) {
                throw new Error(`Mailbox address not found for chain ${chain}`);
            }

            let proxyAdmin: DeployedOwnableConfig;
            try {
                proxyAdmin = await setProxyAdminConfig(
                    context,
                    chain,
                    owner,
                    owner
                );
            } catch (error) {
                throw new Error(`Failed to set proxy admin config for ${chain}: ${error.message}`);
            }

            const interchainSecurityModule: IsmConfig = createDefaultWarpIsmConfig(owner);
            const isNft = this.type === TokenType.syntheticUri || this.type === TokenType.collateralUri;

            switch (this.type) {
                case TokenType.collateral:
                case TokenType.XERC20:
                case TokenType.XERC20Lockbox:
                case TokenType.collateralFiat:
                case TokenType.collateralUri:
                case TokenType.fastCollateral:
                  result[chain] = {
                    mailbox,
                    type : this.type,
                    owner,
                    proxyAdmin,
                    isNft,
                    interchainSecurityModule,
                    token: this.tokenAddress,
                  };
                break;
                case TokenType.syntheticRebase:
                    result[chain] = {
                      mailbox,
                      type :this.type,
                      owner,
                      isNft,
                      proxyAdmin,
                      collateralChainName: '', // This will be derived correctly by zod.parse() below
                      interchainSecurityModule,
                    };
                    break;
                    case TokenType.collateralVaultRebase:
                        result[chain] = {
                          mailbox,
                          type:this.type,
                          owner,
                          proxyAdmin,
                          isNft,
                          interchainSecurityModule,
                          token: this.tokenAddress,
                        };
                        break;
                        case TokenType.collateralVault:
                            result[chain] = {
                              mailbox,
                              type: this.type,
                              owner,
                              proxyAdmin,
                              isNft,
                              interchainSecurityModule,
                              token: this.tokenAddress,
                            };
                            break;
                            default:
                                result[chain] = {
                                  mailbox,
                                  type :this.type,
                                  owner,
                                  proxyAdmin,
                                  isNft,
                                  interchainSecurityModule,
                                };
            }
        }

        try {
            console.log('Validating Warp route deployment config...');
            const warpRouteDeployConfig = WarpRouteDeployConfigSchema.parse(result);
            console.log(`Writing config to ${this.outPath}`);
            writeYamlOrJson(this.outPath, warpRouteDeployConfig, 'yaml');
            console.log('✅ Configuration created successfully');
            return warpRouteDeployConfig;
        } catch (e) {
            console.log(
              `Warp route deployment config is invalid, please see https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/cli/examples/warp-route-deployment.yaml for an example.`,
            );
            throw e;
        }
    }

    public async runWarpRouteDeploy({
        context ,
        warpRouteDeployConfigPath,
    }:{
        context:WriteCommandContext,
        warpRouteDeployConfigPath: string,
    }) {
        console.log(`Starting Warp Route deployment with config from ${warpRouteDeployConfigPath}`);

        if (!fs.existsSync(warpRouteDeployConfigPath)) {
            throw new Error(`Config file not found at ${warpRouteDeployConfigPath}`);
        }

        const { chainMetadata, registry } = context;

        let warpRouteConfig;
        try {
            warpRouteConfig = await withRetry(
                () => readWarpRouteDeployConfig(warpRouteDeployConfigPath, context),
                3,
                2000,
                'Reading Warp Route config'
            );
        } catch (error) {
            throw new Error(`Failed to read Warp Route config: ${error.message}`);
        }

        const chains = Object.keys(warpRouteConfig);
        console.log(`Deploying to chains: ${chains.join(', ')}`);

        let apiKeys;
        try {
            apiKeys = await withRetry(
                () => requestAndSaveApiKeys(chains, chainMetadata, registry),
                3,
                2000,
                'Requesting API keys'
            );
        } catch (error) {
            console.log(`⚠️ Failed to get API keys: ${error.message}`);
            console.log('Continuing deployment without API keys, contract verification may fail');
            apiKeys = {};
        }

        const deploymentParams: DeployParams = {
            context,
            warpDeployConfig: warpRouteConfig,
        };

        const ethereumChains = chains.filter(
            (chain) => chainMetadata[chain]?.protocol === ProtocolType.Ethereum,
        );

        if (ethereumChains.length === 0) {
            throw new Error('No Ethereum chains found in configuration');
        }

        console.log(`Running preflight checks for Ethereum chains: ${ethereumChains.join(', ')}`);
        await this.runPreflightChecksForChains({
            context,
            chains: ethereumChains,
            minGas: MINIMUM_WARP_DEPLOY_GAS,
        });

        console.log('Preparing for deployment...');
        let initialBalances;
        try {
            initialBalances = await prepareDeploy(context, null, ethereumChains);
        } catch (error) {
            throw new Error(`Failed to prepare for deployment: ${error.message}`);
        }

        console.log('Executing deployment...');
        let deployedContracts;
        try {
            deployedContracts = await executeDeploy(deploymentParams, apiKeys);
        } catch (error) {
            throw new Error(`Failed to execute deployment: ${error.message}`);
        }

        console.log('Getting Warp Core config...');
        let warpCoreConfig, addWarpRouteOptions;
        try {
            const result = await getWarpCoreConfig(
                deploymentParams,
                deployedContracts,
            );
            warpCoreConfig = result.warpCoreConfig;
            addWarpRouteOptions = result.addWarpRouteOptions;
        } catch (error) {
            throw new Error(`Failed to get Warp Core config: ${error.message}`);
        }

        console.log('Writing deployment artifacts...');
        try {
            await writeDeploymentArtifacts(warpCoreConfig, context, addWarpRouteOptions);
        } catch (error) {
            throw new Error(`Failed to write deployment artifacts: ${error.message}`);
        }

        console.log('✅ Warp Route deployment completed successfully');
    }
}

