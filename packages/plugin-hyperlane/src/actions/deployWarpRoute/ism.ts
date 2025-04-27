 import { WarpRouteDeployConfig , HyperlaneProxyFactoryDeployer , ContractVerifier
    , HypTokenRouterConfig , HookConfig , EvmHookModule , IsmConfig, EvmIsmModule
   } from "@hyperlane-xyz/sdk";

import { ProxyAdmin__factory } from "@hyperlane-xyz/core";
import { Address } from "@hyperlane-xyz/utils";
 import { promiseObjAll , objMap } from "@hyperlane-xyz/utils";
 import { WriteCommandContext } from "../core/context";
import { elizaLogger } from "@elizaos/core";


  async function createWarpHook({
     chain,
     chainAddresses,
     context,
     contractVerifier,
     warpConfig,
   }: {
     chain: string;
     chainAddresses: Record<string, string>;
     context: WriteCommandContext;
     contractVerifier?: ContractVerifier;
     warpConfig: HypTokenRouterConfig;
     ismFactoryDeployer: HyperlaneProxyFactoryDeployer;
   }): Promise<HookConfig | undefined> {
     const { hook } = warpConfig;

     if (!hook || typeof hook === 'string') {
       console.log(`Config Hook is ${!hook ? 'empty' : hook}, skipping deployment.`);
       return hook;
     }

     elizaLogger.log(`Loading registry factory addresses for ${chain}...`);

     elizaLogger.log(`Creating ${hook.type} Hook for token on ${chain} chain...`);

     const {
       mailbox,
       domainRoutingIsmFactory,
       staticAggregationHookFactory,
       staticAggregationIsmFactory,
       staticMerkleRootMultisigIsmFactory,
       staticMessageIdMultisigIsmFactory,
       staticMerkleRootWeightedMultisigIsmFactory,
       staticMessageIdWeightedMultisigIsmFactory,
     } = chainAddresses;
     const proxyFactoryFactories = {
       domainRoutingIsmFactory,
       staticAggregationHookFactory,
       staticAggregationIsmFactory,
       staticMerkleRootMultisigIsmFactory,
       staticMessageIdMultisigIsmFactory,
       staticMerkleRootWeightedMultisigIsmFactory,
       staticMessageIdWeightedMultisigIsmFactory,
     };

     // If config.proxyadmin.address exists, then use that. otherwise deploy a new proxyAdmin
     const proxyAdminAddress: Address =
       warpConfig.proxyAdmin?.address ??
       (
         await context.multiProvider.handleDeploy(
           chain,
           new ProxyAdmin__factory(),
           [],
         )
       ).address;

     const evmHookModule = await EvmHookModule.create({
       chain,
       multiProvider: context.multiProvider,
       coreAddresses: {
         mailbox,
         proxyAdmin: proxyAdminAddress,
       },
       config: hook,
       contractVerifier,
       proxyFactoryFactories,
     });
     elizaLogger.log(`Finished creating ${hook.type} Hook for token on ${chain} chain.`);
     const { deployedHook } = evmHookModule.serialize();
     return deployedHook;
   }


   async function createWarpIsm({
     chain,
     chainAddresses,
     context,
     contractVerifier,
     warpConfig,
   }: {
     chain: string;
     chainAddresses: Record<string, string>;
     context: WriteCommandContext;
     contractVerifier?: ContractVerifier;
     warpConfig: HypTokenRouterConfig;
     ismFactoryDeployer: HyperlaneProxyFactoryDeployer;
   }): Promise<IsmConfig | undefined> {
     const { interchainSecurityModule } = warpConfig;
     if (
       !interchainSecurityModule ||
       typeof interchainSecurityModule === 'string'
     ) {
       elizaLogger.log(
         `Config Ism is ${
           !interchainSecurityModule ? 'empty' : interchainSecurityModule
         }, skipping deployment.`,
       );
       return interchainSecurityModule;
     }

     elizaLogger.log(`Loading registry factory addresses for ${chain}...`);

     elizaLogger.log(
       `Creating ${interchainSecurityModule.type} ISM for token on ${chain} chain...`,
     );

     elizaLogger.log(
       `Finished creating ${interchainSecurityModule.type} ISM for token on ${chain} chain.`,
     );

     const {
       mailbox,
       domainRoutingIsmFactory,
       staticAggregationHookFactory,
       staticAggregationIsmFactory,
       staticMerkleRootMultisigIsmFactory,
       staticMessageIdMultisigIsmFactory,
       staticMerkleRootWeightedMultisigIsmFactory,
       staticMessageIdWeightedMultisigIsmFactory,
     } = chainAddresses;

     context.multiProvider.setSigner(chain , context.signer)

     const evmIsmModule = await EvmIsmModule.create({
       chain,
       mailbox,
       multiProvider: context.multiProvider,
       proxyFactoryFactories: {
         domainRoutingIsmFactory,
         staticAggregationHookFactory,
         staticAggregationIsmFactory,
         staticMerkleRootMultisigIsmFactory,
         staticMessageIdMultisigIsmFactory,
         staticMerkleRootWeightedMultisigIsmFactory,
         staticMessageIdWeightedMultisigIsmFactory,
       },
       config: interchainSecurityModule,
       contractVerifier,
     });
     const { deployedIsm } = evmIsmModule.serialize();
     return deployedIsm;
   }


 export async function resolveWarpIsmAndHook(
    warpConfig: WarpRouteDeployConfig,
    context: WriteCommandContext,
    ismFactoryDeployer: HyperlaneProxyFactoryDeployer,
    contractVerifier?: ContractVerifier,
  ): Promise<WarpRouteDeployConfig> {
    return promiseObjAll(
      objMap(warpConfig, async (chain, config) => {
        const chainAddresses = await context.registry.getChainAddresses(chain);

        if (!chainAddresses) {
          throw `Registry factory addresses not found for ${chain}.`;
        }

        config.interchainSecurityModule = await createWarpIsm({
          chain,
          chainAddresses,
          context,
          contractVerifier,
          ismFactoryDeployer,
          warpConfig: config,
        }); // TODO write test

        config.hook = await createWarpHook({
          chain,
          chainAddresses,
          context,
          contractVerifier,
          ismFactoryDeployer,
          warpConfig: config,
        });
        return config;
      }),
    );
  }


