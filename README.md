# BARK NFT

A TypeScript class named **BARK** that builds, optimizes, and optionally serializes & base64 encodes a Solana transaction. This class utilizes the `@solana/web3.js` library, providing functionality to construct, optimize, serialize, and encode Solana transactions in an efficient manner.

## Features

- **Transaction Building**: Create and manage Solana transactions easily.
- **Optimization**: Optimize transactions by compressing or refining instructions.
- **Serialization**: Optionally serialize the transaction for sending to the Solana network.
- **Base64 Encoding**: Optionally encode the serialized transaction in base64 format for easier transport.

## Installation

Ensure you have `@solana/web3.js` installed in your project:

```bash
npm install @solana/web3.js
```

Add the `BARK` class to your project by copying the `BARK.ts` file into your TypeScript project.

## Usage

### Importing the Class

```typescript
import { BARK, TxOptions } from './BARK';
```

### Example Usage

Below is an example of how to use the `BARK` class to create, optimize, and send a Solana transaction.

```typescript
import { BARK, TxOptions } from './BARK';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

// RPC and account details
const rpc = 'https://api.mainnet-beta.solana.com';
const payer = 'YourFeePayerPublicKeyHere';
const recipient = new PublicKey('RecipientPublicKeyHere');
const lamports = 1000;  // Amount to transfer

// Create a transaction instruction
const instruction = SystemProgram.transfer({
  fromPubkey: new PublicKey(payer),
  toPubkey: recipient,
  lamports,
});

// Define transaction options
const _tx_: TxOptions = {
  rpc: rpc,
  account: payer,
  instructions: [instruction],
  serialize: true,
  encode: true,
  priority: "Medium",
};

const bark = new BARK(_tx_);

async function main() {
  try {
    // Build, serialize, and possibly encode the transaction
    const tx = await bark.buildAndSerialize();

    // Check if there's any error in the transaction object
    if (typeof (tx as any).logs !== 'undefined') {
      console.log("Error", tx);
      return;
    }

    // Sign, serialize, and send the transaction
    const signed = await provider.signTransaction(tx as Transaction);
    const signature = await connection.sendRawTransaction(
      signed.serialize(),
      { skipPreflight: true, maxRetries: 0 }
    );

    // Track the transaction status
    const status = await bark.status(rpc, signature, 10, 4);
    console.log("Status", status);

  } catch (err) {
    console.log("Error", err);
  }
}

main();
```

### Options

The `TxOptions` interface provides a range of options to customize the transaction:

- `rpc`: **string** (required) - The RPC endpoint URL.
- `account`: **string** (required) - The account public key to use.
- `instructions`: **TransactionInstruction[]** (required) - An array of instructions to add to the transaction.
- `signers`: **Signer[] | false** (optional, default: false) - Signers for the transaction.
- `serialize`: **boolean** (optional, default: false) - Whether to serialize the transaction.
- `encode`: **boolean** (optional, default: false) - Whether to base64 encode the serialized transaction.
- `table`: **any[] | false** (optional, default: false) - Additional table data (not implemented).
- `tolerance`: **number** (optional, default: 1.1) - Tolerance level for optimizations.
- `compute`: **boolean** (optional, default: true) - Whether to compute additional data (not implemented).
- `fees`: **boolean** (optional, default: true) - Whether to calculate fees (not implemented).
- `priority`: **'VeryHigh' | 'High' | 'Medium' | 'Low' | 'Min'** (optional, default: 'Medium') - Priority level for the transaction.

### Methods

- `buildAndSerialize`: Builds the transaction, applies optimizations, signs, serializes, and optionally base64 encodes the transaction.
- `status`: Tracks the transaction status by checking its confirmation on the Solana network.

## Contributing

Feel free to fork this repository, submit issues, and make pull requests. Contributions are welcome!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
