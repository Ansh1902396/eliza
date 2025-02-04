import type {
    ChainMap,
    ChainMetadata,
    DeployedOwnableConfig,
    IsmConfig,
    WarpCoreConfig,
    WarpRouteDeployConfig,
} from "@hyperlane-xyz/sdk";
import { TokenFactories } from "@hyperlane-xyz/sdk";

import type { IRegistry } from "@hyperlane-xyz/registry";
import { AddWarpRouteOptions } from "@hyperlane-xyz/registry";
import type { ChainName } from "@hyperlane-xyz/sdk";
import {
    HypERC20Deployer,
    HyperlaneContractsMap,
    MultiProvider,
    TokenType,
    WarpRouteDeployConfigSchema,
} from "@hyperlane-xyz/sdk";
import type { Address } from "@hyperlane-xyz/utils";
import { ProtocolType } from "@hyperlane-xyz/utils";
import { BigNumber, ethers } from "ethers";
import { writeYamlOrJson } from "../../utils/configOps";
import { CommandContext, WriteCommandContext } from "../core/context";
import { runPreflightChecksForChains } from "../core/utils";
import {
    createDefaultWarpIsmConfig,
    fullyConnectTokens,
    generateTokenConfigs,
    readWarpRouteDeployConfig,
    setProxyAdminConfig,
} from "./config";
import { executeDeploy, writeDeploymentArtifacts } from "./deploy";
import { DeployParams, MINIMUM_WARP_DEPLOY_GAS } from "./types";

async function getWarpCoreConfig(
    { warpDeployConfig, context }: DeployParams,
    contracts: HyperlaneContractsMap<TokenFactories>
): Promise<{
    warpCoreConfig: WarpCoreConfig;
    addWarpRouteOptions?: AddWarpRouteOptions;
}> {
    const warpCoreConfig: WarpCoreConfig = { tokens: [] };

    // TODO: replace with warp read
    const tokenMetadata = await HypERC20Deployer.deriveTokenMetadata(
        context.multiProvider,
        warpDeployConfig
    );
    //@ts-ignore

    const { decimals, symbol, name } = tokenMetadata;

    generateTokenConfigs(
        warpCoreConfig,
        warpDeployConfig,
        contracts,
        symbol,
        name,
        decimals
    );

    fullyConnectTokens(warpCoreConfig);

    return { warpCoreConfig, addWarpRouteOptions: { symbol } };
}

export async function requestAndSaveApiKeys(
    chains: ChainName[],
    chainMetadata: ChainMap<ChainMetadata>,
    registry: IRegistry
): Promise<ChainMap<string>> {
    const apiKeys: ChainMap<string> = {};

    for (const chain of chains) {
        if (chainMetadata[chain]?.blockExplorers?.[0]?.apiKey) {
            apiKeys[chain] = chainMetadata[chain]!.blockExplorers![0]!.apiKey!;
            continue;
        }

        chainMetadata[chain].blockExplorers![0].apiKey = apiKeys[chain];
        await registry.updateChain({
            chainName: chain,
            metadata: chainMetadata[chain],
        });
    }

    return apiKeys;
}

export async function prepareDeploy(
    context: WriteCommandContext,
    userAddress: Address | null,
    chains: ChainName[]
): Promise<Record<string, BigNumber>> {
    const { multiProvider, isDryRun } = context;
    const initialBalances: Record<string, BigNumber> = {};
    await Promise.all(
        chains.map(async (chain: ChainName) => {
            const provider = multiProvider.getProvider(chain);
            const address =
                userAddress ??
                (await multiProvider.getSigner(chain).getAddress());
            const currentBalance = await provider.getBalance(address);
            initialBalances[chain] = currentBalance;
        })
    );
    return initialBalances;
}

