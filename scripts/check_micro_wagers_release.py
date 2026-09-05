"""Run MicroWagers' repeatable local and recorded-release gate."""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "micro_wagers.py"
DIRECT_TEST_PATH = ROOT / "tests" / "direct" / "test_micro_wagers.py"
DEPLOY_SCRIPT_PATH = ROOT / "scripts" / "deploy_micro_wagers.py"
ACCEPTANCE_SCRIPT_PATH = ROOT / "scripts" / "microwagers_acceptance.py"
DEPLOYMENT_PATH = ROOT / "deployments" / "micro_wagers_studionet.json"
ACCEPTANCE_PATH = ROOT / "deployments" / "micro_wagers_acceptance.json"
HOSTING_PATH = ROOT / "deployments" / "micro_wagers_vercel.json"
WEB_PATH = ROOT / "apps" / "microwagers-web"
ADDRESS_PATTERN = re.compile(r"^0x[0-9a-fA-F]{40}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-web", action="store_true")
    parser.add_argument("--require-hosting", action="store_true")
    return parser.parse_args()


def run_check(label: str, command: list[str], cwd: Path = ROOT) -> bool:
    print(f"\n[{label}]")
    environment = os.environ.copy()
    environment["PYTHONUTF8"] = "1"
    result = subprocess.run(command, cwd=cwd, check=False, env=environment)
    print(f"{'PASS' if result.returncode == 0 else 'FAIL'}: {label}")
    return result.returncode == 0


def source_digest() -> str:
    source = CONTRACT_PATH.read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def read_frontend_address() -> str:
    configured = os.environ.get("NEXT_PUBLIC_MICROWAGERS_ADDRESS", "").strip()
    if configured:
        return configured
    for path in (
        WEB_PATH / ".env.production.local",
        WEB_PATH / ".env.local",
        WEB_PATH / ".env.example",
    ):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("NEXT_PUBLIC_MICROWAGERS_ADDRESS="):
                return line.split("=", 1)[1].strip()
    return ""


def verify_records() -> tuple[bool, dict | None]:
    print("\n[deployment and acceptance provenance]")
    try:
        deployment = json.loads(DEPLOYMENT_PATH.read_text(encoding="utf-8"))
        acceptance = json.loads(ACCEPTANCE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"FAIL: release record cannot be read: {error}")
        return False, None

    address = str(deployment.get("address", ""))
    constructor = deployment.get("constructor_args", {})
    transactions = acceptance.get("transactions", {})
    assertions = acceptance.get("assertions", {})
    resolved_observed = assertions.get("resolved-decisively", {}).get("observed", {})
    appealed_observed = assertions.get("appeal-reviewed", {}).get("observed", {})
    cancellation_open = assertions.get("cancellation-open", {}).get("observed", {})
    lifecycle_live = assertions.get("lifecycle-live", {}).get("observed", {})
    recovery_voided = assertions.get("recovery-voided", {}).get("observed", {})
    original_record = resolved_observed.get("original_record", {})
    appeal_record = appealed_observed.get("appeal_record", {})
    required_steps = {
        "create-cancellation",
        "reject-noncreator-cancel",
        "cancel-open-wager",
        "create-lifecycle",
        "create-recovery",
        "accept-recovery-wager",
        "reject-early-recovery",
        "void-unresolved",
        "reject-creator-self-accept",
        "reject-wrong-accept-stake",
        "accept-wager",
        "reject-early-resolution",
        "resolve-wager",
        "reject-claim-during-appeal-window",
        "reject-winner-appeal",
        "appeal-wager",
        "reject-second-appeal",
        "reject-nonwinner-claim",
        "claim-wager",
    }
    checks = {
        "contract name": deployment.get("contract") == "MicroWagers",
        "StudioNet network": deployment.get("network") == "studionet",
        "valid address": ADDRESS_PATTERN.fullmatch(address) is not None,
        "source hash": deployment.get("source_sha256") == source_digest(),
        "preflight enabled": deployment.get("preflight_skipped") is False,
        "finalized successful execution": deployment.get("receipt_status") == "FINALIZED"
        and deployment.get("execution_result") == "SUCCESS",
        "source and config verified": deployment.get("verified_source_and_config") is True,
        "zero fee": isinstance(constructor, dict) and constructor.get("fee_bps") == 0,
        "five-minute appeal": isinstance(constructor, dict) and constructor.get("appeal_window_secs") == 300,
        "ten-minute resolution recovery": isinstance(constructor, dict) and constructor.get("resolution_timeout_secs") == 600,
        "release version": deployment.get("version") == "1.2.1-studionet",
        "frontend exact address": read_frontend_address().lower() == address.lower(),
        "acceptance exact address": acceptance.get("contract", "").lower() == address.lower(),
        "acceptance source": acceptance.get("source_sha256") == deployment.get("source_sha256"),
        "acceptance passed": acceptance.get("result") == "PASS",
        "unassigned roles are not exposed": cancellation_open.get("taker") == ""
        and cancellation_open.get("winner") == ""
        and lifecycle_live.get("winner") == ""
        and recovery_voided.get("winner") == "",
        "original source fingerprint recorded": original_record.get("exists") is True
        and re.fullmatch(r"[0-9a-f]{64}", str(original_record.get("source_digest", ""))) is not None,
        "appeal record preserved separately": appealed_observed.get("original_record") == original_record
        and appeal_record.get("exists") is True
        and re.fullmatch(r"[0-9a-f]{64}", str(appeal_record.get("source_digest", ""))) is not None,
        "required acceptance steps": required_steps.issubset(transactions)
        and all(transactions[step].get("checked") is True for step in required_steps),
        "positive matched acceptance": transactions.get("accept-wager", {}).get("execution_succeeded") is True
        or transactions.get("accept-wager-final", {}).get("execution_succeeded") is True,
        "expired harness wager recovered when needed": (
            "classification" not in transactions.get("accept-wager", {})
            or (
                transactions.get("accept-wager", {}).get("classification")
                == "EXPECTED_CONTRACT_REJECTION_AFTER_HARNESS_DEADLINE_EXPIRED"
                and acceptance.get("transfer_checks", {})
                .get("cancel-expired-lifecycle", {})
                .get("value_credited")
                is True
            )
        ),
        "cancellation refund verified": acceptance.get("transfer_checks", {}).get("cancel-open-wager", {}).get("value_credited") is True,
        "resolution timeout refunds verified": acceptance.get("transfer_checks", {}).get("void-unresolved", {}).get("all_value_credited") is True,
        "winner payout verified": acceptance.get("transfer_checks", {}).get("claim-wager", {}).get("value_credited") is True,
    }
    for label, passed in checks.items():
        print(f"{'PASS' if passed else 'FAIL'}: {label}")
    return all(checks.values()), deployment


