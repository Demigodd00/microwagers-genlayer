"""Preflight, deploy, verify, and record the StudioNet MicroWagers release.

Environment:
    MICROWAGERS_PRIVATE_KEY    required deployment signer
    MICROWAGERS_NETWORK        studionet (default) | localnet

Example:
    python scripts/deploy_micro_wagers.py --fee-bps 0 --appeal-window-secs 300 --resolution-timeout-secs 600
"""

import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from eth_account import Account
from eth_utils import to_checksum_address
from genlayer_py import create_client
from genlayer_py.assertions import tx_execution_succeeded
from genlayer_py.chains import localnet, studionet
from genlayer_py.types import TransactionHashVariant, TransactionStatus

ROOT = Path(__file__).resolve().parents[1]
CODE_PATH = ROOT / "contracts" / "micro_wagers.py"
TEST_PATH = ROOT / "tests" / "direct" / "test_micro_wagers.py"
DEPLOYMENTS_DIR = ROOT / "deployments"

ADDRESS_PATTERN = re.compile(r"^0x[0-9a-fA-F]{40}$")
FEE_BPS_CAP = 1000
MIN_APPEAL_WINDOW_SECS = 5 * 60
MAX_APPEAL_WINDOW_SECS = 7 * 24 * 60 * 60
MIN_RESOLUTION_TIMEOUT_SECS = 5 * 60
MAX_RESOLUTION_TIMEOUT_SECS = 7 * 24 * 60 * 60


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deploy the preflighted and verified MicroWagers StudioNet release"
    )
    parser.add_argument("--fee-bps", type=int, default=0)
    parser.add_argument("--appeal-window-secs", type=int, default=300)
    parser.add_argument("--resolution-timeout-secs", type=int, default=600)
    parser.add_argument(
        "--resume-transaction",
        help="Verify and record an already-submitted deployment instead of deploying again",
    )
    parser.add_argument(
        "--skip-preflight",
        action="store_true",
        help="Local debugging only; never use for a release deployment",
    )
    return parser.parse_args()


def validate_configuration(args: argparse.Namespace, network_name: str) -> None:
    if not 0 <= args.fee_bps <= FEE_BPS_CAP:
        raise ValueError(f"fee_bps must be between 0 and {FEE_BPS_CAP}")
    if not MIN_APPEAL_WINDOW_SECS <= args.appeal_window_secs <= MAX_APPEAL_WINDOW_SECS:
        raise ValueError(
            f"appeal_window_secs must be {MIN_APPEAL_WINDOW_SECS}..{MAX_APPEAL_WINDOW_SECS} seconds"
        )
    if not MIN_RESOLUTION_TIMEOUT_SECS <= args.resolution_timeout_secs <= MAX_RESOLUTION_TIMEOUT_SECS:
        raise ValueError(
            f"resolution_timeout_secs must be {MIN_RESOLUTION_TIMEOUT_SECS}..{MAX_RESOLUTION_TIMEOUT_SECS} seconds"
        )
    if network_name == "studionet" and args.fee_bps != 0:
        raise ValueError("MicroWagers StudioNet releases must use --fee-bps 0")
    if args.resume_transaction and re.fullmatch(r"0x[0-9a-fA-F]{64}", args.resume_transaction) is None:
        raise ValueError("--resume-transaction must be a 32-byte transaction hash")


def run_preflight() -> None:
    utf8_env = os.environ.copy()
    utf8_env["PYTHONUTF8"] = "1"
    subprocess.run(
        ["genvm-lint", "check", str(CODE_PATH)],
        cwd=ROOT,
        check=True,
        env=utf8_env,
    )
    subprocess.run(
        [sys.executable, "-m", "pytest", str(TEST_PATH), "-q"],
        cwd=ROOT,
        check=True,
        env=utf8_env,
    )


def extract_contract_address(receipt: dict) -> str:
    for key in ("tx_data_decoded", "data"):
        data = receipt.get(key)
        if isinstance(data, dict) and data.get("contract_address"):
            address = str(data["contract_address"])
            if ADDRESS_PATTERN.fullmatch(address) is None or int(address[2:], 16) == 0:
                raise ValueError("deployment receipt contained an invalid contract address")
            return to_checksum_address(address)
    raise ValueError("finalized deployment receipt did not contain a contract address")


def assert_execution_succeeded(receipt: dict) -> None:
    if receipt.get("error"):
        raise RuntimeError(f"deployment failed: {receipt['error']}")
    status = receipt.get("status_name") or receipt.get("statusName")
    if status != TransactionStatus.FINALIZED.value:
        raise RuntimeError("deployment did not reach FINALIZED status")
    if not tx_execution_succeeded(receipt):
        consensus = receipt.get("consensus_data", {})
        leaders = consensus.get("leader_receipt", []) if isinstance(consensus, dict) else []
        if isinstance(leaders, dict):
            leaders = [leaders]
        detail = ""
        if isinstance(leaders, list) and leaders and isinstance(leaders[0], dict):
            detail = str(leaders[0].get("genvm_result") or leaders[0].get("execution_result") or "")
        suffix = f": {detail[:500]}" if detail else ""
        raise RuntimeError(f"deployment finalized without successful contract execution{suffix}")


def source_digest(code: str) -> str:
    return hashlib.sha256(code.replace("\r\n", "\n").encode("utf-8")).hexdigest()


