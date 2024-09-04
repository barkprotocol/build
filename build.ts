// name: build.ts
// author: @barkprotocol
// license: MIT https://github.com/barkprotocol/build/blob/main/LICENSE
'use strict';

import {
  PublicKey,
  Connection,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  TransactionInstruction,
  Signer
} from "@solana/web3.js";
import bs58 from 'bs58';

// Define the priority levels
type PriorityLevel = 'VeryHigh' | 'High' | 'Medium' | 'Low' | 'Min';

// Define the options for the transaction
interface TxOptions {
  rpc: string;
  account: string;
  instructions: TransactionInstruction[];
  signers?: Signer[] | false;
  priority?: PriorityLevel;
  tolerance?: number;
  serialize?: boolean;
  encode?: boolean;
  table?: any[];
  compute?: boolean;
  fees?: boolean;
}

class Build {
  private name: string;

  constructor() {
    this.name = "build";
  }

  // Method to check the status of a transaction
  async status(cluster: string, sig: string, max: number = 10, int: number = 4): Promise<string> {
    const connection = new Connection(cluster, "confirmed");
    let start = 1;

    return new Promise<string>(resolve => {
      const intervalID = setInterval(async () => {
        try {
          const txStatus = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });

          if (txStatus?.value[0]?.confirmationStatus === "finalized") {
            if (txStatus.value[0].err) {
              resolve('Program error!');
              clearInterval(intervalID);
            } else {
              resolve('Finalized');
              clearInterval(intervalID);
            }
          }

          start++;
          if (start > max) {
            resolve(`${max * int} seconds max wait reached`);
            clearInterval(intervalID);
          }
        } catch (error) {
          console.error("Error checking transaction status:", error);
          resolve('Error checking status');
          clearInterval(intervalID);
        }
      }, int * 1000);
    });
  }

  // Method to compute the required compute units for a transaction
  async ComputeLimit(
    cluster: string,
    payer: { publicKey: PublicKey },
    instructions: TransactionInstruction[],
    tolerance: number,
    blockhash: string,
    tables: any[] = []
  ): Promise<number | { message: string; logs: string[] }> {
    const connection = new Connection(cluster, 'confirmed');
    const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 });
    const txInstructions = [computeUnitLimitInstruction, ...instructions];

    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: txInstructions,
    }).compileToV0Message(tables);

    const transaction = new VersionedTransaction(message);
    const simulationResult = await connection.simulateTransaction(transaction, { replaceRecentBlockhash: true, sigVerify: false });

    if (simulationResult.value.err) {
      return { message: "Error during simulation", logs: simulationResult.value.logs };
    }

    const consumedUnits = simulationResult.value.unitsConsumed;
    const optimizedComputeUnits = Math.ceil(consumedUnits * tolerance);
    return optimizedComputeUnits;
  }

  // Method to estimate the transaction fee
  async FeeEstimate(
    cluster: string,
    payer: { publicKey: PublicKey },
    priorityLevel: PriorityLevel,
    instructions: TransactionInstruction[],
    blockhash: string,
    tables: any[] = []
  ): Promise<number> {
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToV0Message(tables);

    const transaction = new VersionedTransaction(message);
    const serializedTransaction = bs58.encode(transaction.serialize());

    try {
      const response = await fetch(`${cluster}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "getPriorityFeeEstimate",
          params: [
            {
              transaction: serializedTransaction,
              options: { priorityLevel },
            },
          ],
        }),
      });

      const data = await response.json();
      const feeEstimate = parseInt(data.result.priorityFeeEstimate, 10);

      return Math.max(feeEstimate, 10000); // Ensure a minimum fee estimate
    } catch (error) {
      console.error("Error estimating fee:", error);
      throw new Error("Failed to estimate fee");
    }
  }

  // Main method to build and prepare the transaction
  async tx(options: TxOptions): Promise<any> {
    const {
      rpc,
      account,
      instructions,
      signers = false,
      priority = "Medium",
      tolerance = 1.1,
      serialize = false,
      encode = false,
      table = [],
      compute = true,
      fees = true
    } = options;

    if (!rpc || !account || !instructions) {
      return { message: "Missing required parameters" };
    }

    const payerPublicKey = new PublicKey(account);
    const connection = new Connection(rpc, "confirmed");
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const payer = { publicKey: payerPublicKey };

    let txInstructions = [...instructions];

    if (compute) {
      const computeLimit = await this.ComputeLimit(rpc, payer, txInstructions, tolerance, blockhash, table);
      if (typeof computeLimit === 'object' && computeLimit.logs) {
        return computeLimit;
      }
      txInstructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: computeLimit }));
    }

    if (fees) {
      const feeEstimate = await this.FeeEstimate(rpc, payer, priority, txInstructions, blockhash, table);
      txInstructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: feeEstimate }));
    }

    const message = new TransactionMessage({
      payerKey: payerPublicKey,
      recentBlockhash: blockhash,
      instructions: txInstructions,
    }).compileToV0Message(table);

    const transaction = new VersionedTransaction(message);

    if (signers) {
      transaction.sign(signers);
    }

    let resultTransaction = transaction;

    if (serialize) {
      resultTransaction = transaction.serialize();
    }

    if (encode) {
      resultTransaction = Buffer.from(resultTransaction).toString("base64");
    }

    return {
      message: serialize || encode ? "Success" : "Transaction built successfully",
      transaction: resultTransaction
    };
  }
}

const buildor = new Build();
export default buildor;
