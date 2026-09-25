/** Read-only: verify the UI result parser against the existing StudioNet journal. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeLocalnetTransaction, simplifyTransactionReceipt } from "genlayer-js";
import { assertSuccessfulAction, ContractActionError } from "../src/lib/receipt";

async function main() {
  const journal = JSON.parse(readFileSync(new URL("../../../deployments/micro_wagers_milestone1_v131_acceptance.json", import.meta.url), "utf8"));
  const checks: string[] = [];
  for (const [name, step] of Object.entries(journal.transactions) as [string, { transaction_hash: string; method: string; expected_error?: string; expected_credit?: boolean }][]) {
    const response = await fetch("https://studio.genlayer.com/api", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [step.transaction_hash] }),
      signal: AbortSignal.timeout(30_000),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.error, undefined);
    assert.equal(payload.result?.status, "FINALIZED");
    const normalized = decodeLocalnetTransaction(structuredClone(payload.result));
    for (const receipt of [payload.result, normalized, simplifyTransactionReceipt(normalized)]) {
      if (step.expected_credit) {
        assert.throws(() => assertSuccessfulAction(receipt, step.method), (error: unknown) =>
          error instanceof ContractActionError && error.refundable && error.message.includes(step.expected_error ?? ""));
      } else if (step.expected_error) {
        assert.throws(() => assertSuccessfulAction(receipt, step.method));
      } else {
        assert.doesNotThrow(() => assertSuccessfulAction(receipt, step.method));
      }
    }
    checks.push(name);
    console.log(`PASS ${name}: raw, SDK-normalized, and simplified result`);
    await new Promise((resolve) => setTimeout(resolve, 2100));
  }
  console.log(JSON.stringify({ result: "PASS", mode: "read-only historical receipts", contract: journal.contract, checked: checks.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
