# MicroWagers — Project Explorer submission

Use this dedicated repository as a standalone MicroWagers submission. Do not combine it with StreakPact, BountyForge, or another product.

## Application date

`05/09/2026`

If submitting after that date, replace it with the actual submission date.

## 01 — Identity

- Project name: `MicroWagers by demigodd00`
- Logo upload: [`docs/assets/microwagers/microwagers-logo.png`](assets/microwagers/microwagers-logo.png)
- Primary tag: `Prediction Markets`
- Tag 1: `Outcome Resolution`
- Tag 2: `Event Forecasting`

## 02 — One-liner

```text
Peer-to-peer StudioNet predictions settled from public web evidence by GenLayer validator consensus.
```

## 03 — Description

The following text is 968 characters, below the Portal's 1,000-character limit.

```text
MicroWagers by demigodd00 is a peer-to-peer prediction app on GenLayer StudioNet; test GEN has no monetary value. A creator posts a binary question, two positions, a public HTTPS source, a deadline, and a test stake; another wallet matches it. After the deadline, GenLayer validators fetch the source and use comparative consensus to decide which position it supports. The contract preserves the exact source snapshot, SHA-256 digest, outcome, confidence, reason, winner, and judgment time. A losing participant can fund one independent validator refetch, while original and appeal records remain separate and public. Decisive results settle escrow; ambiguous evidence refunds both users. Any wallet can trigger timeout recovery if adjudication does not finalize within ten minutes. No admin can choose a winner or move participant escrow. The deployed V1.2.1 flow was verified by three wallets through cancellation, matching, resolution, appeal, payout, and recovery.
```

## 04 — Demo video

Leave the optional YouTube URL blank. Do not paste the website or a non-YouTube video URL into this field.

## 05 — How-to

### Step 1

- Optional heading: `Open the settled wager`
- Instruction: `Open https://microwagers.vercel.app/markets?wager=w-3 without connecting a wallet. Confirm it is SETTLED and APPEALED, the taker 0x3Ba5…4dEB won, the outcome is “No — the source states something different,” confidence is 90%, and the displayed pot + appeal bond is 0.003 test GEN.`

### Step 2

- Optional heading: `Inspect both adjudications`
- Instruction: `In w-3, inspect the Original and Appeal cards under Immutable adjudication records. Expand Stored source snapshot in both. Confirm separate judgment times and the same 559-byte Example Domain snapshot with SHA-256 ff67a9d764d6…871a299d.`

### Step 3

- Optional heading: `Verify timeout recovery`
- Instruction: `Open https://microwagers.vercel.app/markets?wager=w-2. Confirm it is VOIDED with [RESOLUTION TIMEOUT], 0.002 test GEN refunded, confidence shown as —, No action required, and no adjudication audit trail because no validator result finalized.`

### Step 4

- Optional heading: `Verify the release`
- Instruction: `Open https://microwagers.vercel.app/status and the contract link below. Confirm 3 wagers created, 1 settled, 0% protocol fee, a 5m appeal window, a 10m refund timeout, no settlement controls, and contract 0xbe655aa17d1b4d31021791F0640a8c4677A11899.`

## 06 — Expected verification outcome

```text
Stewards see w-3 SETTLED and APPEALED: the taker won at 90% confidence, with separate Original and Appeal records preserving the same 559-byte source snapshot and SHA-256 digest. Wager w-2 is VOIDED by timeout, refunds 0.002 test GEN, and has no adjudication record. The status page and Explorer confirm V1.2.1 at 0xbe655aa17d1b4d31021791F0640a8c4677A11899, 0% fee, 5m appeal, 10m refund timeout, and no admin settlement controls.
```

## Contract deployments

- Contract link 1: `https://explorer-studio.genlayer.com/address/0xbe655aa17d1b4d31021791F0640a8c4677A11899`

Do not add the previous MicroWagers address. This is the verified V1.2.1 StudioNet deployment.

## 07 — Project links

- Website: `https://microwagers.vercel.app`
- GitHub: `https://github.com/Demigodd00/microwagers-genlayer`

## Evidence and supporting information

Paste this into the required evidence field and let the Portal detect `GitHub Repository`:

`https://github.com/Demigodd00/microwagers-genlayer`

Add these recommended supporting links:

1. Evidence type `GenLayer Explorer Contract`
   `https://explorer-studio.genlayer.com/address/0xbe655aa17d1b4d31021791F0640a8c4677A11899`
2. Evidence type `Other` — live product
   `https://microwagers.vercel.app`
3. Evidence type `GitHub File` — exact intelligent-contract source
   `https://github.com/Demigodd00/microwagers-genlayer/blob/f9bd31ef33a24c6a9514afeef58215629ab3d160/contracts/micro_wagers.py`
4. Evidence type `GitHub File` — exact StudioNet deployment receipt
   `https://github.com/Demigodd00/microwagers-genlayer/blob/f9bd31ef33a24c6a9514afeef58215629ab3d160/deployments/micro_wagers_studionet.json`
5. Evidence type `GitHub File` — exact-address acceptance journal
   `https://github.com/Demigodd00/microwagers-genlayer/blob/f9bd31ef33a24c6a9514afeef58215629ab3d160/deployments/micro_wagers_acceptance.json`
6. Evidence type `GitHub File` — final release notes
   `https://github.com/Demigodd00/microwagers-genlayer/blob/f9bd31ef33a24c6a9514afeef58215629ab3d160/docs/MICROWAGERS_RELEASE.md`

## Final checks before submission

1. Confirm the preview says `MicroWagers by demigodd00`, not StreakPact or BountyForge.
2. Confirm the contract address ends in `11899` everywhere.
3. Open every URL once and ensure it is clickable.
4. Complete the reCAPTCHA personally.
5. Leave Demo video blank unless a real public or unlisted YouTube URL exists.
6. Submit only after the Portal preview shows all seven required fields complete.

The Portal submission itself must be completed by the wallet owner; this document does not submit or resubmit anything automatically.
