import { stringify as yamlStringify } from "yaml";

import {
    ChainName,
    DispatchedMessage,
    HyperlaneCore,
    HyperlaneRelayer,
    MultiProtocolProvider,
    MultiProvider,
    ProviderType,
    Token,
    TokenAmount,
    WarpCore,
    WarpCoreConfig
} from "@hyperlane-xyz/sdk";
import { parseWarpRouteMessage, timeout } from "@hyperlane-xyz/utils";

import { EXPLORER_URL, MINIMUM_TEST_SEND_GAS } from "../core/consts";
import { WriteCommandContext } from "../core/context";
import { runPreflightChecksForChains } from "../core/utils";
// import { indentYamlOrJson } from "../utils/files.js";
import { ContractReceipt } from "ethers";
import { stubMerkleTreeConfig } from "../core/utils";
// import { runTokenSelectionStep } from "../utils/tokens.js";

import {
    Action,
    ActionExample,
    composeContext,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@elizaos/core";
import { evmWalletProvider, initWalletProvider } from "@elizaos/plugin-evm";
import { GithubRegistry } from "@hyperlane-xyz/registry";
import { Account, Chain, Client, Transport } from "viem";
import { clientToSigner } from "../../utils/ethersAdapter";

export const WarpSendLogs = {
    SUCCESS: "Transfer was self-relayed!",
};

export async function sendTestTransfer({
    context,
    warpCoreConfig,
    chains,
    amount,
    recipient,
    timeoutSec,
    skipWaitForDelivery,
    selfRelay,
}: {
    context: WriteCommandContext;
    warpCoreConfig: WarpCoreConfig;
    chains: ChainName[];
    amount: string;
    recipient?: string;
    timeoutSec: number;
    skipWaitForDelivery: boolean;
    selfRelay?: boolean;
}) {
    await runPreflightChecksForChains({
        context,
        chains,
        minGas: MINIMUM_TEST_SEND_GAS,
    });

    for (let i = 0; i < chains.length; i++) {
        const origin = chains[i];
        const destination = chains[i + 1];

        if (destination) {
            console.log(`Sending a message from ${origin} to ${destination}`);
            await timeout(
                executeDelivery({
                    context,
                    origin,
                    destination,
                    warpCoreConfig,
                    amount,
                    recipient,
                    skipWaitForDelivery,
                    selfRelay,
                }),
                timeoutSec * 1000,
                "Timed out waiting for messages to be delivered"
            );
        }
    }
}

async function executeDelivery({
    context,
    origin,
    destination,
    warpCoreConfig,
    amount,
    recipient,
    skipWaitForDelivery,
    selfRelay,
}: {
    context: WriteCommandContext;
    origin: ChainName;
    destination: ChainName;
    warpCoreConfig: WarpCoreConfig;
    amount: string;
    recipient?: string;
    skipWaitForDelivery: boolean;
    selfRelay?: boolean;
}) {
    const { multiProvider, registry } = context;

    const signer = multiProvider.getSigner(origin);
    const recipientSigner = multiProvider.getSigner(destination);

    const recipientAddress = await recipientSigner.getAddress();
    const signerAddress = await signer.getAddress();

    recipient ||= recipientAddress;

    const chainAddresses = await registry.getAddresses();

    const core = HyperlaneCore.fromAddressesMap(chainAddresses, multiProvider);

    const provider = multiProvider.getProvider(origin);
    const connectedSigner = signer.connect(provider);

    const warpCore = WarpCore.FromConfig(
        MultiProtocolProvider.fromMultiProvider(multiProvider),
        warpCoreConfig
    );

    let token: Token;
    const tokensForRoute = warpCore.getTokensForRoute(origin, destination);
    if (tokensForRoute.length === 0) {
        console.error(`No Warp Routes found from ${origin} to ${destination}`);
        throw new Error("Error finding warp route");
    } else if (tokensForRoute.length === 1) {
        token = tokensForRoute[0];
    } else {
        // console.info(`Please select a token from the Warp config`);
        // const routerAddress = await runTokenSelectionStep(tokensForRoute);
        // token = warpCore.findToken(origin, routerAddress)!;
        throw new Error("Multiple tokens found for route");
    }

    const errors = await warpCore.validateTransfer({
        originTokenAmount: token.amount(amount),
        destination,
        recipient,
        sender: signerAddress,
    });
    if (errors) {
        console.error("Error validating transfer", JSON.stringify(errors));
        throw new Error("Error validating transfer");
    }

    // TODO: override hook address for self-relay
    const transferTxs = await warpCore.getTransferRemoteTxs({
        originTokenAmount: new TokenAmount(amount, token),
        destination,
        sender: signerAddress,
        recipient,
    });

    const txReceipts: ContractReceipt[] = [];
    for (const tx of transferTxs) {
        if (tx.type === ProviderType.EthersV5) {
            const txResponse = await connectedSigner.sendTransaction(
                tx.transaction
            );
            const txReceipt = await multiProvider.handleTx(origin, txResponse);
            txReceipts.push(txReceipt);
        }
    }
    const transferTxReceipt = txReceipts[txReceipts.length - 1];
    const messageIndex: number = 0;
    const message: DispatchedMessage =
        HyperlaneCore.getDispatchedMessages(transferTxReceipt)[messageIndex];

    const parsed = parseWarpRouteMessage(message.parsed.body);

    console.info(
        `Sent transfer from sender (${signerAddress}) on ${origin} to recipient (${recipient}) on ${destination}.`
    );
    console.info(`Message ID: ${message.id}`);
    console.info(`Explorer Link: ${EXPLORER_URL}/message/${message.id}`);
    console.log(`Message:\n${(yamlStringify(message, null, 2), 4)}`);
    console.log(`Body:\n${(yamlStringify(parsed, null, 2), 4)}`);

    if (selfRelay) {
        const relayer = new HyperlaneRelayer({ core });

        const hookAddress = await core.getSenderHookAddress(message);
        const merkleAddress = chainAddresses[origin].merkleTreeHook;
        stubMerkleTreeConfig(relayer, origin, hookAddress, merkleAddress);

        console.log("Attempting self-relay of transfer...");
        await relayer.relayMessage(transferTxReceipt, messageIndex, message);
        console.log(WarpSendLogs.SUCCESS);
        return;
    }

    if (skipWaitForDelivery) return;

    // Max wait 10 minutes
    await core.waitForMessageProcessed(transferTxReceipt, 10000, 60);
    console.log(`Transfer sent to ${destination} chain!`);
}

export const transferCrossChainAsset: Action = {
    name: "TRANSFER_CROSS_CHAIN_ASSET",
    similes: ["TRANSFER_ASSET", "CROSS_CHAIN_TRANSFER", "SEND_TOKEN", "WARP_TRANSFER"],
    description: "Transfer tokens between any supported chains using Hyperlane Warp",
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<boolean> => {
        const res = await evmWalletProvider.get(runtime, message, state);

        if (res) {
            return Promise.resolve(true);
        } else {
            return Promise.reject(false);
        }
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: {
            [key: string]: unknown;
        },
        callback?: HandlerCallback
    ) => {
        try {
            if (!state) {
                state = (await runtime.composeState(message)) as State;
            } else {
                state = await runtime.updateRecentMessageState(state);
            }

            // Compose transfer context
            const transferContext = composeContext({
                state,
                template: "", // TODO: Add template
            });
            const content = await generateObjectDeprecated({
                runtime,
                context: transferContext,
                modelClass: ModelClass.LARGE,
            });

            const walletProvider = await initWalletProvider(runtime);
            const sourceClient = walletProvider.getPublicClient(content.sourceChain) as Client<Transport, Chain, Account>;
            const targetClient = walletProvider.getPublicClient(content.targetChain) as Client<Transport, Chain, Account>;

            const sourceSigner = clientToSigner(sourceClient);
            const targetSigner = clientToSigner(targetClient);

            const registry = new GithubRegistry();
            const chainMetadata = await registry.getMetadata();
            const multiProvider = new MultiProvider(chainMetadata, {
                [content.sourceChain]: sourceSigner,
                [content.targetChain]: targetSigner,
            });

            const privateKey = runtime.getSetting("EVM_PRIVATE_KEY") as `0x${string}`;
            if (!privateKey) {
                throw new Error("EVM_PRIVATE_KEY is missing");
            }

            const context: WriteCommandContext = {
                registry: registry,
                chainMetadata: chainMetadata,
                multiProvider: multiProvider,
                skipConfirmation: true,
                key: privateKey,
                signerAddress: await sourceSigner.getAddress(),
                signer: sourceSigner,
            };

            const transferOptions = {
                context: context,
                warpCoreConfig: content.warpCoreConfig,
                chains: [content.sourceChain, content.targetChain],
                amount: content.amount,
                recipient: content.recipient,
                timeoutSec: content.timeoutSec ?? 60,
                skipWaitForDelivery: content.skipWaitForDelivery ?? false,
                selfRelay: content.selfRelay ?? false,
            };

            await sendTestTransfer({
                ...transferOptions,
            });

            return Promise.resolve(true);
        } catch (error) {
            console.error("Error in transferCrossChainAsset handler:", error.message);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return Promise.resolve(false);
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Transfer 100 USDC from Ethereum to Polygon",
                    options: {
                        sourceChain: "ethereum",
                        targetChain: "polygon",
                        amount: "100",
                        tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                    },
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll help transfer your tokens across chains.",
                    action: "TRANSFER_CROSS_CHAIN_ASSET",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully transferred tokens across chains. Transaction hash: 0xabcd...",
                },
            },
        ],
    ] as ActionExample[][],
};