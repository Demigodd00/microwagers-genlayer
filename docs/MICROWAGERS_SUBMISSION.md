# MicroWagers milestone contribution

Use this for the existing accepted MicroWagers project's Milestone flow, not as a new Project application. The accepted V1.2.1 contract remains deployed and preserved in the repository's deployment history; this contribution documents new, verifiable work in V1.3.1.

## Milestone form

- Contribution date: 25/09/2026
- Title: Dual-source adjudication, frozen appeals and claimable refunds
- Contribution type: Builder
- Notes / description:

MicroWagers now uses a separate V1.3.1 StudioNet contract for two-source adjudication. Validators fetch two pinned HTTPS pages on distinct hosts, record exact citations, and select a winner only when both findings agree. Appeals are queued separately and review frozen original snapshots without overwriting either record. Cancellation, settlement, and known invalid payable actions credit GEN for withdrawal; unresolved wagers and pending appeals have timeout recovery. The V1.3.2 app checks action results, displays source agreement instead of a confidence percentage, and shows correct cancellation amounts. Live tests used two participant wallets and a third observer wallet for matching, resolution, appeal, cancellation, timeout refunds, and withdrawals. Early-payout guards and interrupted-run recovery are tested locally. The demo sources returned identical content, so this proves two-host retrieval, not publisher independence. StudioNet test GEN has no monetary value.

## Evidence links

Attach links that identify this milestone's new deployment and code. The repository root and canonical app URL may already be present on the accepted Project submission and can be rejected as duplicate evidence; prefer the new contract address and commit-pinned file URLs below.

1. GenLayer Explorer Contract
   https://explorer-studio.genlayer.com/address/0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a
2. GitHub File — exact deployed Intelligent Contract source
   https://github.com/Demigodd00/microwagers-genlayer/blob/42cb16e6f45186329259debb7359b00efdf6b1ce/contracts/micro_wagers.py
3. GitHub File — exact deployment receipt and constructor settings
   https://github.com/Demigodd00/microwagers-genlayer/blob/42cb16e6f45186329259debb7359b00efdf6b1ce/deployments/micro_wagers_studionet.json
4. GitHub File — exact-address, multi-wallet acceptance journal
   https://github.com/Demigodd00/microwagers-genlayer/blob/42cb16e6f45186329259debb7359b00efdf6b1ce/deployments/micro_wagers_milestone1_v131_acceptance.json
5. Other — public milestone walkthrough (no Vercel login)
   https://microwagers.vercel.app/milestone

## Reviewer notes

The contribution is distinguishable from the accepted V1.2.1 project: it deploys contract 0x07D4…8D4a with source hash 2ed0386b…e736d6, while the accepted deployment remains at 0xbe655…11899. The new acceptance journal proves the exact deployment and records three markets: w-1 cancellation, w-2 unresolved timeout refund, and w-3 decisive dual-source result plus a separately preserved appeal. Both configured sources are distinct hosts and each has its own finding and exact citation. The sources happened to return the same 559-byte Example Domain content in this test; this is disclosed in the release notes rather than presented as two different page contents.

The app remains at https://microwagers.vercel.app. App V1.3.2 uses the same V1.3.1 contract; the review fixes did not redeploy or migrate participant funds. The public milestone page documents distinct new work rather than changing a URL to disguise duplicate evidence. Do not submit a deployment-specific Vercel URL: those can require team login. If Portal requires a GitHub Repository type, use the repository root in that field; the pinned links above are GitHub File evidence. If an already-used root is rejected, attach this to the existing accepted project's Milestone flow or ask the steward how to associate it, rather than creating another Project.

The milestone itself must be submitted manually by the project owner in GenLayer Portal. No transaction, captcha, or Portal submission is performed by this guide.
