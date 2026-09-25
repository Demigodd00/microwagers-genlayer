import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { CONTRACT_EXPLORER_URL } from "@/lib/contract";

export const metadata: Metadata = { title: "Milestone review · MicroWagers" };

export default function MilestonePage() {
  return (
    <AppShell>
      <section className="workspace how-section">
        <div className="how-heading">
          <p className="eyebrow">Milestone · Contract V1.3.1 · App V1.3.2</p>
          <h1>Two sources. Preserved appeals. Claimable refunds.</h1>
          <p>New work beyond the accepted V1.2.1 project. Inspect the completed StudioNet workflow without connecting a wallet. Test GEN has no monetary value.</p>
        </div>
        <div className="how-grid">
          <article><span>01</span><h3>Cited, two-source adjudication</h3><p>Validators fetch two pinned HTTPS pages on distinct hosts and agree on snapshots, findings, and exact citations. Both must support the same side.</p><Link href="/markets?wager=w-3">Inspect settled wager and appeal →</Link></article>
          <article><span>02</span><h3>Frozen-evidence appeals</h3><p>A bonded appeal is queued separately, then resolved against the original snapshots. Both records remain visible. Stalled appeals have bond recovery.</p><a href={CONTRACT_EXPLORER_URL} target="_blank" rel="noreferrer">Inspect the deployed contract →</a></article>
          <article><span>03</span><h3>Claimable accounting</h3><p>Known invalid payable actions credit the attached amount for withdrawal. Cancellation, timeout recovery, and winner settlement also create claimable balances.</p><Link href="/status">Inspect live accounting →</Link></article>
        </div>
        <div className="boundary-grid">
          <div><p className="eyebrow">Reviewer path</p><h3>Check all three records.</h3><p><Link href="/markets?wager=w-1">w-1: unmatched cancellation, 0.001 GEN credited</Link></p><p><Link href="/markets?wager=w-2">w-2: unresolved timeout, 0.002 GEN credited</Link></p><p><Link href="/markets?wager=w-3">w-3: agreement, upheld appeal, 0.003 GEN settlement</Link></p></div>
          <div><p className="eyebrow">Evidence limits</p><h3>What these tests prove.</h3><p>The live test used example.com and example.net, which returned identical content. This demonstrates two-host retrieval, not independent publishers. Early-payout rejection and pending-appeal recovery are covered by local tests, not claimed as live tests here.</p><p>The legacy contract bucket is a fixed policy flag, not a measured probability. The interface shows source agreement and preserves raw on-chain wording in the audit details.</p></div>
        </div>
        <div className="callout"><strong>Review fixes in App V1.3.2</strong><p>Refunded actions no longer appear successful, unmatched cancellation displays the correct amount, and the acceptance runner has offline interruption-recovery tests. The deployed contract address and existing records are unchanged.</p></div>
        <p><a href="https://github.com/Demigodd00/microwagers-genlayer/blob/main/docs/MICROWAGERS_RELEASE.md" target="_blank" rel="noreferrer">Release notes and verification evidence ↗</a></p>
      </section>
    </AppShell>
  );
}
