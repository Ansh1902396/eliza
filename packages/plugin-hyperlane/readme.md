# @elizaos/plugin-hyperlane

A plugin that integrates Hyperlane cross-chain messaging functionality into Eliza OS, enabling interoperability between different blockchain networks, token transfers across chains, and messaging capabilities.

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
HYPERLANE_TOKEN_ADDRESS=your_token_address
HYPERLANE_TOKEN_TYPE=ERC20  # Token type (ERC20, ERC721, etc.)
HYPERLANE_CHAINS=ethereum,polygon,arbitrum  # Comma-separated list of supported chains

# Secondary Chain Configuration (for cross-chain operations)
CHAIN_NAME_2=polygon  # Name of the secondary chain
```

## Features

### Cross-Chain Messaging

- Send and receive messages between different blockchain networks
- Verify message delivery and status
- Handle message callbacks and hooks

### Token Operations

- Transfer tokens across different chains
- Query token balances across chains
- Manage token allowances for cross-chain operations

### Network Management

- Connect to multiple EVM-compatible networks simultaneously
- Switch between networks programmatically
- Support for testnet and mainnet environments

### Gas Optimization

- Estimate gas costs for cross-chain operations
- Optimize transactions for lower fees
- Support for gas fee management across multiple chains

## Usage Examples

### Initialize Hyperlane Connection

```plaintext
"Connect to Hyperlane between Ethereum and Polygon"
```

### Send Cross-Chain Messages

```plaintext
"Send a message from Ethereum to Polygon saying 'Hello from Ethereum'"
```

### Cross-Chain Token Transfers

```plaintext
"Transfer 10 USDC from Ethereum to my wallet on Polygon"
```

### Query Cross-Chain Status

```plaintext
"Check the status of my last cross-chain message"
```

### Switch Networks

```plaintext
"Switch to Arbitrum network for the next operation"
```

## Dependencies

This plugin relies on several key dependencies:

- @elizaos/core: 0.25.6-alpha.1
- @elizaos/plugin-evm: ^0.1.8
- @hyperlane-xyz/registry: ^7.2.2
- @hyperlane-xyz/sdk: ^8.1.0
- @hyperlane-xyz/utils: ^8.4.0
- ethers: ^5.7.2
- viem: 2.21.58

## Technical Details

### Architecture

The plugin leverages Hyperlane's infrastructure to enable cross-chain communication through a modular approach:

1. **Mailbox Contracts**: Handle message dispatch and delivery
2. **Interchain Security Modules**: Verify message authenticity
3. **Interchain Gas Payment**: Manage gas fees across chains

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
- Optional interchain security modules can be enabled for additional security

## Troubleshooting

### Common Issues

- **Connection Errors**: Ensure RPC URLs are correct and accessible
- **Transaction Failures**: Check gas settings and token allowances
- **Message Delays**: Cross-chain messages may take time to propagate

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