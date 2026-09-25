# MicroWagers by demigodd00

MicroWagers is a peer-to-peer prediction application for GenLayer StudioNet. Two wallets take opposite sides of a binary claim. After the deadline, GenLayer validators independently fetch two distinct public HTTPS sources, record source-specific findings and exact citations, and reach consensus. StudioNet test GEN has no monetary value.

This is the dedicated public source and review repository for the accepted MicroWagers project and its V1.3.1 milestone. The broader multi-product development repository remains at [Demigodd00/demigodd00-genlayer-apps](https://github.com/Demigodd00/demigodd00-genlayer-apps).

## Verified release

| Item | Value |
| --- | --- |
| Live app | https://microwagers.vercel.app |
| Status page | https://microwagers.vercel.app/status |
| Network | GenLayer StudioNet |
| Contract | `0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a` |
| Explorer | https://explorer-studio.genlayer.com/address/0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a |
| Contract version | `1.3.1-studionet` |
| Deployment transaction | `0x6eb768a648e7fa378676695451fb45b46b4084a9b9b2cf0d5e57472ac0b9b962` |
| Contract source SHA-256 | `2ed0386b511764e90c9c79f34aefc67cbb383a7d889051bcf901fab7e4e736d6` |
| Acceptance result | `PASS` |

## Why GenLayer is central

The contract does not receive a winner from an administrator or conventional oracle. Each matched wager pins two HTTPS source URLs on distinct hosts. After its deadline, GenLayer validators fetch both pages, produce source-specific findings with citations that must exactly occur in the fetched text, and select a winner only when both sources agree. Conflicting or neutral findings credit both stakes for withdrawal. Retrieval or consensus failures can be retried or recovered after the timeout. Host diversity does not prove publisher independence.

Each decision preserves the two exact source snapshots, fingerprints, findings and citations, plus the outcome, legacy policy bucket, reason, winner, and judgment time. The bucket is fixed at 70 for agreement and 0 otherwise, not measured confidence; the app displays source agreement instead. One bonded appeal is queued separately; any wallet may resolve it against the original snapshots without refetching. Both records are retained. Timed-out appeals can be voided with their bond credited for withdrawal. Payouts and refunds first become claimable balances. Known validation rejections in payable methods also credit the attached amount. This is not a guarantee for arbitrary malformed calls, VM failures, direct sends, or every possible native-transfer failure. Any wallet can recover both stakes if original adjudication remains unresolved past its timeout.

App V1.3.2 corrects receipt handling and refund displays without changing contract V1.3.1. Start the public review at https://microwagers.vercel.app/milestone.

## Reviewer path

1. Open [w-3](https://microwagers.vercel.app/markets?wager=w-3) to inspect a settled wager and its distinct Original and Appeal records.
2. Expand the two source findings in the Original record. Verify both distinct hosts, exact citations, 559-byte per-source snapshots, and the matching source digests. Confirm the Appeal record points to those same frozen snapshots.
3. Open [w-2](https://microwagers.vercel.app/markets?wager=w-2) to inspect permissionless timeout recovery and both refunded stakes.
4. Open [w-1](https://microwagers.vercel.app/markets?wager=w-1) to inspect cancellation and refund of an unmatched wager.
5. Open the [status page](https://microwagers.vercel.app/status) and compare its configuration with the [Explorer contract](https://explorer-studio.genlayer.com/address/0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a).
6. Review [`deployments/micro_wagers_milestone1_v131_acceptance.json`](deployments/micro_wagers_milestone1_v131_acceptance.json) for the exact-address, two-participant and third-wallet acceptance journal. All three wallets belong to the test harness; this is not an independent security audit.

No wallet connection is required to review these completed states.

## Repository layout

- `contracts/micro_wagers.py` — production Intelligent Contract.
- `apps/microwagers-web` — Next.js frontend and frontend tests.
- `tests/direct` — direct-mode contract tests.
- `tests/integration` — optional StudioNet integration tests.
- `scripts` — deployment, acceptance, and reproducible release checks.
- `deployments` — final StudioNet, Vercel, and acceptance receipts.
- `docs` — release and Portal submission documentation.

## Verify locally

Frontend:

```bash
cd apps/microwagers-web
pnpm install --frozen-lockfile
pnpm check
pnpm audit:prod
```

Contract and recorded release:

```bash
python -m pip install -r requirements-dev.txt
python scripts/prepare_gltest_runner.py
genvm-lint check contracts/micro_wagers.py
pytest tests/direct/test_micro_wagers.py -q
NEXT_PUBLIC_MICROWAGERS_ADDRESS=0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a python scripts/check_micro_wagers_release.py --skip-web --require-hosting
```

StudioNet integration tests make real test-network transactions and are therefore intentionally not part of the default CI run.

## Ownership and license

MicroWagers is authored by demigodd00. Public visibility exists for GenLayer review and verification; it does not transfer ownership or permit another person to present this work as their own. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
