import {
    AgentConfig,
    AgentConfigSchema,
    ChainMap,
    ChainName,
    HookType,
    HyperlaneRelayer,
    MultiProvider,
    HyperlaneCore,
    ChainMetadata,
    IsmConfig,
    HookConfig,
    IsmType,
    EthJsonRpcBlockParameterTag
} from "@hyperlane-xyz/sdk";
import { MultisigIsmConfig , MultisigIsmConfigSchema } from "@hyperlane-xyz/sdk";
import { Address } from "@hyperlane-xyz/utils";
import { BigNumber } from "ethers";
import { ProtocolType } from "@hyperlane-xyz/utils";
import { ethers } from "ethers";
import { WriteCommandContext } from "./context";
import { ChainAddresses , chainMetadata, IRegistry ,GithubRegistry } from "@hyperlane-xyz/registry";
import { promiseObjAll , objMap } from "@hyperlane-xyz/utils";
import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { CoreConfig } from "@hyperlane-xyz/sdk";
import { readYamlOrJson } from "../../utils/configOps";
import { CoreConfigSchema } from "@hyperlane-xyz/sdk";
import { ExplorerFamily } from "@hyperlane-xyz/sdk";
/**
 * Verifies the specified signer is valid.
 * @param signer the signer to verify
 */
export function assertSigner(signer: ethers.Signer) {
    if (!signer || !ethers.Signer.isSigner(signer))
        throw new Error("Signer is invalid");
}

export function filterAddresses(
    addresses : ChainMap<ChainAddresses> ,
    chains ?: string[]
) {
    if (!chains) {
         return addresses
    }
}



export function validateAgentConfig(
    agentConfig : AgentConfig
) {
    const result = AgentConfigSchema.safeParse(agentConfig)

    if (!result.success) {
        const errorMessage = (result.error).toString();
        console.warn(
          `\nAgent config is invalid, this is possibly due to required contracts not being deployed. See details below:\n${errorMessage}`,
        );

      } else {
        console.log('✅ Agent config successfully created');
      }
}

export async function getStartBlocks(
    chainAddresses: ChainMap<ChainAddresses>,
    core: HyperlaneCore,
    chainMetadata: any,
  ): Promise<ChainMap<number | undefined>> {
    return promiseObjAll(
      objMap(chainAddresses, async (chain, _) => {
        const indexFrom = chainMetadata[chain].index?.from;
        if (indexFrom !== undefined) {
          return indexFrom;
        }

        const mailbox = core.getContracts(chain).mailbox;
        try {
          const deployedBlock = await mailbox.deployedBlock();
          return deployedBlock.toNumber();
        } catch {
          console.log(
            `❌ Failed to get deployed block to set an index for ${chain}, this is potentially an issue with rpc provider or a misconfiguration`,
          );
          return undefined;
        }
      }),
    );
  }

  function transformChainMetadataForDisplay(chainMetadata: ChainMetadata) {
    return {
      Name: chainMetadata.name,
      'Display Name': chainMetadata.displayName,
      'Chain ID': chainMetadata.chainId,
      'Domain ID': chainMetadata.domainId,
      Protocol: chainMetadata.protocol,
      'JSON RPC URL': chainMetadata.rpcUrls[0].http,
      'Native Token: Symbol': chainMetadata.nativeToken?.symbol,
      'Native Token: Name': chainMetadata.nativeToken?.name,
      'Native Token: Decimals': chainMetadata.nativeToken?.decimals,
    };
  }







export async function nativeBalancesAreSufficient(
    multiProvider: MultiProvider,
    chains: ChainName[],
    minGas: string,
    skipConfirmation: boolean
) {
    const sufficientBalances: boolean[] = [];
    for (const chain of chains) {
        // Only Ethereum chains are supported
        if (multiProvider.getProtocol(chain) !== ProtocolType.Ethereum) {
            // logGray(`Skipping balance check for non-EVM chain: ${chain}`);
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
            sufficientBalances.push(false);
        }
    }
    const allSufficient = sufficientBalances.every((sufficient) => sufficient);

    if (allSufficient) {
        //   logGreen('✅ Balances are sufficient');
        return true;
    } else {
        return false;
    }
}

