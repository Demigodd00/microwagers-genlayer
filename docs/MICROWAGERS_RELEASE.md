# MicroWagers StudioNet milestone release

MicroWagers by demigodd00 is a peer-to-peer prediction app on GenLayer StudioNet. This milestone adds dual-source, cited adjudication; failure-safe GEN accounting; and a staged, recoverable appeal process. StudioNet test GEN has no monetary value. It is not a real-money product or a mainnet security claim.

## Release identity

| Item | Release value |
|---|---|
| Live app | https://microwagers.vercel.app |
| Read-only status | https://microwagers.vercel.app/status |
| Contract | `0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a` |
| Explorer | https://explorer-studio.genlayer.com/address/0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a |
| Version | `1.3.1-studionet` |
| Deployment transaction | `0x6eb768a648e7fa378676695451fb45b46b4084a9b9b2cf0d5e57472ac0b9b962` |
| Source SHA-256 | `2ed0386b511764e90c9c79f34aefc67cbb383a7d889051bcf901fab7e4e736d6` |
| Fee / appeal / unresolved timeout | `0 bps / 300 seconds / 600 seconds` |
| Acceptance | `PASS` |

Deployment and exact-address acceptance records: [`micro_wagers_studionet.json`](../deployments/micro_wagers_studionet.json) and [`micro_wagers_milestone1_v131_acceptance.json`](../deployments/micro_wagers_milestone1_v131_acceptance.json). The previously accepted V1.2.1 contract and superseded V1.3.0 deployment remain in [`deployments/history/`](../deployments/history/); neither was overwritten. The failed V1.3.0 attempt and its transaction journal are preserved as [`micro_wagers_milestone1_v130_acceptance.json`](../deployments/history/micro_wagers_milestone1_v130_acceptance.json). That early failed test call left 0.001 valueless test GEN in the superseded V1.3.0 contract. The current release has no such balance or liability.

## What changed in this milestone

- Every new wager pins two public HTTPS sources on distinct hosts.
- GenLayer validators fetch both sources after the deadline and return a finding and exact citation for each. A citation must be present in the corresponding snapshot. Only decisive agreement across both sources produces a provisional winner; disagreement, insufficient confidence, or unverifiable evidence refunds both parties.
- The contract preserves each source URL, snapshot, digest, citation, and finding, plus the combined adjudication record.
- An appeal is queued in a deterministic payable transaction. A separate non-payable call adjudicates it from the frozen original snapshots, without refetching. Original and appeal findings remain distinct. A timed-out pending appeal can be voided and its bond recovered.
- Refunds and payouts become claimable contract balances before withdrawal. Known invalid payable calls succeed with an explicit refund credit rather than reverting after value has entered the contract.
- `/status` exposes release identity and contract accounting. The app shows claimable funds, pending appeals, and recovery actions; payout is blocked while an appeal is pending.

## Why GenLayer is central

The outcome is not supplied by an admin, a centralized oracle, or a client-side model. After a matched wager expires, the Intelligent Contract invokes GenLayer nondeterministic web retrieval and validator consensus. Each source is evaluated independently against the two fixed positions. Consensus is strict: the sources must agree, their citations must match the fetched content, and confidence must clear the contract threshold. If those conditions are not met, the contract refunds rather than forcing a result.

The appeal workflow also uses GenLayer as the adjudicator. The losing participant escrows a bond, then any wallet can request a separate validator decision against the immutable source snapshots already stored on-chain. The appeal cannot silently replace the first record, and payout remains locked until the appeal completes or is recovered after timeout.

## Exact-address acceptance results

The resume-safe acceptance run exercised the exact deployed source and configuration with the creator, a second participant, and an independent observer:

- `w-1`: creator cancelled an unmatched wager; the 0.001 GEN stake became claimable.
- `w-2`: a second wallet matched; the observer was blocked from recovering it early, then permissionlessly voided it after the unresolved timeout. Both 0.001 GEN stakes became claimable.
- `w-3`: the second wallet matched a two-source question. GenLayer finalized a provisional outcome after recording both distinct URLs, per-source findings, exact citations, and 559-byte snapshots. Both sources returned the same 559-byte Example Domain text and digest `ff67a9d764d6a2367a187734e697f6a53217db9a21c101d410a113ca871a299d`.
- The losing participant's appeal was queued and resolved separately from the stored snapshots. It upheld the original verdict, retained both records, and raised the winner's claimable pot to 0.003 GEN. The winner could not claim before the appeal window; the non-winner could not claim at all.
- Self-acceptance, a wrong acceptance stake, an appeal by the winner, and a duplicate appeal were rejected while each attached test amount was credited back to the sender as claimable GEN.
- Creator and tester withdrew their claimable funds. The final contract read showed zero balance, zero escrow, zero claimable liability, and `liabilities_covered: true`.

The exact source-level assertions and transaction receipts are in the acceptance journal. All dates, stakes, and explorer states are from StudioNet test data; test GEN has no monetary value.

## Reviewer path

1. Open https://microwagers.vercel.app/markets?wager=w-3. Inspect the final wager, confidence, 0.003 GEN test pot, and separate Original and Appeal records.
2. Expand both original source findings. Compare their distinct host URLs, exact citations, 559-byte snapshots, and source digests. Confirm the appeal refers to those same frozen source fingerprints.
3. Open https://microwagers.vercel.app/markets?wager=w-2. Confirm timeout refund, empty winner, and no fabricated adjudication record.
4. Open https://microwagers.vercel.app/markets?wager=w-1. Confirm an unmatched cancellation and refund.
5. Open https://microwagers.vercel.app/status and compare address, version, zero fee, appeal and timeout configuration, and accounting with the StudioNet Explorer.

No wallet connection is required to inspect these completed records. A wallet is only needed to create, match, appeal, or withdraw a live wager.

## Verification

- GenVM lint and validation: 3 checks passed.
- Direct contract tests: 43 passed.
- Frontend tests: 31 passed; TypeScript check and Next.js production build passed.
- Production dependency audit: no known vulnerabilities.
- Exact-address StudioNet deployment and acceptance: passed, including source/configuration verification and all claimable withdrawals.

Repeat local checks with:

```bash
cd apps/microwagers-web
pnpm install --frozen-lockfile
pnpm check
pnpm audit:prod
cd ../..
python -m pip install -r requirements-dev.txt
python scripts/prepare_gltest_runner.py
genvm-lint check contracts/micro_wagers.py
NEXT_PUBLIC_MICROWAGERS_ADDRESS=0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a python scripts/check_micro_wagers_release.py --skip-web --require-hosting
```

StudioNet integration/acceptance writes cost only valueless StudioNet test GEN but still create permanent testnet state. The completed acceptance journal is resume-safe; do not delete it or rerun against a different contract.
