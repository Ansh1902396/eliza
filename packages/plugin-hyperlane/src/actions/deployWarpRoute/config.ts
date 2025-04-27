import { ProxyAdmin__factory } from "@hyperlane-xyz/core";
import  {
    HyperlaneContractsMap,
    IsmConfig,
    TokenFactories,
    WarpCoreConfig,
    WarpRouteDeployConfig,
    HypERC20Deployer
} from "@hyperlane-xyz/sdk";
import {
    DeployedOwnableConfig,
    getTokenConnectionId,
    isCollateralTokenConfig,
    IsmType,
    TOKEN_TYPE_TO_STANDARD,
    WarpRouteDeployConfigSchema,
} from "@hyperlane-xyz/sdk";
import type { Address } from "@hyperlane-xyz/utils";
import { ProtocolType } from "@hyperlane-xyz/utils";
import { readYamlOrJson } from "../../utils/configOps";
import { CommandContext } from "../core/context";
import { DeployParams } from "./types";
import { AddWarpRouteOptions } from "@hyperlane-xyz/registry";
import { WriteCommandContext } from "../core/context";

export async function readWarpRouteDeployConfig(
    filePath: string,
    context?: CommandContext,
  ): Promise<WarpRouteDeployConfig> {
    try {
      console.log(`Reading warp route deploy config from ${filePath}`);
      let config = readYamlOrJson(filePath);
      if (!config) {
        throw new Error(`No warp route deploy config found at ${filePath}`);
      }

      return WarpRouteDeployConfigSchema.parse(config);
    } catch (error) {
      if (error.name === 'ZodError') {
        console.error('Config validation failed with the following errors:');
        console.error(JSON.stringify(error.errors, null, 2));
      }
      throw new Error(`Failed to read warp route deploy config: ${error.message}`);
    }
  }

export async function setProxyAdminConfig(
    context: CommandContext,
    chain: string,
    proxyAdminOwner: string,
    warpRouteOwner : Address
  ): Promise<DeployedOwnableConfig> {
    const defaultAdminConfig: DeployedOwnableConfig = {
        owner : warpRouteOwner ,
    }


    const provider = context.multiProvider.getProvider(chain);

    // console.log(provider)

    const proxy = ProxyAdmin__factory.connect(proxyAdminOwner, provider);


    return defaultAdminConfig


  }

export function createDefaultWarpIsmConfig(owner: Address): IsmConfig {
    return {
        type: IsmType.AGGREGATION,
        modules: [
            {
                type: IsmType.TRUSTED_RELAYER,
                relayer: owner,
            },
        ],
        threshold: 1,
    };
}

export function generateTokenConfigs(
    warpCoreConfig: WarpCoreConfig,
    warpDeployConfig: WarpRouteDeployConfig,
    contracts: HyperlaneContractsMap<TokenFactories>,
    symbol: string,
    name: string,
    decimals: number,
  ): void {
    for (const [chainName, contract] of Object.entries(contracts)) {
      const config = warpDeployConfig[chainName];
      const collateralAddressOrDenom = isCollateralTokenConfig(config)
        ? config.token // gets set in the above deriveTokenMetadata()
        : undefined;

      warpCoreConfig.tokens.push({
        chainName,
        standard: TOKEN_TYPE_TO_STANDARD[config.type],
        decimals,
        symbol: config.symbol || symbol,
        name,
        addressOrDenom:
          contract[warpDeployConfig[chainName].type as keyof TokenFactories]
            .address,
        collateralAddressOrDenom,
      });
    }
  }


 export function fullyConnectTokens(warpCoreConfig: WarpCoreConfig): void {
    for (const token1 of warpCoreConfig.tokens) {
      for (const token2 of warpCoreConfig.tokens) {
        if (
          token1.chainName === token2.chainName &&
          token1.addressOrDenom === token2.addressOrDenom
        )
          continue;
        token1.connections ||= [];
        token1.connections.push({
          token: getTokenConnectionId(
            ProtocolType.Ethereum,
            token2.chainName,
            token2.addressOrDenom!,
          ),
        });
      }
    }
  }


  export async function getWarpCoreConfig(
      { warpDeployConfig, context }: DeployParams,
      contracts: HyperlaneContractsMap<TokenFactories>,
    ): Promise<{
      warpCoreConfig: WarpCoreConfig;
      addWarpRouteOptions?: AddWarpRouteOptions;
    }> {
      const warpCoreConfig: WarpCoreConfig = { tokens: [] };

      // TODO: replace with warp read
      const tokenMetadata = await HypERC20Deployer.deriveTokenMetadata(
        context.multiProvider,
        warpDeployConfig,
      );
      //@ts-ignore

      const { decimals, symbol, name } = tokenMetadata;

      generateTokenConfigs(
        warpCoreConfig,
        warpDeployConfig,
        contracts,
        symbol,
        name,
        decimals,
      );

      fullyConnectTokens(warpCoreConfig);

      return { warpCoreConfig, addWarpRouteOptions: { symbol } };
    }


   export  async function writeDeploymentArtifacts(
      warpCoreConfig: WarpCoreConfig,
      context: WriteCommandContext,
      addWarpRouteOptions?: AddWarpRouteOptions,
    ) {
      if (!context.isDryRun) {
        try {
          console.log('Writing deployment artifacts to registry...');
          await context.registry.addWarpRoute(warpCoreConfig, addWarpRouteOptions);
          console.log('✅ Successfully wrote deployment artifacts');
        } catch (error) {
          console.error(`Failed to write deployment artifacts: ${error.message}`);
          throw error;
        }
      } else {
        console.log('Skipping writing deployment artifacts (dry run)');
      }
    }

