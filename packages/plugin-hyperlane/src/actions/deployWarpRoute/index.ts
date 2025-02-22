import {
    Action,
    ActionExample,
    composeContext,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@elizaos/core";
import { TokenType } from "@hyperlane-xyz/sdk";
import { evmWalletProvider, initWalletProvider } from "@elizaos/plugin-evm";
import { WarpDeployerClass } from "./warpRouteDeployerClass";
import { privateKeyToSigner } from "../core/utils";
import { GithubRegistry , chainMetadata } from "@hyperlane-xyz/registry";
import { MultiProvider } from "@hyperlane-xyz/sdk";
import { WriteCommandContext } from "../core/context";
import { deployWarpRoutePromptTemplate } from "../../../templates";

export const deployWarpRoute:  Action = {
    name : "DEPLOY_WARP_ROUTE",
    similes: [
        "SETUP_WARP_ROUTE"
    ] ,
    description : "Action for deploying Warp Route for enabling token transfer between chains ",
    validate: async (
            runtime: IAgentRuntime,
            message: Memory,
            state?: State
        ): Promise<boolean> => {
            const signerPrivateKey = runtime.getSetting("HYPERLANE_PRIVATE_KEY");
            if (!signerPrivateKey) {
                return Promise.resolve(false);
            }

            const signer = privateKeyToSigner(signerPrivateKey);

            const signerAddress = runtime.getSetting(
                "HYPERLANE_ADDRESS"
            ) as `0x${string}`;
            if (!signerAddress || (await signer.getAddress()) !== signerAddress) {
                return Promise.resolve(false);
            }

            const chainName = runtime.getSetting("CHAIN_NAME");
            if (!chainName) {
                Promise.resolve(false);
            }

            return Promise.resolve(true);
        },
        handler : async(
            runtime : IAgentRuntime ,
            message : Memory ,
            state?: State ,
            options?: {
                [key: string] : unknown;
            },
            callback?: HandlerCallback
        ) => {

            try{

                if (!state){
                    state = (await runtime.composeState(message)) as State;
                }else{
                    state = await runtime.updateRecentMessageState(state);
                }

                 const hyperlaneContext = composeContext({
                                state,
                                template: deployWarpRoutePromptTemplate, // TODO: Add template
                            });
                            const content = await generateObjectDeprecated({
                                runtime,
                                context: hyperlaneContext,
                                modelClass: ModelClass.LARGE,
                            });

                            const registry = new GithubRegistry();

                            const signerPrivateKey = runtime.getSetting(
                                "HYPERLANE_PRIVATE_KEY"
                            )as `0x${string}`;
                            if (!signerPrivateKey) {
                                elizaLogger.error("No signer private key found");
                            }

                            const signer = privateKeyToSigner(signerPrivateKey);

                            const signerAddress = runtime.getSetting(
                                "HYPERLANE_ADDRESS"
                            ) as `0x${string}`;
                            if (
                                !signerAddress ||
                                (await signer.getAddress()) !== signerAddress
                            ) {
                                throw new Error("Signer address not found");
                            }

                            const context: WriteCommandContext = {
                                            registry: registry,
                                            multiProvider: new MultiProvider(chainMetadata),
                                            skipConfirmation: true,
                                            signerAddress: signerAddress,
                                            key: signerPrivateKey,
                                            chainMetadata,
                                            signer,
                                        };

                //TODO  :Add the folder path for the Warp Route deployment
                const warpDeployer = new WarpDeployerClass(
                    runtime.getSetting("HYPERLANE_TOKEN_ADDRESS") as string,
                    runtime.getSetting("HYPERLANE_TOKEN_TYPE") as TokenType,
                    ""
                );

                const chains = runtime.getSetting("HYPERLANE_CHAINS") ? runtime.getSetting("HYPERLANE_CHAINS")?.split(",") : [];

                if (!chains) {
                    elizaLogger.error("No chains found for Warp Route deployment");
                    throw new Error("No chains found for Warp Route deployment");
                }

                //TODO: Add validation if the config is available
                warpDeployer.createWarpRouteDeployConfig({
                    context,
                    chains,
                })


                warpDeployer.runWarpRouteDeploy({
                    context : context ,
                    warpRouteDeployConfigPath : "" //TODO : Add the path for the Warp Route deployment
                })

                if (callback){
                    callback({
                        text: "Successfully deployed Warp Route",
                    });
                }

                return Promise.resolve(true);
            }catch(error){
                elizaLogger.log(
                    "Error in deploying Warp Route",
                    error.message
                )

                if (callback){
                    callback({
                        text : "Error in deploying Warp Route",
                    })
                }

                return Promise.resolve(false)
            }
        } ,
        examples: [
            [
                {
                    user: "{{user1}}",
                    content: {
                        text: "Deploy a warp route between chain1 and chain2 with token 0xTokenAddress",
                    },
                },
                {
                    user: "{{agent}}",
                    content: {
                        text: "I'll deoply the Warp Route for your token between the chains using hyperlane ",
                        action: "DEPLOY_WARP_ROUTE",
                    },
                },
                {
                    user: "{{agent}}",
                    content: {
                        text: "Successfully deployed Warp Route",
                    },
                },
            ],
        ] as ActionExample[][],
}