"""Offline regressions: no signers, network calls, or new StudioNet transactions."""

from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.microwagers_acceptance import Acceptance


JOURNAL = Path(__file__).resolve().parents[2] / "deployments/micro_wagers_milestone1_v131_acceptance.json"


@pytest.mark.parametrize("checkpoint", ["queued", "resolved-before-record", "settled"])
def test_full_run_resumes_after_original_ruling_without_resubmitting(monkeypatch, checkpoint):
    saved = json.loads(JOURNAL.read_text(encoding="utf-8"))
    runner = object.__new__(Acceptance)
    runner.record = deepcopy(saved)
    runner.record.pop("result")
    runner.address = saved["contract"]
    runner.accounts = {role: SimpleNamespace(address=address) for role, address in saved["wallets"].items()}
    state = {"phase": checkpoint}
    if checkpoint != "settled":
        runner.record["assertions"].pop("appeal-reviewed")
    if checkpoint == "queued":
        runner.record["assertions"].pop("appeal-queued")

    monkeypatch.setattr(runner, "save", lambda: None)
    monkeypatch.setattr(runner, "preflight", lambda: None)
    monkeypatch.setattr(runner, "wait_until", lambda *args: None)
    monkeypatch.setattr(runner, "verify_transfer", lambda *args: None)

    def read(method, args):
        if method == "get_claimable_balance":
            return "0"
        if method == "get_accounting":
            return deepcopy(saved["final_accounting"])
        if method == "get_stats":
            return deepcopy(saved["final_stats"])
        assert method == "get_wager"
        if args == ["w-1"]:
            key = "cancellation-voided"
        elif args == ["w-2"]:
            key = "recovery-voided"
        else:
            key = {"queued": "appeal-queued", "resolved-before-record": "appeal-reviewed", "settled": "lifecycle-settled"}[state["phase"]]
        return deepcopy(saved["assertions"][key]["observed"])

    # Completed transaction steps must be reused, never broadcast again.
    def recorded_write(step, method, args, **kwargs):
        entry = runner.record["transactions"][step]
        assert entry["checked"] is True
        assert entry["method"] == method and entry["args"] == args
        if step == "resolve-appeal" and state["phase"] == "queued":
            state["phase"] = "resolved-before-record"
        if step == "claim-wager":
            state["phase"] = "settled"
        return entry

    monkeypatch.setattr(runner, "read", read)
    monkeypatch.setattr(runner, "write", recorded_write)
    runner.run()
    assert runner.record["result"] == "PASS"
    assert runner.record["assertions"]["appeal-reviewed"]["observed"]["original_record"] == saved["assertions"]["resolved-decisively"]["observed"]["original_record"]


def test_completed_journal_never_writes(monkeypatch):
    runner = object.__new__(Acceptance)
    runner.record = {"result": "PASS"}
    runner.address = "0x" + "1" * 40
    monkeypatch.setattr(runner, "preflight", lambda: None)
    monkeypatch.setattr(runner, "write", lambda *args, **kwargs: pytest.fail("Completed journal must not write"))
    runner.run()


def test_native_child_can_finalize_after_parent(monkeypatch):
    runner = object.__new__(Acceptance)
    results = iter([None, {"status": "PENDING"}, {"status": "FINALIZED", "value_credited": True}])
    monkeypatch.setattr(runner, "rpc", lambda *args: {"result": next(results)})
    monkeypatch.setattr("scripts.microwagers_acceptance.time.sleep", lambda seconds: None)
    assert runner.finalized_transfer("0xchild")["value_credited"] is True


def test_uncredited_native_child_is_not_success(monkeypatch):
    runner = object.__new__(Acceptance)
    monkeypatch.setattr(runner, "rpc", lambda *args: {"result": {"status": "FINALIZED", "value_credited": False}})
    with pytest.raises(AssertionError, match="without a value credit"):
        runner.finalized_transfer("0xchild")


def test_pending_native_child_has_bounded_retry_without_rebroadcast(monkeypatch):
    runner = object.__new__(Acceptance)
    reads = []
    def rpc(method, args):
        assert method == "eth_getTransactionByHash"
        reads.append(args[0])
        return {"result": {"status": "PENDING"}}
    monkeypatch.setattr(runner, "rpc", rpc)
    monkeypatch.setattr("scripts.microwagers_acceptance.time.sleep", lambda seconds: None)
    with pytest.raises(RuntimeError, match="without resubmitting"):
        runner.finalized_transfer("0xchild")
    assert reads == ["0xchild"] * 60
