# MicroWagers StudioNet milestone release

MicroWagers by demigodd00 is a peer-to-peer prediction app on GenLayer StudioNet. This milestone adds dual-source, cited adjudication; claimable GEN accounting; and a staged, recoverable appeal process. StudioNet test GEN has no monetary value. It is not a real-money product or a mainnet security claim.

## Release identity

| Item | Release value |
|---|---|
| Live app | https://microwagers.vercel.app |
| Public milestone walkthrough | https://microwagers.vercel.app/milestone |
| Read-only status | https://microwagers.vercel.app/status |
| Contract | `0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a` |
| Explorer | https://explorer-studio.genlayer.com/address/0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a |
| Version | `1.3.1-studionet` |
| Interface review fixes | App `1.3.2`, same contract and evidence |
| Deployment transaction | `0x6eb768a648e7fa378676695451fb45b46b4084a9b9b2cf0d5e57472ac0b9b962` |
| Source SHA-256 | `2ed0386b511764e90c9c79f34aefc67cbb383a7d889051bcf901fab7e4e736d6` |
| Vercel production deployment | `dpl_vTJCsg9oUc4uRwQw8qnfroAPVJsj` |
| Milestone source commit | `42cb16e6f45186329259debb7359b00efdf6b1ce` |
| Fee / appeal / unresolved timeout | `0 bps / 300 seconds / 600 seconds` |
| Acceptance | `PASS` |

Deployment and exact-address acceptance records: [`micro_wagers_studionet.json`](../deployments/micro_wagers_studionet.json) and [`micro_wagers_milestone1_v131_acceptance.json`](../deployments/micro_wagers_milestone1_v131_acceptance.json). The previously accepted V1.2.1 contract and superseded V1.3.0 deployment remain in [`deployments/history/`](../deployments/history/); neither was overwritten. The failed V1.3.0 attempt and its transaction journal are preserved as [`micro_wagers_milestone1_v130_acceptance.json`](../deployments/history/micro_wagers_milestone1_v130_acceptance.json). That early failed test call left 0.001 valueless test GEN in the superseded V1.3.0 contract. The current release has no such balance or liability.

## What changed in this milestone

- Every new wager pins two public HTTPS sources on distinct hosts.
- GenLayer validators fetch both sources after the deadline and return a finding and exact citation for each. A citation must be present in the corresponding snapshot. Both cited findings must support the same side for a provisional winner. Conflicting or neutral findings credit refunds; retrieval or consensus failure leaves the wager retryable until permissionless timeout recovery.
- The contract preserves each source URL, snapshot, digest, citation, and finding, plus the combined adjudication record.
- An appeal is queued in a deterministic payable transaction. A separate non-payable call adjudicates it from the frozen original snapshots, without refetching. Original and appeal findings remain distinct. A timed-out pending appeal can be voided and its bond recovered.
- Refunds and payouts become claimable contract balances before withdrawal. Known invalid payable calls succeed with an explicit refund credit rather than reverting after value has entered the contract.
- `/status` exposes release identity and contract accounting. The app shows claimable funds, pending appeals, and recovery actions; payout is blocked while an appeal is pending.

## Why GenLayer is central

The outcome is not supplied by an admin, a centralized oracle, or a client-side model. After a matched wager expires, the Intelligent Contract invokes GenLayer nondeterministic web retrieval and validator consensus. Each source is classified against the two fixed positions. Validators compare snapshots, exact citations, findings and outcome. Both sources must support the same side. The legacy `confidence_bucket` is fixed at 70 for agreement and 0 otherwise; it is not a measured confidence percentage. App V1.3.2 displays source agreement and retains the raw wording under audit details. Distinct hosts do not verify publisher independence, and exact citations do not prove that a publisher's claim is true.

The appeal workflow also uses GenLayer as the adjudicator. The losing participant escrows a bond, then any wallet can request a separate validator decision against the immutable source snapshots already stored on-chain. The appeal cannot silently replace the first record, and payout remains locked until the appeal completes or is recovered after timeout.

## Exact-address acceptance results

The recorded acceptance run exercised the exact deployed source and configuration with the creator, a second participant, and a third observer wallet controlled by the same test harness (not an independent auditor):

