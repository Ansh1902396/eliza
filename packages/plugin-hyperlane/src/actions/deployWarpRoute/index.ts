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
import path from "path";
import os from "os";
import fs from "fs";

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

                            // Get GitHub token from settings, or use a fallback for testing
                            // const Token =runtime.getSetting("HYPERLANE_TOKEN");



                            const registry = new GithubRegistry({
                                // authToken: Token,
                            });

                            const signerPrivateKey = runtime.getSetting(
                                "HYPERLANE_PRIVATE_KEY"
                            )as `0x${string}`;
                            if (!signerPrivateKey) {
                                elizaLogger.error("No signer private key found");
                                if (callback) {
                                    callback({
                                        text: "Failed to deploy Warp Route: No signer private key found.",
                                    });
                                }
                                return Promise.resolve(false);
                            }

                            const signer = privateKeyToSigner(signerPrivateKey);

                            const signerAddress = runtime.getSetting(
                                "HYPERLANE_ADDRESS"
                            ) as `0x${string}`;
                            if (
                                !signerAddress ||
                                (await signer.getAddress()) !== signerAddress
                            ) {
                                elizaLogger.error("Signer address not found or doesn't match private key");
                                if (callback) {
                                    callback({
                                        text: "Failed to deploy Warp Route: Signer address is invalid or doesn't match the private key.",
                                    });
                                }
                                return Promise.resolve(false);
                            }

                            // Get chains from settings
                            const chainsString = runtime.getSetting("HYPERLANE_CHAINS");
                            const chains = chainsString ? chainsString.split(",") : [];

                            // Check if chains are provided
                            if (chains.length === 0) {
                                elizaLogger.error("No chains found for Warp Route deployment");
                                if (callback) {
                                    callback({
                                        text: "Failed to deploy Warp Route: No chains specified. Please set HYPERLANE_CHAINS as a comma-separated list.",
                                    });
                                }
                                return Promise.resolve(false);
                            }

                            const multiProvider = new MultiProvider(chainMetadata);

                            // Set up signers for all the chains
                            for (const chain of chains) {
                                // Only set signer if the chain exists in chainMetadata
                                if (chainMetadata[chain]) {
                                    try {
                                        console.log(`Setting signer for chain: ${chain}`);
                                        multiProvider.setSigner(chain, signer);
                                    } catch (error) {
                                        elizaLogger.error(`Failed to set signer for chain ${chain}: ${error.message}`);
                                    }
                                } else {
                                    elizaLogger.error(`Chain ${chain} not found in chainMetadata`);
                                }
                            }

                            const context: WriteCommandContext = {
                                registry: registry,
                                multiProvider: multiProvider,
                                skipConfirmation: true,
                                signerAddress: signerAddress,
                                key: signerPrivateKey,
                                chainMetadata,
                                signer,
                            };

                const tokenAddress = runtime.getSetting("HYPERLANE_TOKEN_ADDRESS") as string;
                if (!tokenAddress) {
                    elizaLogger.error("No token address found for Warp Route deployment");
                    if (callback) {
                        callback({
                            text: "Failed to deploy Warp Route: No token address specified. Please set HYPERLANE_TOKEN_ADDRESS.",
                        });
                    }
                    return Promise.resolve(false);
                }

                const tokenType = runtime.getSetting("HYPERLANE_TOKEN_TYPE") as TokenType;
                if (!tokenType) {
                    elizaLogger.error("No token type found for Warp Route deployment");
                    if (callback) {
                        callback({
                            text: "Failed to deploy Warp Route: No token type specified. Please set HYPERLANE_TOKEN_TYPE.",
                        });
                    }
                    return Promise.resolve(false);
                }

                // Create directory for config if it doesn't exist
                const configDir = path.join(os.homedir(), ".hyperlane", "warp");
                if (!fs.existsSync(configDir)) {
                    fs.mkdirSync(configDir, { recursive: true });
                }
                const configPath = path.join(configDir, "warp-route-deploy-config.yaml");

                // Initialize WarpDeployer with proper path
                const warpDeployer = new WarpDeployerClass(
                    tokenAddress,
                    tokenType,
                    configPath
                );

                elizaLogger.log(`Creating Warp Route config for chains: ${chains.join(', ')}`);

                try {
                    await warpDeployer.createWarpRouteDeployConfig({
                        context,
                        chains,
                    });

                    elizaLogger.log(`Config created at ${configPath}, starting deployment...`);

                    await warpDeployer.runWarpRouteDeploy({
                        context: context,
                        warpRouteDeployConfigPath: configPath
                    });

                    if (callback) {
                        callback({
                            text: "Successfully deployed Warp Route",
                        });
                    }

                    return Promise.resolve(true);
                } catch (error) {
                    elizaLogger.error(`Error in Warp Route deployment: ${error.message}`);
                    elizaLogger.error(error.stack);

                    if (callback) {
                        callback({
                            text: `Error deploying Warp Route: ${error.message}`,
                        });
                    }

                    return Promise.resolve(false);
                }
            } catch(error) {
                elizaLogger.error(
                    "Error in deploying Warp Route",
                    error.message
                );
                elizaLogger.error(error.stack);

                if (callback) {
                    callback({
                        text: `Error in deploying Warp Route: ${error.message}`,
                    });
                }

                return Promise.resolve(false);
            }
        },
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