export async function runPreflightChecksForChains({
    context,
    chains,
    minGas,
    chainsToGasCheck,
}: {
    context: WriteCommandContext;
    chains: ChainName[];
    minGas: string;
    // Chains for which to assert a native balance
    // Defaults to all chains if not specified
    chainsToGasCheck?: ChainName[];
}) {
    // log('Running pre-flight checks for chains...');
    const { multiProvider, skipConfirmation } = context;

    if (!chains?.length) throw new Error("Empty chain selection");
    for (const chain of chains) {
        const metadata = multiProvider.tryGetChainMetadata(chain);
        if (!metadata) throw new Error(`No chain config found for ${chain}`);
        if (metadata.protocol !== ProtocolType.Ethereum)
            throw new Error("Only Ethereum chains are supported for now");
        const signer = multiProvider.getSigner(chain);
        assertSigner(signer);
        //   logGreen(`✅ ${metadata.displayName ?? chain} signer is valid`);
    }
    // logGreen('✅ Chains are valid');

    await nativeBalancesAreSufficient(
        multiProvider,
        chainsToGasCheck ?? chains,
        minGas,
        skipConfirmation
    );
}

export function stubMerkleTreeConfig(
    relayer: HyperlaneRelayer,
    chain: string,
    hookAddress: string,
    merkleAddress: string
) {
    relayer.hydrate({
        hook: {
            [chain]: {
                [hookAddress]: {
                    type: HookType.MERKLE_TREE,
                    address: merkleAddress,
                },
            },
        },
        ism: {},
        backlog: [],
    });
}


