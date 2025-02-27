# @elizaos/plugin-hyperlane

A plugin that integrates Hyperlane cross-chain messaging functionality into Eliza OS, enabling seamless interoperability between different blockchain networks, token transfers across chains, and cross-chain messaging capabilities.

## Authors

- Ruddy ([GitHub: Ansh1902396](https://github.com/Ansh1902396))
- Suryansh ([GitHub: Suryansh-23](https://github.com/Suryansh-23))

## Installation

```bash
pnpm add @elizaos/plugin-hyperlane
```

## Configuration

### Required Environment Variables

```env
# EVM Configuration
EVM_PRIVATE_KEY=your_evm_private_key

# Primary Chain Configuration
CHAIN_NAME=ethereum  # Name of the primary chain
CHAIN_ID=1  # ID of the primary chain
RPC_URL=https://your-rpc-url.com  # RPC URL for the primary chain
IS_TESTNET=true  # Set to true for testnet, false for mainnet

# Hyperlane Configuration
HYPERLANE_PRIVATE_KEY=your_hyperlane_private_key
HYPERLANE_ADDRESS=your_hyperlane_address
HYPERLANE_TOKEN_ADDRESS=your_token_address  # Required for Warp routes
HYPERLANE_TOKEN_TYPE=ERC20  # Token type (ERC20, ERC721, etc.)
HYPERLANE_CHAINS=ethereum,polygon,arbitrum  # Comma-separated list of supported chains

# Secondary Chain Configuration (for cross-chain operations)
CHAIN_NAME_2=polygon  # Name of the secondary chain
```

## Features

### Chain Deployment

- Deploy Hyperlane infrastructure on new chains
- Set up validators and relayers for message verification
- Configure interchain security modules (ISMs)

### Cross-Chain Messaging

- Send and receive arbitrary messages between different blockchain networks
- Verify message delivery and status
- Support for self-relay or validator-based relay

### Cross-Chain Token Transfers

- Transfer tokens across different chains using Hyperlane Warp
- Support for multiple token types (ERC20, ERC721)
- Secure, trustless transfers with automatic verification

### Warp Route Deployment

- Deploy custom Warp routes for specific tokens
- Configure token bridges between chains
- Set up collateralized and native token routes

## Usage Examples

### Deploy Hyperlane on a Chain

```plaintext
"Deploy the chain on Hyperlane"
```

This will:
1. Create chain configuration
2. Initialize deployment parameters
3. Deploy core Hyperlane contracts
4. Configure and start validators and relayers

### Send Cross-Chain Messages

```plaintext
"Send a message from Ethereum to Polygon"
```

This enables you to send arbitrary messages across chains with:
- Custom message content
- Specified recipient address
- Optional self-relay for testing purposes

### Cross-Chain Token Transfers

```plaintext
"Transfer 100 USDC from Ethereum to Polygon"
```

This will:
1. Validate the transfer parameters
2. Look up the appropriate Warp route
3. Execute the cross-chain transfer
4. Provide transaction tracking information

### Deploy Warp Routes

```plaintext
"Deploy a warp route between chain1 and chain2 with token 0xTokenAddress"
```

Creates token bridges between chains for specified tokens, enabling seamless token transfers.

## Technical Details

### Core Components

#### Chain Deployment (`DEPLOY_CHAIN`)

The plugin allows you to deploy the entire Hyperlane infrastructure on a new chain:

```javascript
// Example usage
{
  user: "user1",
  content: {
    text: "Deploy the chain on Hyperlane",
  }
}
// Agent response
{
  user: "agent",
  content: {
    text: "I'll deploy your chain on Hyperlane and start agents",
    action: "DEPLOY_CHAIN",
  }
}
```

This action:
- Creates chain configuration with proper RPC and metadata
- Initializes deployment parameters for Hyperlane core
- Deploys multisig ISMs (Interchain Security Modules)
- Configures and starts validators and relayers

#### Message Sending (`SEND_CROSS_CHAIN_MESSAGE`)

Send arbitrary data between blockchains:

```javascript
// Example usage
{
  user: "user1",
  content: {
    text: "Send a message from Ethereum to Polygon",
  }
}
// Agent response
{
  user: "agent",
  content: {
    text: "I'll send your message across chains.",
    action: "SEND_CROSS_CHAIN_MESSAGE",
  }
}
```

This action allows for:
- Custom message content
- Specified recipient address
- Timeout configuration
- Self-relay options for testing

#### Token Transfers (`TRANSFER_CROSS_CHAIN_ASSET`)

Transfer tokens seamlessly between chains:

```javascript
// Example usage
{
  user: "user1",
  content: {
    text: "Transfer 100 USDC from Ethereum to Polygon",
  }
}
// Agent response
{
  user: "agent",
  content: {
    text: "I'll help transfer your tokens across chains.",
    action: "TRANSFER_CROSS_CHAIN_ASSET",
  }
}
```

This supports:
- Multiple token types
- Custom amount specification
- Recipient address customization

#### Warp Route Deployment (`DEPLOY_WARP_ROUTE`)

Create token bridges between chains:

```javascript
// Example usage
{
  user: "user1",
  content: {
    text: "Deploy a warp route between chain1 and chain2 with token 0xTokenAddress",
  }
}
// Agent response
{
  user: "agent",
  content: {
    text: "I'll deploy the Warp Route for your token between the chains using hyperlane",
    action: "DEPLOY_WARP_ROUTE",
  }
}
```

This action:
- Creates configuration for token bridges
- Deploys necessary contracts on both chains
- Configures routing for specific token types

### Architecture

The plugin leverages Hyperlane's infrastructure to enable cross-chain communication through a modular approach:

1. **Mailbox Contracts**: Handle message dispatch and delivery
2. **Interchain Security Modules (ISMs)**: Verify message authenticity
3. **Merkle Tree Hooks**: Enable efficient message verification
4. **Warp Routes**: Handle token transfers between chains

### Supported Chains

The plugin supports all EVM-compatible chains that Hyperlane has integrated with, including but not limited to:

- Ethereum
- Polygon
- Arbitrum
- Optimism
- Avalanche
- Binance Smart Chain
- Base

### Security Considerations

- Private keys are used for signing transactions and should be kept secure
- Multiple validation layers ensure message integrity across chains
- Interchain security modules protect against fraudulent messages
- Merkle tree verification ensures proof validity

## Dependencies

This plugin relies on several key dependencies:

- @elizaos/core: 0.25.6-alpha.1
- @elizaos/plugin-evm: ^0.1.8
- @hyperlane-xyz/registry: ^7.2.2
- @hyperlane-xyz/sdk: ^8.1.0
- @hyperlane-xyz/utils: ^8.4.0
- ethers: ^5.7.2
- viem: 2.21.58

## Troubleshooting

### Common Issues

- **Connection Errors**: Ensure RPC URLs are correct and accessible
- **Transaction Failures**: Check gas settings and token allowances
- **Message Delays**: Cross-chain messages may take time to propagate
- **Deployment Failures**: Verify chain configuration and contract prerequisites

### Logs and Debugging

The plugin uses Pino for logging. Set up detailed logs with:

```javascript
// In your Eliza OS configuration
{
  logging: {
    level: 'debug',
    prettyPrint: true
  }
}
```


## Additional Resources

- [Hyperlane Documentation](https://docs.hyperlane.xyz/)
- [EVM Plugin Documentation](https://docs.elizaos.com/plugins/evm)
- [Ethers.js Documentation](https://docs.ethers.io/v5/)

For more information about Hyperlane capabilities, see [Hyperlane Documentation](https://docs.hyperlane.xyz/).