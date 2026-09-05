# MicroWagers by demigodd00

MicroWagers is a peer-to-peer prediction application for GenLayer StudioNet. Two wallets take opposite sides of a binary claim, and GenLayer validators resolve the claim from a fixed public HTTPS source after the deadline. StudioNet test GEN has no monetary value.

This is the dedicated public review repository for the MicroWagers Project Explorer submission. The broader multi-product development repository remains at [Demigodd00/demigodd00-genlayer-apps](https://github.com/Demigodd00/demigodd00-genlayer-apps).

## Verified release

| Item | Value |
| --- | --- |
| Live app | https://microwagers.vercel.app |
| Status page | https://microwagers.vercel.app/status |
| Network | GenLayer StudioNet |
| Contract | `0xbe655aa17d1b4d31021791F0640a8c4677A11899` |
| Explorer | https://explorer-studio.genlayer.com/address/0xbe655aa17d1b4d31021791F0640a8c4677A11899 |
| Contract version | `1.2.1-studionet` |
| Deployment transaction | `0xe096d44ab3ad194760cc71c9c1c22331eaebffcdf94ac9e4ab2455965a7ff7e5` |
| Contract source SHA-256 | `3c786a3e74a6579b66438782e5443d1981c4e3fcef76d5b4ce818ad4835dfe46` |
| Acceptance result | `PASS` |

## Why GenLayer is central

The contract does not receive a winner from an administrator or conventional oracle. After a matched wager reaches its deadline, GenLayer validators fetch the fixed source URL and use comparative consensus to decide which submitted position the evidence supports. Settlement follows that agreed result.

Each decision preserves the exact source snapshot, SHA-256 digest, byte and character counts, outcome, confidence, reason, winner, and judgment time. One bonded appeal causes an independent validator refetch while keeping the original and appeal records separate. Ambiguous evidence refunds both users, and any wallet can recover both stakes if adjudication does not finalize within the configured timeout.

## Reviewer path

1. Open [w-3](https://microwagers.vercel.app/markets?wager=w-3) to inspect a settled and appealed wager with separate Original and Appeal records.
2. Expand `Stored source snapshot` in both records and compare their 559-byte snapshots and SHA-256 digests.
3. Open [w-2](https://microwagers.vercel.app/markets?wager=w-2) to inspect permissionless timeout recovery and both refunded stakes.
4. Open the [status page](https://microwagers.vercel.app/status) and compare its configuration with the [Explorer contract](https://explorer-studio.genlayer.com/address/0xbe655aa17d1b4d31021791F0640a8c4677A11899).
5. Review [`deployments/micro_wagers_acceptance.json`](deployments/micro_wagers_acceptance.json) for the exact-address, three-wallet acceptance journal.

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
NEXT_PUBLIC_MICROWAGERS_ADDRESS=0xbe655aa17d1b4d31021791F0640a8c4677A11899 python scripts/check_micro_wagers_release.py --skip-web --require-hosting
```

StudioNet integration tests make real test-network transactions and are therefore intentionally not part of the default CI run.

## Ownership and license

MicroWagers is authored by demigodd00. Public visibility exists for GenLayer review and verification; it does not transfer ownership or permit another person to present this work as their own. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
