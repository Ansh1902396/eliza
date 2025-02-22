export const assetTransferPromptTemplate = `
Look at your LAST RESPONSE in the conversation where you confirmed an asset transfer request.
Based on ONLY that last message, extract the details:

Asset Transfer Examples:
- "Transfer 10 tokens to chain2 at 0xRecipientAddress with token 0xTokenAddress"
  -> { "action": "transfer_token", "destination_chain": "chain2", "recipient": "0xRecipientAddress", "token_address": "0xTokenAddress", "amount": 10 }
- "Bridge 5 tokens to chain1 at 0xAddress with 0xTokenAddress"
  -> { "action": "transfer_token", "destination_chain": "chain1", "recipient": "0xAddress", "token_address": "0xTokenAddress", "amount": 5 }

\`\`\`json
{
    "action": "transfer_token",
    "destination_chain": "<destination chain>",
    "recipient": "<recipient address>",
    "token_address": "<token address>",
    "amount": "<amount>"
}
\`\`\`

Ensure that only relevant details are extracted.

Recent conversation:
{{recentMessages}}
`;

export const deployWarpRoutePromptTemplate = `
Look at your LAST RESPONSE in the conversation where you confirmed a Warp Route deployment request.
Based on ONLY that last message, extract the deployment details:

Deployment Example:
- "Deploy a warp route between chain1 and chain2 with token 0xTokenAddress"
  -> { "action": "deploy_warp_route", "origin_chain": "chain1", "destination_chain": "chain2", "token_address": "0xTokenAddress" }

\`\`\`json
{
    "action": "deploy_warp_route",
    "origin_chain": "<origin chain>",
    "destination_chain": "<destination chain>",
    "token_address": "<token address>"
}
\`\`\`

Ensure that only relevant details are extracted.

Recent conversation:
{{recentMessages}}
`;

export const deployChainOnHyperlanePromptTemplate = `
Look at your LAST RESPONSE in the conversation where you confirmed a chain deployment on Hyperlane.
Based on ONLY that last message, extract the deployment details:

Deployment Example:
- "Deploy chain3 on Hyperlane with configuration 0xConfigAddress"
  -> { "action": "deploy_chain", "chain": "chain3", "config_address": "0xConfigAddress" }

\`\`\`json
{
    "action": "deploy_chain",
    "chain": "<chain name>",
    "config_address": "<configuration address>"
}
\`\`\`

Ensure that only relevant details are extracted.

Recent conversation:
{{recentMessages}}
`;

export const sendCrossChainMessagePromptTemplate = `
Look at your LAST RESPONSE in the conversation where you confirmed a cross-chain message request.
Based on ONLY that last message, extract the message details:

Message Examples:
- "Send 'Hello' to chain2 at 0xRecipientAddress"
  -> { "action": "send_message", "destination_chain": "chain2", "recipient": "0xRecipientAddress", "message": "Hello" }
- "Dispatch 'Welcome' to chain1 at 0xAddress"
  -> { "action": "send_message", "destination_chain": "chain1", "recipient": "0xAddress", "message": "Welcome" }

\`\`\`json
{
    "action": "send_message",
    "destination_chain": "<destination chain>",
    "recipient": "<recipient address>",
    "message": "<message content>"
}
\`\`\`

Ensure that only relevant details are extracted.

Recent conversation:
{{recentMessages}}
`;
