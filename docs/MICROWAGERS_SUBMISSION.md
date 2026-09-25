# MicroWagers milestone contribution

Use this for the existing accepted MicroWagers project's Milestone flow, not as a new Project application. The accepted V1.2.1 contract remains deployed and preserved in the repository's deployment history; this contribution documents new, verifiable work in V1.3.1.

## Milestone form

- Contribution date: 25/09/2026
- Title: Dual-source adjudication and failure-safe settlement
- Contribution type: Builder
- Notes / description:

Shipped MicroWagers V1.3.1 as a separate StudioNet Intelligent Contract deployment. Each wager now pins two HTTPS sources on distinct hosts. GenLayer validators independently fetch both after the deadline, record source-specific findings with exact citations, and settle only when both sources agree decisively; ambiguous or unverifiable evidence refunds both sides. The release adds retryable, separately resolved appeals against frozen original snapshots, timeout recovery for pending appeals, and claimable GEN accounting so failed payable calls, refunds, and payouts cannot silently strand participant value. The app now exposes source provenance, pending appeal actions, claimable balances, and contract accounting. Exact-address acceptance passed on StudioNet with two participant wallets and an independent observer, covering creation, matching, cancellation, invalid payable refunds, dual-source resolution, appeal, payout lock, timeout refunds, and withdrawals. Final on-chain accounting showed zero escrow and zero liabilities. StudioNet test GEN has no monetary value.

## Evidence links

Add the evidence types shown below. The repository is the required primary evidence; contract, release receipt, exact-address acceptance journal, and live app are supporting evidence.

1. Required — GitHub Repository
   https://github.com/Demigodd00/microwagers-genlayer
2. GenLayer Explorer Contract
   https://explorer-studio.genlayer.com/address/0x07D4eD4B2293faE326BaF9a943Ed3a56E04D8D4a
3. GitHub File — exact deployed Intelligent Contract source
   https://github.com/Demigodd00/microwagers-genlayer/blob/main/contracts/micro_wagers.py
4. GitHub File — exact deployment receipt and constructor settings
   https://github.com/Demigodd00/microwagers-genlayer/blob/main/deployments/micro_wagers_studionet.json
5. GitHub File — exact-address, multi-wallet acceptance journal
   https://github.com/Demigodd00/microwagers-genlayer/blob/main/deployments/micro_wagers_milestone1_v131_acceptance.json
6. Other — live application
   https://microwagers.vercel.app
7. Other — milestone release notes
   https://github.com/Demigodd00/microwagers-genlayer/blob/main/docs/MICROWAGERS_RELEASE.md

## Reviewer notes

The contribution is distinguishable from the accepted V1.2.1 project: it deploys contract 0x07D4…8D4a with source hash 2ed0386b…e736d6, while the accepted deployment remains at 0xbe655…11899. The new acceptance journal proves the exact deployment and records three markets: w-1 cancellation, w-2 unresolved timeout refund, and w-3 decisive dual-source result plus a separately preserved appeal. Both configured sources are distinct hosts and each has its own finding and exact citation. The sources happened to return the same 559-byte Example Domain content in this test; this is disclosed in the release notes rather than presented as two different page contents.

The app remains at https://microwagers.vercel.app; this milestone updates that live app to V1.3.1 only after production health and contract-address checks pass. The milestone itself must be submitted manually by the project owner in GenLayer Portal. No transaction, captcha, or Portal submission is performed by this guide.