def get_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "MicroWagers-release-gate/1.0"})
    with urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"{url} returned HTTP {response.status}")
        return json.loads(response.read().decode("utf-8"))


def verify_hosting(required: bool, deployment: dict | None) -> bool:
    print("\n[production hosting]")
    if not HOSTING_PATH.exists():
        print("FAIL: hosting record is missing" if required else "PENDING: hosting record is missing")
        return not required
    try:
        hosting = json.loads(HOSTING_PATH.read_text(encoding="utf-8"))
        production_url = str(hosting["production_url"]).rstrip("/")
        health = get_json(production_url + "/api/health")
    except (OSError, KeyError, ValueError, json.JSONDecodeError, RuntimeError) as error:
        print(f"FAIL: production verification failed: {error}")
        return False
    expected_address = str((deployment or {}).get("address", ""))
    checks = {
        "HTTPS production URL": production_url.startswith("https://"),
        "correct project root": hosting.get("root_directory") == "apps/microwagers-web",
        "correct source commit": re.fullmatch(r"[0-9a-f]{40}", str(hosting.get("source_commit", ""))) is not None,
        "matching contract": hosting.get("contract_address", "").lower() == expected_address.lower(),
        "health identifies product": health.get("product") == "MicroWagers",
        "health identifies release": health.get("release") == "1.2.1",
        "health identifies StudioNet": health.get("network") == "StudioNet",
        "health is release-ready": health.get("readyForStudioNetTesting") is True,
    }
    for label, passed in checks.items():
        print(f"{'PASS' if passed else 'FAIL'}: {label}")
    return all(checks.values())


def main() -> int:
    options = parse_args()
    results = [
        run_check("GenVM lint and validation", ["genvm-lint", "check", str(CONTRACT_PATH)]),
        run_check("direct contract tests", [sys.executable, "-m", "pytest", str(DIRECT_TEST_PATH), "-q"]),
        run_check(
            "release script compilation",
            [sys.executable, "-m", "py_compile", str(DEPLOY_SCRIPT_PATH), str(ACCEPTANCE_SCRIPT_PATH)],
        ),
    ]

    if not options.skip_web:
        pnpm = shutil.which("pnpm") or shutil.which("pnpm.cmd")
        if pnpm is None:
            print("\nFAIL: pnpm is not installed or available on PATH")
            results.append(False)
        else:
            results.extend(
                [
                    run_check("web tests", [pnpm, "test"], WEB_PATH),
                    run_check("web typecheck", [pnpm, "typecheck"], WEB_PATH),
                    run_check("web production build", [pnpm, "build"], WEB_PATH),
                    run_check("web production dependency audit", [pnpm, "audit", "--prod", "--audit-level=high"], WEB_PATH),
                ]
            )

    records_ok, deployment = verify_records()
    results.append(records_ok)
    results.append(verify_hosting(options.require_hosting, deployment))
    print("\nMicroWagers release gate: " + ("PASS" if all(results) else "FAIL"))
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