- `w-1`: creator cancelled an unmatched wager; the 0.001 GEN stake became claimable.
- `w-2`: a second wallet matched; the observer was blocked from recovering it early, then permissionlessly voided it after the unresolved timeout. Both 0.001 GEN stakes became claimable.
- `w-3`: the second wallet matched a two-source question. GenLayer finalized a provisional outcome after recording both distinct URLs, per-source findings, exact citations, and 559-byte snapshots. Both sources returned the same 559-byte Example Domain text and digest `ff67a9d764d6a2367a187734e697f6a53217db9a21c101d410a113ca871a299d`.
- The losing participant's appeal was queued and resolved separately from the stored snapshots. It upheld the original verdict and retained both records. After the appeal window, winner settlement credited 0.003 GEN. A non-winner claim was rejected. Early winner-claim rejection was tested locally, not as a transaction in this live journal.
- Self-acceptance, a wrong acceptance stake, an appeal by the winner, and a duplicate appeal were rejected while each attached test amount was credited back to the sender as claimable GEN.
- Creator and tester withdrew their claimable funds. The final contract read showed zero balance, zero escrow, zero claimable liability, and `liabilities_covered: true`.

The exact source-level assertions and transaction receipts are in the acceptance journal. All dates, stakes, and explorer states are from StudioNet test data; test GEN has no monetary value.

## Review corrections and coverage boundaries

App V1.3.2 verifies decoded contract return values, not only successful VM execution. `[REFUNDABLE]` and `[REJECTED]` responses cannot trigger creation or appeal success. A cancelled unmatched wager now displays its actual 0.001 GEN stake and an empty taker is shown as "No taker". Source agreement replaces the misleading percentage. The public `/milestone` page replaces the login-protected Vercel deployment URL in submission evidence.

The acceptance runner reuses historical queued-appeal assertions after resolution, restores original evidence when resuming, and waits for separately finalized native transfers. Offline checkpoint tests replay the saved journal without signing or broadcasting. Early-payout rejection, pending-appeal failure/retry/recovery, and runner interruption handling are local-test coverage; they are not presented as additional live StudioNet transactions.

Refund protection applies to known validation branches of the implemented payable methods. It is not a guarantee for arbitrary malformed calls, unsupported methods, direct GEN sends, VM failures, or every possible native-transfer failure. Only the two successful native withdrawals in the journal are claimed as live transfer evidence. Contract V1.3.1 and its source hash remain unchanged by these interface/tooling corrections.

## Reviewer path

1. Start at https://microwagers.vercel.app/milestone, then open `w-3`. Inspect the final wager, 2 / 2 source agreement, 0.003 GEN test pot, and separate Original and Appeal records.
2. Expand both original source findings. Compare their distinct host URLs, exact citations, 559-byte snapshots, and source digests. Confirm the appeal refers to those same frozen source fingerprints.
3. Open https://microwagers.vercel.app/markets?wager=w-2. Confirm timeout refund, empty winner, and no fabricated adjudication record.
4. Open https://microwagers.vercel.app/markets?wager=w-1. Confirm an unmatched cancellation and refund.
5. Open https://microwagers.vercel.app/status and compare address, zero fee, appeal and timeout configuration, and accounting with the StudioNet Explorer. `/api/health` distinguishes the app and contract versions.

No wallet connection is required to inspect these completed records. A wallet is only needed to create, match, appeal, or withdraw a live wager.

## Verification

- GenVM lint and validation: 3 checks passed.
- Direct contract tests: 43 passed.
- Frontend tests: 36 passed, including actual saved StudioNet cancellation data and return-value rejection cases. TypeScript check and Next.js production build passed.
- Offline acceptance-runner and submission-guide tests: 9 checks, including interrupted checkpoints, delayed native transfer finality, description length, and public evidence routing. These do not submit chain transactions.
- Read-only receipt replay: all 21 historical transactions passed against raw, SDK-normalized, and simplified receipts. Valid action returns are accepted; refund/rejection results are not confused with action success. Run `pnpm verify:receipts` in the web app to repeat this read-only check.
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
