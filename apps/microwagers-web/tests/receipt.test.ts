import assert from "node:assert/strict";
import test from "node:test";
import { abi } from "genlayer-js";
import { assertSuccessfulExecution, assertSuccessfulAction, ContractActionError } from "../src/lib/receipt";
import { friendlyError } from "../src/lib/contract";

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

function returned(value: string | null) {
  return { consensus_data: { leader_receipt: [{ execution_result: "SUCCESS", result: { status: "return", payload: { readable: JSON.stringify(value) } } }] } };
}

test("successful execution is not enough to confirm a refunded creation or appeal", () => {
  for (const method of ["create_wager", "accept_wager", "appeal_wager"]) {
    for (const prefix of ["[REFUNDABLE]", "[REJECTED]"]) {
      const receipt = returned(`${prefix} [EXPECTED] deadline has passed; claim the credited GEN from the app.`);
      assert.doesNotThrow(() => assertSuccessfulExecution(receipt));
      assert.throws(() => assertSuccessfulAction(receipt, method), (error: unknown) => {
        assert.ok(error instanceof ContractActionError);
        assert.equal(error.refundable, prefix === "[REFUNDABLE]");
        assert.match(friendlyError(error), /Action not completed: deadline has passed/);
        if (error.refundable) assert.match(friendlyError(error), /credited for withdrawal/);
        return true;
      });
    }
  }
});

test("raw StudioNet result bytes from the live journal's transactions decode correctly", () => {
  const receipt = (result: string) => ({ consensus_data: { leader_receipt: [{ execution_result: "SUCCESS", result }] } });
  assert.equal(assertSuccessfulAction(receipt("ABx3LTM="), "create_wager"), "w-3");
  assert.throws(() => assertSuccessfulAction(receipt("ALQGW1JFRlVOREFCTEVdIFtFWFBFQ1RFRF0gbXVzdCBzdGFrZSBleGFjdGx5IDEwMDAwMDAwMDAwMDAwMDAgYXR0bzsgY2xhaW0gdGhlIGNyZWRpdGVkIEdFTiBmcm9tIHRoZSBhcHAu"), "accept_wager"), /credited for withdrawal/);
});

test("all write actions require their specific result and fail closed on missing payloads", () => {
  for (const [method, value] of Object.entries({ create_wager: "w-42", accept_wager: "MATCHED", appeal_wager: "APPEAL_QUEUED", resolve_appeal: "APPEAL_RESOLVED", claim_funds: "FUNDS_CLAIMED", claim: null, cancel_wager: null, resolve_wager: null, void_unresolved: null, void_pending_appeal: null })) {
    assert.equal(assertSuccessfulAction(returned(value), method), value);
    assert.throws(() => assertSuccessfulAction({ txExecutionResultName: "FINISHED_WITH_RETURN" }, method), /could not be verified/);
    assert.throws(() => assertSuccessfulAction(returned("unexpected"), method), /did not confirm/);
  }
  assert.throws(() => assertSuccessfulAction(returned("NO_CLAIMABLE_FUNDS"), "claim_funds"), /No GEN is currently claimable/);
  assert.throws(() => assertSuccessfulAction(returned("w-0"), "create_wager"), /did not confirm/);
});

test("normalized calldata is decoded without trusting a conflicting readable label", () => {
  const receipt = returned("w-3");
  Object.assign(receipt.consensus_data.leader_receipt[0].result.payload, { raw: Array.from(abi.calldata.encode("[REFUNDABLE] invalid stake")) });
  assert.throws(() => assertSuccessfulAction(receipt, "create_wager"), /credited for withdrawal/);
});