def verify_deployed_source(client, address: str, expected_code: str) -> str:
    response = client.provider.make_request(method="gen_getContractCode", params=[address])
    encoded = response.get("result")
    if not isinstance(encoded, str):
        raise RuntimeError("could not retrieve deployed source; refusing to activate this address")
    try:
        deployed_code = base64.b64decode(encoded, validate=True).decode("utf-8")
    except (ValueError, UnicodeError):
        raise RuntimeError("deployed source was not valid encoded Python") from None
    digest = source_digest(expected_code)
    if source_digest(deployed_code) != digest:
        raise RuntimeError("deployed source does not match the validated local contract")
    return digest


def verify_deployed_configuration(client, address: str, account, args: argparse.Namespace) -> dict:
    stats = client.read_contract(
        address=address,
        function_name="get_stats",
        args=[],
        account=account,
        transaction_hash_variant=TransactionHashVariant.LATEST_FINAL,
    )
    expected = {
        "fee_bps": str(args.fee_bps),
        "appeal_window_secs": str(args.appeal_window_secs),
        "resolution_timeout_secs": str(args.resolution_timeout_secs),
        "experimental": True,
        "max_page_size": "25",
        "max_source_bytes": "100000",
        "max_source_chars": "8000",
        "source_policy": "STRICT_UTF8_SHA256_VALIDATOR_FETCH_AND_SNAPSHOT",
        "version": "1.2.1-studionet",
    }
    if not isinstance(stats, dict) or any(stats.get(key) != value for key, value in expected.items()):
        raise RuntimeError("deployed settings do not match the requested release")
    if str(stats.get("treasury", "")).lower() != account.address.lower():
        raise RuntimeError("deployed treasury does not match the deployment signer")
    return stats


def record_deployment(output_path: Path, record: dict) -> None:
    """Atomically update the active record and preserve any prior deployment."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        previous = json.loads(output_path.read_text(encoding="utf-8"))
        previous_address = str(previous.get("address", ""))
        if previous_address.lower() != str(record["address"]).lower():
            history_dir = output_path.parent / "history"
            history_dir.mkdir(exist_ok=True)
            history_path = history_dir / f"{output_path.stem}_{previous_address[2:].lower()}.json"
            if history_path.exists():
                if json.loads(history_path.read_text(encoding="utf-8")) != previous:
                    raise RuntimeError("existing deployment history differs; refusing to overwrite it")
            else:
                history_path.write_text(json.dumps(previous, indent=2) + "\n", encoding="utf-8")
            record["previous_address"] = previous_address
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=output_path.parent,
        prefix="microwagers-record-",
        suffix=".json.tmp",
        delete=False,
    ) as temporary:
        json.dump(record, temporary, indent=2)
        temporary.write("\n")
        pending_path = Path(temporary.name)
    pending_path.replace(output_path)


def main() -> None:
    args = parse_args()
    network_name = os.environ.get("MICROWAGERS_NETWORK", "studionet").strip().lower()
    chains = {"studionet": studionet, "localnet": localnet}
    if network_name not in chains:
        raise ValueError("MICROWAGERS_NETWORK must be studionet or localnet")
    validate_configuration(args, network_name)

    private_key = os.environ.get("MICROWAGERS_PRIVATE_KEY", "").strip()
    if not private_key:
        raise RuntimeError("MICROWAGERS_PRIVATE_KEY is required; no key will be generated")

    if not args.skip_preflight:
        run_preflight()

    code = CODE_PATH.read_text(encoding="utf-8")
    source_sha256 = source_digest(code)
    runner_dependency = code.splitlines()[0]
    account = Account.from_key(private_key)
    client = create_client(chain=chains[network_name], account=account)
    constructor_args = [args.fee_bps, args.appeal_window_secs, args.resolution_timeout_secs]

    print(
        f"network={network_name} deployer={account.address} "
        f"source_sha256={source_sha256}",
        flush=True,
    )
    if args.resume_transaction:
        tx_hash = args.resume_transaction
        print(f"resuming_transaction={tx_hash}", flush=True)
    else:
        tx_hash = client.deploy_contract(code=code, account=account, args=constructor_args)
        print(f"transaction={tx_hash}", flush=True)
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash,
        status=TransactionStatus.FINALIZED,
        interval=3000,
        retries=120,
        full_transaction=True,
    )
    assert_execution_succeeded(receipt)
    contract_address = extract_contract_address(receipt)
    source_sha256 = verify_deployed_source(client, contract_address, code)
    stats = verify_deployed_configuration(client, contract_address, account, args)

    record = {
        "contract": "MicroWagers",
        "version": "1.2.1-studionet",
        "network": network_name,
        "address": contract_address,
        "transaction_hash": str(tx_hash),
        "deployer": account.address,
        "deployer_role": "deployment_and_zero_fee_treasury_only_no_admin_controls",
        "treasury": account.address,
        "constructor_args": {
            "fee_bps": args.fee_bps,
            "appeal_window_secs": args.appeal_window_secs,
            "resolution_timeout_secs": args.resolution_timeout_secs,
        },
        "source_sha256": source_sha256,
        "runner_dependency": runner_dependency,
        "preflight_skipped": args.skip_preflight,
        "receipt_status": "FINALIZED",
        "execution_result": "SUCCESS",
        "verified_source_and_config": True,
        "deployed_stats": stats,
        "deployed_at": datetime.now(timezone.utc).isoformat(),
    }
    output_path = DEPLOYMENTS_DIR / f"micro_wagers_{network_name}.json"
    record_deployment(output_path, record)
    print(f"verified_deployment={contract_address}", flush=True)
    print(f"record={output_path}", flush=True)


if __name__ == "__main__":
    main()
