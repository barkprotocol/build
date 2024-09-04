# BARK Build.ts

## Overview

The BARK Build class provides a TypeScript solution for building, optimizing, serializing, and optionally base64 encoding Solana transactions. Utilizing the `@solana/web3.js` library, this class allows for transaction construction and optimization to meet compute and fee requirements.

## Features

- **Build Transactions**: Construct Solana transactions with necessary instructions and signers.
- **Optimize Transactions**: Automatically optimize transactions by adjusting compute units and fees.
- **Serialize Transactions**: Serialize transactions for submission to the Solana network.
- **Base64 Encode Transactions**: Encode serialized transactions in Base64 format for easier handling.

## Installation

Ensure you have Node.js and npm installed. To install the necessary dependencies, run:

```bash
npm install @solana/web3.js bs58
```

## Usage

### Import the Class

```typescript
import build from './build';
```

### Example

Here's a basic example demonstrating how to create, optimize, and submit a Solana transaction:

```typescript
// Create your instructions and then:

const _tx_ = {
    rpc: 'https://api.mainnet-beta.solana.com', // required
    account: 'your-payer-public-key',            // required
    instructions: [instruction],                 // required
    signers: [payer],                           // optional
    priority: 'Medium',                         // optional: 'VeryHigh', 'High', 'Medium', 'Low', 'Min'
    tolerance: 1.1,                             // optional: float
    serialize: true,                            // optional: serialize the transaction
    encode: true,                               // optional: base64 encode the serialized transaction
    table: [],                                  // optional: instruction tables for advanced use
    compute: true,                              // optional: optimize compute units
    fees: true                                  // optional: optimize fees
};

(async () => {
    try {
        const tx = await build.tx(_tx_);

        if (tx.message) {
            console.error("Error:", tx.message);
            return;
        }

        // Sign, serialize, and send the transaction
        const signed = await provider.signTransaction(tx.transaction);
        const signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: true,
            maxRetries: 0
        });

        // Track the transaction status
        const status = await build.status(_tx_.rpc, signature, 10, 4);
        console.log("Status:", status);

    } catch (err) {
        console.error("Error:", err);
    }
})();
```

### Methods

- **`status(cluster: string, sig: string, max?: number, int?: number): Promise<string>`**  
  Monitors the status of a transaction until it is finalized or the maximum wait time is reached.

- **`ComputeLimit(cluster: string, payer: { publicKey: PublicKey }, instructions: TransactionInstruction[], tolerance: number, blockhash: string, tables?: any[]): Promise<number | { message: string; logs: string[] }>`**  
  Computes the required compute units for the transaction based on simulation results.

- **`FeeEstimate(cluster: string, payer: { publicKey: PublicKey }, priorityLevel: PriorityLevel, instructions: TransactionInstruction[], blockhash: string, tables?: any[]): Promise<number>`**  
  Estimates the fee required for the transaction based on the priority level.

- **`tx(options: TxOptions): Promise<any>`**  
  Builds and prepares the transaction based on the provided options. Returns a transaction object or an error message.

## Types

- **`PriorityLevel`**: `'VeryHigh' | 'High' | 'Medium' | 'Low' | 'Min'`
- **`TxOptions`**: Interface for transaction options, including RPC URL, account public key, instructions, signers, priority, and others.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/barkprotocol/build/blob/main/LICENSE) file for details.

## Contributing

Contributions are welcome! Please follow the standard GitHub process: fork the repository, create a branch, make your changes, and open a pull request.

## Contact

For questions or feedback, please reach out to [@barkprotocol](https://twitter.com/bark_protocol).