export async function nativeBalancesAreSufficient(
    multiProvider: MultiProvider,
    chains: ChainName[],
    minGas: string
) {
    const sufficientBalances: boolean[] = [];
    for (const chain of chains) {
        // Only Ethereum chains are supported
        if (multiProvider.getProtocol(chain) !== ProtocolType.Ethereum) {
            console.log(`Skipping balance check for non-EVM chain: ${chain}`);
            continue;
        }
        const address = multiProvider.getSigner(chain).getAddress();
        const provider = multiProvider.getProvider(chain);
        const gasPrice = await provider.getGasPrice();
        const minBalanceWei = gasPrice.mul(minGas).toString();
        const minBalance = ethers.utils.formatEther(minBalanceWei.toString());

        const balanceWei = await multiProvider
            .getProvider(chain)
            .getBalance(address);
        const balance = ethers.utils.formatEther(balanceWei.toString());
        if (balanceWei.lt(minBalanceWei)) {
            const symbol =
                multiProvider.getChainMetadata(chain).nativeToken?.symbol ??
                "ETH";
            console.log(
                `WARNING: ${address} has low balance on ${chain}. At least ${minBalance} ${symbol} recommended but found ${balance} ${symbol}`
            );
            sufficientBalances.push(false);
        }
    }
    const allSufficient = sufficientBalances.every((sufficient) => sufficient);

    if (allSufficient) {
        console.log("✅ Balances are sufficient");
    } else {
        console.log(`Deployment may fail due to insufficient balance(s)`);
    }
}

export class WarpDeployerClass {
    private tokenAddress: string;
    private type: TokenType;
    private outPath: string;

    constructor(tokenAddress: string, type: TokenType, outPath: string) {
        this.tokenAddress = tokenAddress;
        this.type = type;
        this.outPath = outPath;
    }

    private async createWarpRouteDeployConfig({
        context,
    }: {
        context: CommandContext;
        outPath: string;
    }) {
        const result: WarpRouteDeployConfig = {};

        const chain = context.chainMetadata[0].name;

        if (!context.signerAddress) {
            throw new Error("Signer address is required");
        }
        const owner = context.signerAddress;

        const chainAddress = await context.registry.getChainAddresses(chain);

        const mailbox = chainAddress?.mailbox;
        if (!mailbox) {
            throw new Error(`Mailbox address not found for chain ${chain}`);
        }

        const proxyAdmin: DeployedOwnableConfig = await setProxyAdminConfig(
            context,
            chain,
            owner,
            owner
        );

        const interchainSecurityModule: IsmConfig =
            createDefaultWarpIsmConfig(owner);

        const isNft =
            this.type === TokenType.syntheticUri ||
            this.type === TokenType.collateralUri;

        switch (this.type) {
            case TokenType.collateral:
            case TokenType.XERC20:
            case TokenType.XERC20Lockbox:
            case TokenType.collateralFiat:
            case TokenType.collateralUri:
            case TokenType.fastCollateral:
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
            case TokenType.syntheticRebase:
                result[chain] = {
                    mailbox,
                    type: this.type,
                    owner,
                    isNft,
                    proxyAdmin,
                    collateralChainName: "", // This will be derived correctly by zod.parse() below
                    interchainSecurityModule,
                };
                break;
            case TokenType.collateralVaultRebase:
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
                    type: this.type,
                    owner,
                    proxyAdmin,
                    isNft,
                    interchainSecurityModule,
                };

                try {
                    const warpRouteDeployConfig =
                        WarpRouteDeployConfigSchema.parse(result);
                    writeYamlOrJson(
                        this.outPath,
                        warpRouteDeployConfig,
                        "yaml"
                    );
                } catch (e) {
                    console.log(
                        `Warp route deployment config is invalid, please see https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/cli/examples/warp-route-deployment.yaml for an example.`
                    );
                    throw e;
                }
        }
    }

    public async runWarpRouteDeploy({
        context,
        warpRouteDeployConfigPath,
    }: {
        context: WriteCommandContext;
        warpRouteDeployConfigPath: string;
    }) {
        const { chainMetadata, registry } = context;

        const warpRouteConfig = await readWarpRouteDeployConfig(
            warpRouteDeployConfigPath,
            context
        );

        const chains = Object.keys(warpRouteConfig);

        const apiKeys = await requestAndSaveApiKeys(
            chains,
            chainMetadata,
            registry
        );

        const deploymentParams: DeployParams = {
            context,
            warpDeployConfig: warpRouteConfig,
        };

        const ethereumChains = chains.filter(
            (chain) => chainMetadata[chain].protocol === ProtocolType.Ethereum
        );
        await runPreflightChecksForChains({
            context,
            chains: ethereumChains,
            minGas: MINIMUM_WARP_DEPLOY_GAS,
        });

        const initialBalances = await prepareDeploy(
            context,
            null,
            ethereumChains
        );
        const deployedContracts = await executeDeploy(
            deploymentParams,
            apiKeys
        );

        const { warpCoreConfig, addWarpRouteOptions } = await getWarpCoreConfig(
            deploymentParams,
            deployedContracts
        );

        await writeDeploymentArtifacts(
            warpCoreConfig,
            context,
            addWarpRouteOptions
        );
    }
}