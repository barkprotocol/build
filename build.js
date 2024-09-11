'use strict';

// *********************************************************************************
// name: build.js
// author: @bark_protocol
// license: MIT https://github.com/barkprotocol/build/blob/main/LICENSE
// *********************************************************************************

import { PublicKey, Connection, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from 'bs58';

class Build {
    constructor() {
        this.name = "build";
    }

    /**
     * Checks the status of a transaction signature until it is finalized or a timeout occurs.
     * @param {string} cluster - The Solana cluster URL.
     * @param {string} sig - The transaction signature to check.
     * @param {number} [max=10] - The maximum number of intervals to check before timing out.
     * @param {number} [int=4] - The interval in seconds between status checks.
     * @returns {Promise<string>} - A promise that resolves to the status of the transaction.
     */
    async status(cluster, sig, max = 10, int = 4) {
        return new Promise(resolve => {
            let start = 1;
            const connection = new Connection(cluster, "confirmed");

            const intervalID = setInterval(async () => {
                const txStatus = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });
                console.log(`${start}: ${sig}`);
                if (txStatus && txStatus.value) {
                    console.log(txStatus.value);
                } else {
                    console.log("failed to get status...");
                }

                if (txStatus?.value?.[0]?.confirmationStatus === "finalized") {
                    if (txStatus.value[0].err) {
                        resolve('program error!');
                        clearInterval(intervalID);
                    } else {
                        resolve('finalized');
                        clearInterval(intervalID);
                    }
                } else if (start >= max) {
                    resolve(`${max * int} seconds max wait reached`);
                    clearInterval(intervalID);
                }

                start++;
            }, int * 1000);
        });
    }

    /**
     * Estimates the compute unit limit required for a set of instructions.
     * @param {string} cluster - The Solana cluster URL.
     * @param {Object} optiPayer - The payer for the transaction.
     * @param {Array} optiIx - Array of instructions for the transaction.
     * @param {number} optiTolerance - Tolerance for compute units estimation.
     * @param {string} blockhash - The recent blockhash.
     * @param {boolean} [optiTables=false] - Whether to include the transaction table.
     * @returns {Promise<number|Object>} - A promise that resolves to the compute unit limit or an error object.
     */
    async ComputeLimit(cluster, optiPayer, optiIx, optiTolerance, blockhash, optiTables = false) {
        const connection = new Connection(cluster, 'confirmed');
        const optiSimLimit = ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 });
        const instructions = [optiSimLimit, ...optiIx];
        const optiMsg = new TransactionMessage({
            payerKey: optiPayer.publicKey,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message(optiTables);

        const optiTx = new VersionedTransaction(optiMsg);
        const optiCuRes = await connection.simulateTransaction(optiTx, { replaceRecentBlockhash: true, sigVerify: false });
        console.log("Simulation Results: ", optiCuRes.value);

        if (optiCuRes.value.err) {
            return { "message": "error during simulation", "logs": optiCuRes.value.logs };
        }

        const optiConsumed = optiCuRes.value.unitsConsumed;
        const optiCuLimit = Math.ceil(optiConsumed * optiTolerance);
        return optiCuLimit;
    }

    /**
     * Estimates the priority fee required for a transaction.
     * @param {string} cluster - The Solana cluster URL.
     * @param {Object} payer - The payer for the transaction.
     * @param {string} priorityLevel - The priority level for fee estimation.
     * @param {Array} instructions - Array of instructions for the transaction.
     * @param {string} blockhash - The recent blockhash.
     * @param {boolean} [tables=false] - Whether to include the transaction table.
     * @returns {Promise<number>} - A promise that resolves to the estimated fee.
     */
    async FeeEstimate(cluster, payer, priorityLevel, instructions, blockhash, tables = false) {
        const connection = new Connection(cluster, 'confirmed');
        const _msg = new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message(tables);

        const tx = new VersionedTransaction(_msg);
        const response = await fetch(cluster, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "1",
                method: "getPriorityFeeEstimate",
                params: [{
                    transaction: bs58.encode(tx.serialize()), // Serialize transaction in Base58
                    options: { priorityLevel },
                }],
            }),
        });

        const data = await response.json();
        console.log("estimate response:", data);
        const estimatedFee = parseInt(data.result.priorityFeeEstimate);
        return Math.max(estimatedFee, 10000);
    }

    /**
     * Constructs and optionally serializes and/or encodes a transaction.
     * @param {Object} _data_ - The transaction data.
     * @returns {Promise<Object>} - A promise that resolves to the transaction object or error message.
     */
    async tx(_data_) {
        const _obj_ = {};
        let {
            rpc: _rpc_,
            account: _account_,
            instructions: _instructions_,
            signers: _signers_ = false,
            priority: _priority_ = "Medium",
            tolerance: _tolerance_ = "1.1",
            serialize: _serialize_ = false,
            encode: _encode_ = false,
            tables: _table_ = false,
            compute: _compute_ = true,
            fees: _fees_ = true,
        } = _data_;

        if (!_rpc_) return { message: "missing rpc" };
        if (!_account_) return { message: "missing account" };
        if (!_instructions_) return { message: "missing instructions" };

        const wallet = new PublicKey(_account_);
        const connection = new Connection(_rpc_, "confirmed");
        const blockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
        if (_priority_ === "Extreme") _priority_ = "VeryHigh";
        const payer = { publicKey: wallet };

        if (_compute_) {
            const computeLimit = await this.ComputeLimit(_rpc_, payer, _instructions_, _tolerance_, blockhash, _table_);
            if (computeLimit.logs) {
                return { message: "error when simulating the transaction", logs: computeLimit.logs };
            } else if (computeLimit === null) {
                return { message: "error when optimizing compute limit" };
            }
            _instructions_.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: computeLimit }));
        }

        if (_fees_) {
            const priorityFee = await this.FeeEstimate(_rpc_, payer, _priority_, _instructions_, blockhash, _table_);
            _instructions_.unshift(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }));
        }

        const message = new TransactionMessage({
            payerKey: wallet,
            recentBlockhash: blockhash,
            instructions: _instructions_,
        }).compileToV0Message(_table_);

        const tx = new VersionedTransaction(message);
        if (_signers_) tx.sign(_signers_);
        if (_serialize_) {
            const serializedTx = tx.serialize();
            return _encode_ ? Buffer.from(serializedTx).toString("base64") : serializedTx;
        }

        return { message: "success", transaction: tx };
    }
}

const buildor = new Build();
export default buildor;
