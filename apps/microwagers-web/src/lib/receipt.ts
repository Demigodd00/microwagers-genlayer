import { abi } from "genlayer-js";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function leaderOf(receipt: unknown): Record<string, unknown> {
  const tx = object(receipt);
  const consensus = object(tx.consensus_data ?? tx.consensusData);
  const leaders = consensus.leader_receipt ?? consensus.leaderReceipt;
  return object(Array.isArray(leaders) ? leaders[0] : leaders);
}

function resultOf(leader: Record<string, unknown>): Record<string, unknown> {
  if (typeof leader.result !== "string") return object(leader.result);
  try {
    const bytes = Uint8Array.from(atob(leader.result), (character) => character.charCodeAt(0));
    if (bytes[0] === 0) return { status: "return", payload: { raw: Array.from(bytes.slice(1)) } };
    return { status: "error", payload: new TextDecoder().decode(bytes.slice(1)) };
  } catch { return {}; }
}

export class ContractActionError extends Error {
  constructor(message: string, public readonly refundable = false) {
    super(message);
    this.name = "ContractActionError";
  }
}

/** A successful VM execution may return a rejected/refundable business action. */
export function assertSuccessfulAction(receipt: unknown, method: string): unknown {
  assertSuccessfulExecution(receipt);
  const result = resultOf(leaderOf(receipt));
  const payload = object(result.payload);
  let value: unknown;
  try {
    if (result.status !== "return") throw new Error("Missing return envelope");
    if (Array.isArray(payload.raw)) {
      if (!payload.raw.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) throw new Error("Invalid return bytes");
      value = abi.calldata.decode(Uint8Array.from(payload.raw));
    } else if (typeof payload.readable === "string") {
      value = JSON.parse(payload.readable);
    } else {
      throw new Error("Missing return value");
    }
  } catch {
    throw new ContractActionError("Transaction finalized, but its action result could not be verified. Check the transaction before retrying.");
  }
  if (typeof value === "string" && /^\[(REFUNDABLE|REJECTED)\]/.test(value)) {
    const refundable = value.startsWith("[REFUNDABLE]");
    const reason = value.replace(/^\[(?:REFUNDABLE|REJECTED)\]\s*/, "").replace(/\[EXPECTED\]\s*/g, "").replace(/; claim the credited GEN from the app\.?$/, "");
    throw new ContractActionError(`Action not completed: ${reason}.${refundable ? " Your test GEN was credited for withdrawal; use Claim GEN." : ""}`, refundable);
  }
  const expected: Record<string, string | null> = {
    accept_wager: "MATCHED", appeal_wager: "APPEAL_QUEUED", resolve_appeal: "APPEAL_RESOLVED",
    claim_funds: "FUNDS_CLAIMED", cancel_wager: null, resolve_wager: null,
    void_unresolved: null, void_pending_appeal: null, claim: null,
  };
  if (method === "create_wager" ? typeof value !== "string" || !/^w-[1-9]\d*$/.test(value)
    : !(method in expected) || value !== expected[method]) {
    throw new ContractActionError(value === "NO_CLAIMABLE_FUNDS"
      ? "No GEN is currently claimable for this wallet."
      : "The transaction did not confirm the requested action. Check its result before retrying.");
  }
  return value;
}

/** Finality is not execution success. StudioNet returns leader receipts. */
export function assertSuccessfulExecution(receipt: unknown): void {
  const tx = object(receipt);
  const leader = leaderOf(receipt);
  const result = resultOf(leader);
  const vm = object(leader.genvm_result ?? leader.genvmResult);
  const execution = leader.execution_result ?? leader.executionResult;
  const explicitFailure = Boolean(tx.error || vm.error_code || vm.error_description)
    || result.status === "rollback" || result.status === "error" || result.status === "contract_error";

  if (!explicitFailure && execution === "SUCCESS") return;
  if (!explicitFailure && execution === undefined && tx.txExecutionResultName === "FINISHED_WITH_RETURN") return;

  const payload = result.payload;
  const candidates = [
    typeof payload === "string" ? payload : object(payload).readable,
    vm.error_description,
    typeof tx.error === "string" ? tx.error : object(tx.error).message,
  ];
  const reason = candidates.find((value) => typeof value === "string" && value.trim());
  throw new Error(typeof reason === "string"
    ? reason
    : "GenLayer did not confirm successful execution. Check the transaction before retrying.");
}