export async function requestAndSaveApiKeys(
    chains: ChainName[],
    chainMetadata: ChainMap<ChainMetadata>,
    registry: IRegistry,
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


  export function callWithConfigCreationLogs<T extends IsmConfig | HookConfig>(
    fn: (...args: any[]) => Promise<T>,
    type: IsmType | HookType,
  ) {
    return async (...args: any[]): Promise<T> => {
      console.log(`Creating ${type}...`);
      try {
        const result = await fn(...args);
        return result;
      } finally {
        console.log(`Created ${type}!`);
      }
    };
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


  export async function completeDeploy(
    context : WriteCommandContext,
    initialBalances : Record<string, BigNumber>,
    userAddress : Address | null,
    chains : ChainName[],
  ) {
    const { multiProvider, isDryRun } = context;
    if (chains.length > 0) console.log(`⛽️ Gas Usage Statistics`);

    for (const chain of chains) {
        const provider = multiProvider.getProvider(chain);
        const address =
          userAddress ?? (await multiProvider.getSigner(chain).getAddress());
        const currentBalance = await provider.getBalance(address);
        const balanceDelta = initialBalances[chain].sub(currentBalance);

      }
  }

 export  async function confirmExistingMailbox(context: WriteCommandContext , chain: ChainName) {
    const registry = new GithubRegistry()
    const addresses = await registry.getChainAddresses(chain);

    if (addresses?.mailbox) {
        elizaLogger.error("Mailbox already exists at address " + addresses.mailbox)
      }

  }

  export async function runDeployPlanStep({
    context ,
    chain ,
  }: {
    context : WriteCommandContext,
    chain : ChainName
   }) {

    const {
        chainMetadata: chainMetadataMap,
        multiProvider,
        skipConfirmation,
      } = context;

      const address = await multiProvider.getSigner(chain).getAddress();
      const transformChainMetadata = transformChainMetadataForDisplay(
        chainMetadataMap[chain]
      )

      elizaLogger.log('\nDeployment plan');
      elizaLogger.log('===============');
      elizaLogger.log(`Transaction signer and owner of new contracts: ${address}`);
      elizaLogger.log(`Deploying core contracts to network: ${chain}`);

      await confirmExistingMailbox(context , chain)


  }


export async function handleMissingInterchainGasPaymaster (
    chainAddresses : ChainMap<ChainAddresses>,
) {
    for (const [chain , addressRecord] of Object.entries(chainAddresses)) {
        if (!addressRecord.interchainGasPaymaster) {
            elizaLogger.warn(`Interchain gas paymaster not found for chain ${chain}`)
        }

        chainAddresses[chain].interchainGasPaymaster = ethers.constants.AddressZero
    }


}

export async function createMultisignConfig (ismType : MultisigIsmConfig['type']):  Promise<IsmConfig> {
    const validators:string[] = [] ;
    const threshold = 1;

    const result = MultisigIsmConfigSchema.safeParse({
        type : ismType ,
        validators,
        threshold
    })

    if (!result.success){
        return this.createMultisignConfig(ismType);
    }
    return result.data
}

export const   createMerkleTreeConfig = callWithConfigCreationLogs(
    async (): Promise<HookConfig> => {
        return { type: HookType.MERKLE_TREE };
      },
      HookType.MERKLE_TREE,
)

export function readCoreDeployConfigs(filePath: string): CoreConfig {
    const config = readYamlOrJson(filePath);
    return CoreConfigSchema.parse(config);
  }

export async function addBlockExplorerConfig( runtime : IAgentRuntime, metadata :ChainMetadata ) {
    if (runtime.getSetting("BLOCK_EXPLORER_URL")) {
        const name : any = runtime.getSetting("BLOCK_EXPLORER_NAME");
       const blockExplorerUrl:any = runtime.getSetting("BLOCK_EXPLORER_URL");
       const apiUrl:any = runtime.getSetting("BLOCK_EXPLORER_API_URL");
       const family = runtime.getSetting("BLOCK_EXPLORER_FAMILY") as ExplorerFamily
       const apiKey = runtime.getSetting("BLOCK_EXPLORER_API_KEY")
       metadata.blockExplorers = []

       metadata.blockExplorers[0] = {
          name,
            url : blockExplorerUrl,
            apiUrl,
            family
       }

       if (apiKey) {
           metadata.blockExplorers[0].apiKey = apiKey
       }
    }

}

export async function addBlockOrGasConfig(runtime  : IAgentRuntime , metadata: ChainMetadata) : Promise<void> {
    const  WantBlockOrGasConfig = runtime.getSetting("WANT_BLOCK_OR_GAS_CONFIG")

    if (WantBlockOrGasConfig) {
        await addBlockConfig(runtime , metadata)
        await addGasConfig(runtime , metadata)

    }
        else {
            elizaLogger.log("Block or Gas config not found , Skipping it -----")
        }

}


export async function addBlockConfig(runtime: IAgentRuntime , metadata : ChainMetadata) {
    const blockConfirmation:any = runtime.getSetting("BLOCK_CONFIRMATION")
    const blockReorgPeriod:any = runtime.getSetting("BLOCK_REORG_PERIOD")
    const blockEstimateTime:any = runtime.getSetting("BLOCK_ESTIMATE_TIME")

    metadata.blocks = {
        confirmations : blockConfirmation,
        reorgPeriod : blockReorgPeriod,
        estimateBlockTime : blockEstimateTime
    }

 }


 export async function addGasConfig(runtime : IAgentRuntime , metadata : ChainMetadata) {
        const isEIP1559 = runtime.getSetting("IS_EIP1559")

        if (isEIP1559) {
            const maxFeePerGas: any = runtime.getSetting("MAX_FEE_PER_GAS")
            const maxPriorityFeePerGas :any = runtime.getSetting("MAX_PRIORITY_FEE_PER_GAS")
            metadata.transactionOverrides = {
                maxFeePerGas: BigInt(maxFeePerGas) * BigInt(10 ** 9),
                maxPriorityFeePerGas: BigInt(maxPriorityFeePerGas) * BigInt(10 ** 9),
            }
        }else {
            const gasPrice: any = runtime.getSetting("GAS_PRICE")
            metadata.transactionOverrides = {
                gasPrice: BigInt(gasPrice) * BigInt(10 ** 9),
            }
        }
 }

 export async function addNativeTokenConfig(runtime : IAgentRuntime , metadata : ChainMetadata) {
    const wantNativeTokenConfig = runtime.getSetting("WANT_NATIVE_TOKEN_CONFIG")

    if (wantNativeTokenConfig) {
        const nativeTokenSymbol = runtime.getSetting("NATIVE_TOKEN_SYMBOL")
        const nativeTokenName = runtime.getSetting("NATIVE_TOKEN_NAME")
        const nativeTokenDecimals = runtime.getSetting("NATIVE_TOKEN_DECIMALS")

        metadata.nativeToken = {
            symbol : nativeTokenSymbol ?? "ETH",
            name : nativeTokenName ?? "Ether",
            decimals : nativeTokenDecimals ? parseInt(nativeTokenDecimals , 10): 18
        }
    }
 }