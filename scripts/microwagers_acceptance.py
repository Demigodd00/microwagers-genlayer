"""Resume-safe exact-release acceptance for the recorded MicroWagers StudioNet contract.

This script never deploys a contract. It uses the saved deployment signer plus a
domain-separated test account, records every transaction before broadcasting,
and resumes recorded hashes instead of blindly submitting duplicate writes.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import time
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

import requests
from eth_account import Account
from genlayer_py.assertions import tx_execution_succeeded
from genlayer_py.chains import studionet
from genlayer_py.client.genlayer_client import GenLayerClient
from web3 import Web3
from web3.logs import DISCARD

ROOT = Path(__file__).resolve().parents[1]
DEPLOYMENT_PATH = ROOT / "deployments" / "micro_wagers_studionet.json"
RECORD_PATH = ROOT / "deployments" / "micro_wagers_milestone1_v131_acceptance.json"
ENV_PATH = ROOT / ".env"
RPC_URL = "https://studio.genlayer.com/api"
STAKE = 10**15


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def output(value) -> None:
    print(json.dumps(value, default=str), flush=True)


def load_saved_signer() -> str:
    if os.environ.get("MICROWAGERS_PRIVATE_KEY"):
        return os.environ["MICROWAGERS_PRIVATE_KEY"].strip()
    if not ENV_PATH.exists():
        raise RuntimeError("The saved StudioNet signer was not found")
    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == "STREAKPACT_PRIVATE_KEY":
            value = value.strip().strip('"').strip("'")
            if value:
                return value
    raise RuntimeError("The saved StudioNet signer was not found")


def error_text(value) -> list[str]:
    texts: list[str] = []
    if isinstance(value, dict):
        for item in value.values():
            texts.extend(error_text(item))
    elif isinstance(value, (list, tuple)):
        for item in value:
            texts.extend(error_text(item))
    elif isinstance(value, str):
        texts.append(value)
        if 8 <= len(value) <= 100_000 and re.fullmatch(r"[A-Za-z0-9+/=]+", value):
            try:
                texts.append(base64.b64decode(value, validate=True).decode("utf-8", errors="ignore"))
            except (ValueError, TypeError):
                pass
    return texts


class Acceptance:
    def __init__(self) -> None:
        self.deployment = json.loads(DEPLOYMENT_PATH.read_text(encoding="utf-8"))
        if self.deployment.get("network") != "studionet":
            raise RuntimeError("Acceptance writes are restricted to StudioNet")
        owner = Account.from_key(load_saved_signer())
        if owner.address.lower() != str(self.deployment.get("deployer", "")).lower():
            raise RuntimeError("The saved signer does not match the recorded deployer")
        tester = Account.from_key(
            hmac.new(owner.key, b"microwagers/studionet/acceptance/tester/v1", hashlib.sha256).digest()
        )
        observer = Account.from_key(
            hmac.new(owner.key, b"microwagers/studionet/acceptance/observer/v1", hashlib.sha256).digest()
        )
        self.accounts = {"creator": owner, "tester": tester, "observer": observer}
        self.address = self.deployment["address"]
        self.role = "creator"
        self.active_step: str | None = None
        self.last_request = 0.0
        self.http = requests.Session()
        self.client = GenLayerClient(deepcopy(studionet), owner)
        self.client.provider.make_request = self.rpc
        self.client.initialize_consensus_smart_contract()

        if RECORD_PATH.exists():
            self.record = json.loads(RECORD_PATH.read_text(encoding="utf-8"))
            if self.record.get("contract", "").lower() != self.address.lower():
                raise RuntimeError("Existing acceptance record belongs to another release")
        else:
            self.record = {
                "network": "studionet",
                "contract": self.address,
                "source_sha256": self.deployment["source_sha256"],
                "started_at": timestamp(),
                "transactions": {},
                "assertions": {},
                "wagers": {},
            }
        self.record["wallets"] = {name: account.address for name, account in self.accounts.items()}
        self.save()

    def save(self) -> None:
        self.record["updated_at"] = timestamp()
        pending = RECORD_PATH.with_suffix(".json.tmp")
        pending.write_text(json.dumps(self.record, indent=2, default=str) + "\n", encoding="utf-8")
        for attempt in range(6):
            try:
                pending.replace(RECORD_PATH)
                return
            except PermissionError:
                if attempt == 5:
                    raise
                time.sleep(0.25 * (attempt + 1))

    def rpc(self, method: str, params: list) -> dict:
        if method == "eth_sendRawTransaction" and self.active_step:
            entry = self.record["transactions"][self.active_step]
            entry["broadcast_attempted"] = True
            entry["evm_transaction_hash"] = Web3.to_hex(Web3.keccak(hexstr=params[0]))
            self.save()
        attempts = 1 if method == "eth_sendRawTransaction" else 5
        payload = None
        last_error = None
        for attempt in range(attempts):
            delay = 2.25 - (time.monotonic() - self.last_request)
            if delay > 0:
                time.sleep(delay)
            self.last_request = time.monotonic()
            try:
                response = self.http.post(
                    RPC_URL,
                    json={"jsonrpc": "2.0", "id": int(time.time() * 1000), "method": method, "params": params},
                    timeout=(10, 120),
                )
                response.raise_for_status()
                payload = response.json()
                break
            except (requests.RequestException, ValueError) as error:
                last_error = error
                if attempt + 1 == attempts:
                    raise
                time.sleep(min(10, 2 ** attempt))
        if payload is None:
            raise RuntimeError(f"{method}: RPC failed after retries: {last_error}")
        if payload.get("error"):
            error = payload["error"]
            raise RuntimeError(f"{method}: RPC {error.get('code')}: {error.get('message')}")
        if method == "eth_sendRawTransaction" and self.active_step:
            self.record["transactions"][self.active_step]["evm_transaction_hash"] = payload["result"]
            self.save()
        return payload

    def use_role(self, role: str) -> None:
        self.role = role
        self.client.local_account = self.accounts[role]

    def read(self, method: str, args: list):
        last_error: Exception | None = None
        for delay in (0, 2, 5):
            if delay:
                time.sleep(delay)
            try:
                return self.client.read_contract(address=self.address, function_name=method, args=args)
            except Exception as error:
                last_error = error
        raise RuntimeError(f"StudioNet read failed after retries: {last_error}")

    def preflight(self) -> None:
        source = base64.b64decode(self.rpc("gen_getContractCode", [self.address])["result"])
        digest = hashlib.sha256(source.replace(b"\r\n", b"\n")).hexdigest()
        if digest != self.deployment["source_sha256"]:
            raise RuntimeError("Deployed source differs from the recorded release")
        stats = self.read("get_stats", [])
        expected = {
            "fee_bps": "0",
            "appeal_window_secs": "300",
            "resolution_timeout_secs": "600",
            "experimental": True,
            "max_page_size": "25",
            "max_source_bytes": "25000",
            "max_source_chars": "8000",
            "max_sources": "2",
            "source_policy": "TWO_DISTINCT_HOSTS_UNANIMOUS_CITED_FINDINGS_FROZEN_APPEALS",
            "version": "1.3.1-studionet",
        }
        if any(stats.get(key) != value for key, value in expected.items()):
            raise RuntimeError("The exact-release configuration is not active")
        if stats.get("treasury", "").lower() != self.accounts["creator"].address.lower():
            raise RuntimeError("The exact-release treasury does not match its public record")
        self.record["preflight"] = {
            "checked_at": timestamp(),
            "source_matches": True,
            "configuration_matches": True,
            "stats": stats,
        }
        self.save()
        output({"phase": "preflight", "passed": True, "contract": self.address, "stats": stats})

    def write(
        self,
        step: str,
        method: str,
        args: list,
        value: int = 0,
        role: str = "creator",
        expected_error: str | None = None,
        expected_credit: bool = False,
    ) -> dict:
        self.use_role(role)
        entries = self.record["transactions"]
        entry = entries.get(step)
        signature = (method, args, role, str(value), expected_error, expected_credit)
        if entry:
            recorded = (
                entry["method"], entry["args"], entry["role"], entry["value_atto"],
                entry["expected_error"], entry.get("expected_credit", False),
            )
            if recorded != signature:
                raise RuntimeError(f"Recorded step {step} has different transaction arguments")
            if entry.get("checked"):
                return entry
        else:
            entry = {
                "method": method,
                "args": args,
                "role": role,
                "sender": self.accounts[role].address,
                "value_atto": str(value),
                "expected_error": expected_error,
                "expected_credit": expected_credit,
                "started_at": timestamp(),
                "broadcast_attempted": False,
            }
            entries[step] = entry
            self.save()

        if "claimable_before_atto" not in entry:
            entry["claimable_before_atto"] = self.read(
                "get_claimable_balance", [self.accounts[role].address]
            )
            self.save()

        self.active_step = step
        if entry.get("broadcast_attempted") and not entry.get("transaction_hash"):
            receipt = self.client.w3.eth.get_transaction_receipt(entry["evm_transaction_hash"])
            consensus = self.client.w3.eth.contract(abi=self.client.chain.consensus_main_contract["abi"])
            events = consensus.get_event_by_name("NewTransaction").process_receipt(receipt, DISCARD)
            if not events:
                raise RuntimeError("Broadcast has no recoverable GenLayer transaction; do not resubmit")
            entry["transaction_hash"] = Web3.to_hex(events[0]["args"]["txId"])
            self.save()
        if not entry.get("transaction_hash"):
            output({"step": step, "state": "submitting", "method": method, "role": role})
            submitted = self.client.write_contract(
                address=self.address, function_name=method, args=args, value=value
            )
            entry["transaction_hash"] = submitted if isinstance(submitted, str) else Web3.to_hex(submitted)
            self.save()

        output({"step": step, "transaction_hash": entry["transaction_hash"]})
        deadline = time.monotonic() + 900
        previous_status = None
        while time.monotonic() < deadline:
            receipt = self.rpc("eth_getTransactionByHash", [entry["transaction_hash"]])["result"]
            if not receipt:
                time.sleep(5)
                continue
            status = receipt.get("status")
            if status != previous_status:
                output({"step": step, "status": status})
                previous_status = status
            if status == "FINALIZED":
                success = tx_execution_succeeded(receipt)
                leaders = receipt.get("consensus_data", {}).get("leader_receipt", [])
                if isinstance(leaders, dict):
                    leaders = [leaders]
                entry.update(
                    {
                        "status": status,
                        "execution_succeeded": success,
                        "leader_execution_result": leaders[0].get("execution_result") if leaders else None,
                        "triggered_transactions": receipt.get("triggered_transactions", []),
                        "finished_at": timestamp(),
                    }
                )
                if expected_credit:
                    if not success:
                        entry["failure_detail"] = leaders[0].get("genvm_result") if leaders else None
                        self.save()
                        raise RuntimeError(f"{step}: payable failure did not become a successful refund credit")
                    current_claimable = int(self.read(
                        "get_claimable_balance", [self.accounts[role].address]
                    ))
                    delta = current_claimable - int(entry["claimable_before_atto"])
                    if delta != value:
                        self.save()
                        raise RuntimeError(f"{step}: expected {value} atto in a claimable refund, found {delta}")
                    entry["claimable_after_atto"] = str(current_claimable)
                    entry["claimable_delta_atto"] = str(delta)
                    entry["refund_reason"] = expected_error
                elif expected_error:
                    if success or not any(expected_error.lower() in text.lower() for text in error_text(receipt)):
                        self.save()
                        raise RuntimeError(f"{step}: expected contract rejection was not verified")
                elif not success:
                    entry["failure_detail"] = leaders[0].get("genvm_result") if leaders else None
                    self.save()
                    raise RuntimeError(f"{step}: transaction finalized with a contract execution failure")
                entry["checked"] = True
                self.save()
                output({"step": step, "passed": True, "execution_succeeded": success})
                return entry
            time.sleep(5)
        raise RuntimeError(f"{step}: still pending; resume this same step instead of resubmitting")

    def assert_fields(self, key: str, actual: dict, expected: dict) -> dict:
        existing = self.record["assertions"].get(key)
        if existing:
            if existing["expected"] != expected:
                raise RuntimeError(f"Historical assertion {key} has different expectations")
            return existing["observed"]
        for field, value in expected.items():
            if actual.get(field) != value:
                raise AssertionError(f"{key}: {field} is {actual.get(field)!r}, expected {value!r}")
        self.record["assertions"][key] = {
            "checked_at": timestamp(),
            "expected": expected,
            "observed": actual,
        }
        self.save()
        output({"assertion": key, "passed": True, "expected": expected})
        return actual

    def claimable_balance(self, role: str) -> int:
        return int(self.read("get_claimable_balance", [self.accounts[role].address]))

    def claimable_snapshot(self, step: str, roles: list[str]) -> dict[str, int]:
        snapshots = self.record.setdefault("claimable_snapshots", {})
        if step not in snapshots:
            snapshots[step] = {
                role: str(self.claimable_balance(role)) for role in roles
            }
            self.save()
        return {role: int(value) for role, value in snapshots[step].items()}

    def assert_claimable_delta(
        self, key: str, before: dict[str, int], expected_deltas: dict[str, int]
    ) -> None:
        existing = self.record["assertions"].get(key)
        expected = {role: str(amount) for role, amount in expected_deltas.items()}
        if existing:
            if existing["expected"] != expected:
                raise RuntimeError(f"Historical claimable assertion {key} has different expectations")
            return
        observed = {role: self.claimable_balance(role) - before[role] for role in expected_deltas}
        if observed != expected_deltas:
            raise AssertionError(f"{key}: claimable deltas are {observed}, expected {expected_deltas}")
        self.record["assertions"][key] = {
            "checked_at": timestamp(),
            "expected": expected,
            "observed": {role: str(amount) for role, amount in observed.items()},
        }
        self.save()
        output({"assertion": key, "passed": True, "claimable_deltas": expected})

    def find_wager(self, question: str) -> str:
        matches = []
        offset = 0
        while True:
            page = self.read("list_wagers", [offset, 25])
            matches.extend(item for item in page["items"] if item["question"] == question)
            offset += len(page["items"])
            if offset >= int(page["total"]) or not page["items"]:
                break
        if len(matches) != 1:
            raise RuntimeError(f"Could not uniquely identify acceptance wager: {question}")
        return matches[0]["id"]

    def create(
        self,
        key: str,
        question: str,
        deadline_lead: int,
        source_url: str = "https://example.com/",
        source_url_2: str = "https://example.net/",
    ) -> str:
        step = f"create-{key}"
        existing = self.record["transactions"].get(step)
        args = existing["args"] if existing else [
            question,
            "Yes — the page is for documentation examples",
            "No — the page does not say that",
            source_url,
            source_url_2,
            int(time.time()) + deadline_lead,
        ]
        self.write(step, "create_wager", args, value=STAKE)
        if key not in self.record["wagers"]:
            self.record["wagers"][key] = self.find_wager(question)
            self.save()
        output({"wager": key, "id": self.record["wagers"][key], "deadline_unix": args[5]})
        return self.record["wagers"][key]

    def wait_until(self, unix: int, reason: str) -> None:
        while time.time() <= unix:
            remaining = max(0, unix - time.time())
            output({"waiting_for": reason, "seconds_remaining": round(remaining)})
            time.sleep(min(30, max(1, remaining + 1)))

    def finalized_transfer(self, child_hash: str) -> dict:
        # Native transfers finalize independently of their parent write. Resume
        # the recorded child instead of reporting a transient pending state as loss.
        for attempt in range(60):
            child = self.rpc("eth_getTransactionByHash", [child_hash])["result"]
            if child and child.get("status") == "FINALIZED":
                if child.get("value_credited") is not True:
                    raise AssertionError("Native transfer finalized without a value credit")
                return child
            if child and child.get("status") in {"CANCELED", "CANCELLED", "UNDETERMINED"}:
                raise AssertionError(f"Native transfer ended with status {child['status']}")
            if attempt < 59:
                time.sleep(5)
        raise RuntimeError("Native transfer is still pending; resume the same journal without resubmitting")

    def verify_transfer(self, step: str, recipient: str, value: int) -> None:
        entry = self.record["transactions"][step]
        receipt = self.rpc("eth_getTransactionByHash", [entry["transaction_hash"]])["result"]
        children = receipt.get("triggered_transactions", [])
        if len(children) != 1:
            raise AssertionError(f"{step}: expected exactly one native transfer")
        child = self.finalized_transfer(children[0])
        if child.get("to_address", "").lower() != recipient.lower() or int(child.get("value", 0)) != value:
            raise AssertionError(f"{step}: native transfer recipient or value differs")
        self.record.setdefault("transfer_checks", {})[step] = {
            "checked_at": timestamp(),
            "transaction": children[0],
            "recipient": recipient,
            "value_atto": str(value),
            "status": "FINALIZED",
            "value_credited": True,
        }
        self.save()
        output({"transfer": step, "passed": True, "recipient": recipient, "value_atto": str(value)})

    def verify_transfers(self, step: str, expected: list[tuple[str, int]]) -> None:
        entry = self.record["transactions"][step]
        receipt = self.rpc("eth_getTransactionByHash", [entry["transaction_hash"]])["result"]
        children = receipt.get("triggered_transactions", [])
        if len(children) != len(expected):
            raise AssertionError(f"{step}: expected {len(expected)} native transfers")
        observed = []
        for child_hash in children:
            child = self.finalized_transfer(child_hash)
            observed.append((child.get("to_address", "").lower(), int(child.get("value", 0)), child_hash))
        expected_normalized = sorted((recipient.lower(), value) for recipient, value in expected)
        if sorted((recipient, value) for recipient, value, _ in observed) != expected_normalized:
            raise AssertionError(f"{step}: refund recipients or values differ")
        self.record.setdefault("transfer_checks", {})[step] = {
            "checked_at": timestamp(),
            "transfers": [
                {
                    "transaction": child_hash,
                    "recipient": recipient,
                    "value_atto": str(value),
                    "status": "FINALIZED",
                    "value_credited": True,
                }
                for recipient, value, child_hash in observed
            ],
            "all_value_credited": True,
        }
        self.save()
        output({"transfers": step, "passed": True, "count": len(observed)})

    def run(self) -> None:
        self.preflight()
        if self.record.get("result") == "PASS":
            output({"result": "PASS", "state": "already completed", "contract": self.address})
            return

        cancellation_question = "Release acceptance: cancel an unmatched MicroWagers market?"
        cancelled_id = self.create("cancellation", cancellation_question, 900)
        self.assert_fields(
            "cancellation-open",
            self.read("get_wager", [cancelled_id]),
            {"status": "OPEN", "taker": "", "winner": ""},
        )
        self.write(
            "reject-noncreator-cancel",
            "cancel_wager",
            [cancelled_id],
            role="tester",
            expected_error="only the creator can cancel",
        )
        cancel_before = self.claimable_snapshot("before-cancel", ["creator"])
        self.write("cancel-open-wager", "cancel_wager", [cancelled_id])
        self.assert_fields(
            "cancellation-voided",
            self.read("get_wager", [cancelled_id]),
            {"status": "VOIDED", "taker": "", "winner": ""},
        )
        self.assert_claimable_delta("cancel-refund-credited", cancel_before, {"creator": STAKE})
        output({"phase": "cancellation", "passed": True})

        recovery_question = "Release acceptance: can an unresolved market recover both test stakes?"
        recovery_id = self.create(
            "recovery",
            recovery_question,
            300,
            source_url="https://unavailable.example/microwagers",
            source_url_2="https://example.net/",
        )
        self.write("accept-recovery-wager", "accept_wager", [recovery_id], value=STAKE, role="tester")
        recovery_live = self.assert_fields(
            "recovery-live",
            self.read("get_wager", [recovery_id]),
            {"status": "LIVE", "recoverable": False, "winner": ""},
        )
        self.write(
            "reject-early-recovery",
            "void_unresolved",
            [recovery_id],
            role="observer",
            expected_error="resolution recovery window is still open",
        )

        lifecycle_question = "Release acceptance: do both source pages say the domain is for documentation examples without needing permission?"
        wager_id = self.create("lifecycle", lifecycle_question, 600)
        self.assert_fields(
            "lifecycle-open",
            self.read("get_wager", [wager_id]),
            {"status": "OPEN", "stake_atto": str(STAKE), "taker": "", "winner": ""},
        )
        self.write(
            "reject-creator-self-accept",
            "accept_wager",
            [wager_id],
            value=STAKE,
            expected_error="creator cannot accept own wager",
            expected_credit=True,
        )
        self.assert_fields(
            "self-accept-left-open",
            self.read("get_wager", [wager_id]),
            {"status": "OPEN", "taker": "", "winner": ""},
        )
        self.write(
            "reject-wrong-accept-stake",
            "accept_wager",
            [wager_id],
            value=STAKE * 2,
            role="tester",
            expected_error="must stake exactly",
            expected_credit=True,
        )
        accept_step = "accept-wager"
        self.write(accept_step, "accept_wager", [wager_id], value=STAKE, role="tester")
        live = self.assert_fields(
            "lifecycle-live",
            self.read("get_wager", [wager_id]),
            {"status": "LIVE", "taker": self.accounts["tester"].address, "winner": ""},
        )
        self.write(
            "reject-early-resolution",
            "resolve_wager",
            [wager_id],
            role="tester",
            expected_error="wager is not yet decidable",
        )
        self.wait_until(int(live["deadline_unix"]) + 2, "market deadline")
        self.write("resolve-wager", "resolve_wager", [wager_id], role="tester")
        historical_resolution = self.record["assertions"].get("resolved-decisively")
        if historical_resolution:
            resolved = historical_resolution["observed"]
        else:
            resolved = self.read("get_wager", [wager_id])
            if resolved["status"] != "PROVISIONAL":
                raise AssertionError(f"Expected a decisive provisional verdict, received {resolved['status']}")
            participant_addresses = {
                self.accounts["creator"].address.lower(),
                self.accounts["tester"].address.lower(),
            }
            if resolved["winner"].lower() not in participant_addresses:
                raise AssertionError("The validator returned a winner outside the two participants")
            original_record = resolved.get("original_record", {})
            original_sources = original_record.get("sources", [])
            if (
                original_record.get("exists") is not True
                or re.fullmatch(r"[0-9a-f]{64}", str(original_record.get("source_digest", ""))) is None
                or original_record.get("provenance") != "GENLAYER_VALIDATOR_DUAL_SOURCE_FETCH_AND_SNAPSHOT"
                or len(original_sources) != 2
                or any(not source.get("snapshot") or not source.get("citation") for source in original_sources)
            ):
                raise AssertionError("Dual-source adjudication provenance was not recorded")
            self.record["assertions"]["resolved-decisively"] = {
                "checked_at": timestamp(),
                "expected": {"status": "PROVISIONAL", "participant_winner": True},
                "observed": resolved,
            }
            self.save()
            output({"assertion": "resolved-decisively", "passed": True, "winner": resolved["winner"]})

        # These must also exist when the original ruling was saved in an earlier run.
        original_record = resolved.get("original_record", {})
        original_sources = original_record.get("sources", [])
        winner_role = "creator" if resolved["winner"].lower() == self.accounts["creator"].address.lower() else "tester"
        loser_role = "tester" if winner_role == "creator" else "creator"
        self.write(
            "reject-winner-appeal",
            "appeal_wager",
            [wager_id, "Independent acceptance check from the current winner."],
            value=STAKE,
            role=winner_role,
            expected_error="only the losing participant can appeal",
            expected_credit=True,
        )
        self.write(
            "appeal-wager",
            "appeal_wager",
            [wager_id, "Re-check the public Example Domain wording against both positions."],
            value=STAKE,
            role=loser_role,
        )
        historical_queue = self.record["assertions"].get("appeal-queued")
        queued = historical_queue["observed"] if historical_queue else self.read("get_wager", [wager_id])
        if (
            queued.get("appealed") is not True
            or queued.get("appeal_pending") is not True
            or queued.get("appeal_record", {}).get("exists") is not False
            or queued.get("original_record") != resolved.get("original_record")
        ):
            raise AssertionError("Bonded appeal was not safely queued without changing the original record")
        self.record["assertions"].setdefault("appeal-queued", {
            "checked_at": timestamp(),
            "expected": {"appealed": True, "appeal_pending": True, "appeal_record.exists": False},
            "observed": queued,
        })
        self.save()
        self.write("resolve-appeal", "resolve_appeal", [wager_id], role="observer")
        historical_appeal = self.record["assertions"].get("appeal-reviewed")
        if historical_appeal:
            appealed = historical_appeal["observed"]
        else:
            appealed = self.read("get_wager", [wager_id])
            if appealed.get("appealed") is not True or appealed.get("appeal_pending") is not False or appealed["status"] not in {"PROVISIONAL", "VOIDED"}:
                raise AssertionError("Appeal did not record a valid reviewed state")
            if appealed.get("original_record") != resolved.get("original_record"):
                raise AssertionError("Appeal overwrote the original adjudication record")
            appeal_record = appealed.get("appeal_record", {})
            appeal_sources = appeal_record.get("sources", [])
            if (
                appeal_record.get("exists") is not True
                or re.fullmatch(r"[0-9a-f]{64}", str(appeal_record.get("source_digest", ""))) is None
                or appeal_record.get("provenance") != "GENLAYER_VALIDATOR_REEVALUATED_ORIGINAL_SNAPSHOTS_NO_REFETCH"
                or appeal_record.get("source_digest") != original_record.get("source_digest")
                or len(appeal_sources) != 2
                or [source.get("snapshot_ref") for source in appeal_sources]
                != [source.get("digest") for source in original_sources]
            ):
                raise AssertionError("Frozen-snapshot appeal provenance was not recorded")
            self.record["assertions"]["appeal-reviewed"] = {
                "checked_at": timestamp(),
                "expected": {"appealed": True, "status": "PROVISIONAL_OR_VOIDED"},
                "observed": appealed,
            }
            self.save()
            output({"assertion": "appeal-reviewed", "passed": True, "status": appealed["status"]})

        duplicate_error = "appeal right already used" if appealed["status"] == "PROVISIONAL" else "only provisional wagers can be appealed"
        self.write(
            "reject-second-appeal",
            "appeal_wager",
            [wager_id, "A second appeal must never be accepted."],
            value=STAKE,
            role=loser_role,
            expected_error=duplicate_error,
            expected_credit=True,
        )

        if appealed["status"] == "PROVISIONAL":
            final_winner_role = (
                "creator"
                if appealed["winner"].lower() == self.accounts["creator"].address.lower()
                else "tester"
            )
            nonwinner_role = "tester" if final_winner_role == "creator" else "creator"
            self.wait_until(int(appealed["appeal_deadline_unix"]) + 2, "appeal window")
            self.write(
                "reject-nonwinner-claim",
                "claim",
                [wager_id],
                role=nonwinner_role,
                expected_error="only the winner can claim",
            )
            pot = int(appealed["pot_atto"])
            claim_before = self.claimable_snapshot("before-winner-claim", [final_winner_role])
            self.write("claim-wager", "claim", [wager_id], role=final_winner_role)
            self.assert_fields("lifecycle-settled", self.read("get_wager", [wager_id]), {"status": "SETTLED"})
            self.assert_claimable_delta("winner-payout-credited", claim_before, {final_winner_role: pot})
        else:
            output({"phase": "settlement", "passed": True, "result": "VOIDED_AND_REFUNDED"})

        self.wait_until(int(recovery_live["resolution_recovery_unix"]) + 2, "resolution recovery timeout")
        recovery_claims_before = self.claimable_snapshot("before-resolution-recovery", ["creator", "tester"])
        self.write("void-unresolved", "void_unresolved", [recovery_id], role="observer")
        recovered = self.assert_fields(
            "recovery-voided",
            self.read("get_wager", [recovery_id]),
            {"status": "VOIDED", "recoverable": False, "winner": ""},
        )
        if recovered.get("original_record", {}).get("exists") is not False:
            raise AssertionError("Timeout recovery must not fabricate an adjudication record")
        self.assert_claimable_delta(
            "timeout-refunds-credited", recovery_claims_before,
            {"creator": STAKE, "tester": STAKE},
        )
        output({"phase": "resolution-recovery", "passed": True, "caller": self.accounts["observer"].address})

        withdrawals = self.record.setdefault("withdrawals", {})
        for role in ("creator", "tester"):
            step = f"claim-funds-{role}"
            if step not in withdrawals:
                amount = self.claimable_balance(role)
                if amount <= 0:
                    raise AssertionError(f"{role} should have claimable funds from acceptance")
                withdrawals[step] = str(amount)
                self.save()
            amount = int(withdrawals[step])
            self.write(step, "claim_funds", [], role=role)
            self.verify_transfer(step, self.accounts[role].address, amount)
            if self.claimable_balance(role) != 0:
                raise AssertionError(f"{role} still has claimable funds after withdrawal")

        accounting = self.read("get_accounting", [])
        if accounting.get("liabilities_covered") is not True or int(accounting["escrowed_atto"]) != 0 or int(accounting["claimable_atto"]) != 0:
            raise AssertionError(f"Final contract accounting is not fully covered and settled: {accounting}")
        self.record["final_accounting"] = accounting

        stats = self.read("get_stats", [])
        if int(stats["total_created"]) < 3:
            raise AssertionError("Exact release did not retain the three acceptance markets")
        self.record["final_stats"] = stats
        self.record["completed_at"] = timestamp()
        self.record["result"] = "PASS"
        self.save()
        output({"result": "PASS", "contract": self.address, "stats": stats})


if __name__ == "__main__":
    Acceptance().run()
