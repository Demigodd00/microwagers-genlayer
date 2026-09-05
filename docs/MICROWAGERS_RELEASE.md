# MicroWagers StudioNet release

MicroWagers by demigodd00 is a source-bound, two-sided prediction market for GenLayer StudioNet. Test GEN has no monetary value. This release is separate from the StreakPact submission.

## Release identity

| Item | Release value |
|---|---|
| Live app | https://microwagers.vercel.app |
| Read-only status | https://microwagers.vercel.app/status |
| Contract | `0xbe655aa17d1b4d31021791F0640a8c4677A11899` |
| Explorer | https://explorer-studio.genlayer.com/address/0xbe655aa17d1b4d31021791F0640a8c4677A11899 |
| Deployment transaction | `0xe096d44ab3ad194760cc71c9c1c22331eaebffcdf94ac9e4ab2455965a7ff7e5` |
| Source SHA-256 | `3c786a3e74a6579b66438782e5443d1981c4e3fcef76d5b4ce818ad4835dfe46` |
| Fee | `0` basis points |
| Appeal window | `300` seconds |
| Unresolved-market recovery | `600` seconds after deadline |
| Web deployment | `dpl_GyMk3AvTFtkUcMcoPB5URcQrZZmm` |
| Application source commit | `c3a083804004871d37d65bb6f2f1370753cfc9de` |
| Release records commit | `cab4c021203cda99595e11df389ee5332e37fd86` |

The exact deployment, acceptance, and hosting records are in [`deployments/micro_wagers_studionet.json`](../deployments/micro_wagers_studionet.json), [`deployments/micro_wagers_acceptance.json`](../deployments/micro_wagers_acceptance.json), and [`deployments/micro_wagers_vercel.json`](../deployments/micro_wagers_vercel.json). Superseded V1.1 and V1.2 records are retained under `deployments/history/`.

## Why this is GenLayer-native

GenLayer is the settlement layer, not a generic AI add-on. After a matched market reaches its deadline, validators fetch the market's immutable public HTTPS source and independently compare that evidence with the two fixed positions. Comparative consensus requires agreement on both the outcome and a bounded confidence bucket. A decisive result changes escrow into provisional settlement; ambiguous or low-confidence evidence voids the wager and refunds both participants.

The losing participant may submit one bonded appeal. That starts an independent validator refetch and review using the original reason and appeal statement. Claims remain locked through the five-minute appeal window. No owner or admin can select a winner, rewrite a verdict, suppress an appeal, or move participant escrow.

## Evidence provenance

Each adjudication stores the exact UTF-8 source snapshot that validators compared, its SHA-256 digest, byte and character counts, source URL, judgment time, outcome, confidence bucket, winner, and reason. Invalid UTF-8, malformed or private source URLs, NUL bytes, and oversized content are rejected instead of being silently truncated.

Original and appeal adjudications are preserved as separate immutable records. The public app exposes both records and their exact snapshots. This proves which bytes GenLayer validators judged and when; it does not claim that a fetched page was authored by a participant or that its contents were historically frozen at the market deadline.

If no adjudication finalizes within ten minutes after the deadline, any wallet can call the recovery method. The contract voids the unresolved market and credits both original test stakes. This prevents StudioNet liveness issues from trapping test GEN.

## User and owner boundaries

Users can create, match, cancel an unmatched wager, request resolution after the deadline, appeal a provisional loss, claim after the appeal window, or trigger timeout recovery. The interface checks network, role, amount, deadline, and finality, while the contract independently enforces every rule.

The deployer is only the deployment account and zero-fee treasury. `/status` is read-only and exposes the contract address, release configuration, and public activity totals. It has no settlement controls. V1.2.1 also keeps unassigned Address placeholders private: unmatched wagers return an empty taker, and LIVE or VOIDED wagers return an empty winner until a decisive settlement exists.

## Exact-address acceptance

The V1.2.1 release was exercised against the exact deployed address with creator, taker, and independent observer wallets:

- deployment source and all constructor settings matched the validated local release;
- a non-creator cancellation failed, then creator cancellation returned the unmatched `0.001` test-GEN stake;
- self-matching, incorrect stake, early resolution, early timeout recovery, invalid appeal roles, duplicate appeal, premature claim, and non-winner claim all failed as intended;
- the observer permissionlessly recovered matched unresolved wager `w-2`, and both `0.001` test-GEN stakes were credited;
- validators resolved `w-3` from Example Domain, storing its exact 559-byte snapshot and SHA-256 digest;
- the losing wallet appealed, validators independently refetched the source, and the original and appeal records remained separately visible;
- after the appeal window, the winner claimed the credited `0.003` test-GEN pot;
- OPEN, LIVE, and VOIDED reads exposed no false taker or winner assignments;
- final contract statistics were three created wagers and one settled wager.

The release also passed 37 direct contract tests, 30 frontend tests, TypeScript validation, a Next.js production build, a production dependency audit with no known high-severity vulnerabilities, production route and health checks, security-header checks, and both GitHub workflows for source commit `c3a083804004871d37d65bb6f2f1370753cfc9de`.

## Reviewer path

1. Open https://microwagers.vercel.app/markets?wager=w-3 for the settled and appealed lifecycle, including both immutable adjudication records.
2. Open https://microwagers.vercel.app/markets?wager=w-2 for permissionless timeout recovery and both refunded stakes.
3. Open https://microwagers.vercel.app/status to compare the live address and release settings with the Explorer and JSON records.

## Repeat the release gate

```bash
python scripts/check_micro_wagers_release.py --require-hosting
```

Real acceptance writes are already recorded. `scripts/microwagers_acceptance.py` is resume-safe and reuses recorded transaction hashes; do not delete its journal and rerun it casually.

## Scope

This is a StudioNet demonstration, not a real-money product or a mainnet security claim. Sources must be public HTTPS pages, readable by validators, bounded in size, and suitable for objective comparison. StudioNet availability and validator consensus can add confirmation time. Genuinely ambiguous evidence is intentionally refunded rather than forced into a winner.
