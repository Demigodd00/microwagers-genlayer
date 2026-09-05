import assert from "node:assert/strict";
import test from "node:test";
import { assertSuccessfulExecution } from "../src/lib/receipt";

const successful = { status: 7, result: 6, consensus_data: { leader_receipt: [{ execution_result: "SUCCESS", result: { status: "return", payload: { readable: "null" } } }] } };
const rejected = { status: 7, result: 6, consensus_data: { leader_receipt: [{ execution_result: "ERROR", result: { status: "rollback", payload: "[EXPECTED] wager is not live" } }] } };

test("a finalized StudioNet leader success is accepted without a normalized result", () => {
  assert.doesNotThrow(() => assertSuccessfulExecution(successful));
});

test("a finalized contract rejection exposes the contract reason", () => {
  assert.throws(() => assertSuccessfulExecution(rejected), /wager is not live/);
});

test("finality without execution evidence is never treated as success", () => {
  assert.throws(() => assertSuccessfulExecution({ status: 7, result: 6 }), /did not confirm successful execution/);
  assert.throws(() => assertSuccessfulExecution(null), /did not confirm successful execution/);
});

test("normalized SDK success remains supported when no leader result is present", () => {
  assert.doesNotThrow(() => assertSuccessfulExecution({ txExecutionResultName: "FINISHED_WITH_RETURN" }));
});

test("rollback and VM failures override a conflicting success label", () => {
  assert.throws(() => assertSuccessfulExecution({ consensus_data: { leader_receipt: { execution_result: "SUCCESS", result: { status: "rollback", payload: "rolled back" } } } }), /rolled back/);
  assert.throws(() => assertSuccessfulExecution({ consensus_data: { leader_receipt: { execution_result: "SUCCESS", genvm_result: { error_description: "VM failed" } } } }), /VM failed/);
});
