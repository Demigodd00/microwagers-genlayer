"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONTRACT_READY,
  acceptWager,
  appealWager,
  cancelWager,
  claimWager,
  formatGen,
  friendlyError,
  getWager,
  listWagers,
  resolveWager,
  shortenAddress,
  voidUnresolvedWager,
  type AdjudicationRecord,
  type TxProgress,
  type WagerSummary,
  type WagerView,
  type WalletSession,
} from "@/lib/contract";
import { formatCountdown, marketShareUrl, rereadUntilStatusMatches, transactionPending } from "@/lib/ui-state";
import TxNotice from "./TxNotice";

const emptyRecord: AdjudicationRecord = {
  exists: false,
  outcome: "",
  outcome_label: "",
  winner: "",
  confidence_bucket: "0",
  reason: "",
  source_url: "https://example.com/",
  source_digest: "",
  source_snapshot: "",
  source_bytes: "0",
  source_chars: "0",
  judged_at_unix: "0",
  judged_at_iso: "",
  provenance: "",
};

const demoWager: WagerView = {
  id: "w-preview",
  status: "OPEN",
  question: "When validators resolve this wager after the deadline, does the source page state that this domain is reserved for illustrative examples?",
  creator_side: "Yes, the page says it is for illustrative examples",
  taker_side: "No, the page says something different",
  stake_atto: "1000000000000000",
  outcome_label: "",
  appealed: false,
  source_url: "https://example.com/",
  creator: "0x8a7F943b8C9B22D9aA8D3c05F44A2221090Be710",
  taker: "0x8a7F943b8C9B22D9aA8D3c05F44A2221090Be710",
  deadline_unix: String(Math.floor(Date.now() / 1000) + 600),
  created_at_iso: new Date().toISOString(),
  winner: "0x8a7F943b8C9B22D9aA8D3c05F44A2221090Be710",
  confidence_bucket: "0",
  verdict_reason: "",
  resolved_at_unix: "0",
  resolved_at_iso: "",
  appeal_deadline_unix: "0",
  resolution_recovery_unix: String(Math.floor(Date.now() / 1000) + 1200),
  recoverable: false,
  claimable: false,
  appeal_statement: "",
  pot_bonus_atto: "0",
  pot_atto: "2000000000000000",
  original_record: emptyRecord,
  appeal_record: emptyRecord,
};

function statusLabel(status: string): string {
  return status.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function stakePresentation(wager: WagerView): { amountAtto: string; label: string } {
  const unmatched = wager.taker.toLowerCase() === wager.creator.toLowerCase();
  if (wager.status === "OPEN") return { amountAtto: wager.stake_atto, label: "creator stake" };
  if (wager.status === "VOIDED") {
    return { amountAtto: unmatched ? wager.stake_atto : String(BigInt(wager.stake_atto) * 2n), label: "refunded" };
  }
  return { amountAtto: wager.pot_atto, label: wager.appealed && BigInt(wager.pot_bonus_atto) > 0n ? "pot + appeal bond" : "matched pot" };
}

export default function MarketBoard({ session }: { session: WalletSession | null }) {
  const [items, setItems] = useState<WagerSummary[]>([]);
  const [selected, setSelected] = useState<WagerView | null>(null);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "LIVE" | "RESOLVED">("ALL");
  const [lookupId, setLookupId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedId = useRef("");
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    if (!CONTRACT_READY) {
      setItems([demoWager]);
      setSelected(demoWager);
      setLookupId(demoWager.id);
      setLoading(false);
      return;
    }
    try {
      const nextItems = await listWagers();
      if (version !== requestVersion.current) return;
      setItems(nextItems);
      const params = new URLSearchParams(window.location.search);
      const sharedId = params.get("wager");
      const nextId = selectedId.current || sharedId || nextItems[0]?.id;
      if (nextId) {
        if (!/^w-\d+$/.test(nextId)) throw new Error("Enter a wager ID such as w-3.");
        const firstDetails = await getWager(nextId);
        const expectedStatus = nextItems.find((item) => item.id === nextId)?.status;
        const details = await rereadUntilStatusMatches(firstDetails, expectedStatus, () => getWager(nextId));
        if (version !== requestVersion.current) return;
        selectedId.current = nextId;
        setLookupId(nextId);
        setSelected(details);
      } else {
        setSelected(null);
      }
    } catch (reason) {
      if (version === requestVersion.current) setError(friendlyError(reason));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  async function selectWager(wagerId: string) {
    wagerId = wagerId.trim();
    if (!CONTRACT_READY) return;
    if (!/^w-\d+$/.test(wagerId)) { setError("Enter a wager ID such as w-3."); return; }
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const details = await getWager(wagerId);
      if (version !== requestVersion.current) return;
      selectedId.current = wagerId;
      setLookupId(wagerId);
      setSelected(details);
      window.history.replaceState(null, "", marketShareUrl(window.location.origin, wagerId));
    } catch (reason) {
      if (version === requestVersion.current) setError(friendlyError(reason));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "RESOLVED") return ["PROVISIONAL", "SETTLED", "VOIDED"].includes(item.status);
    return item.status === filter;
  }), [items, filter]);

  if (loading && items.length === 0 && !selected) return <div className="loading-panel" role="status"><span />Loading markets…</div>;

  if (error && items.length === 0 && !selected) {
    return <div className="empty-panel"><p className="eyebrow">Markets unavailable</p><h2>StudioNet did not answer.</h2><p>{error}</p><button className="button button-secondary" onClick={() => void load()}>Try again</button></div>;
  }

  return (
    <section className="market-layout">
      <aside className="market-list">
        <div className="list-heading"><div><p className="eyebrow">Market board</p><h2>{items.length} wager{items.length === 1 ? "" : "s"}</h2></div><button className="icon-button" onClick={() => void load()} disabled={loading} aria-label="Refresh markets">↻</button></div>
        <form className="market-lookup" onSubmit={(event) => { event.preventDefault(); void selectWager(lookupId); }}><input value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="Open w-…" aria-label="Wager ID to open" /><button disabled={!lookupId.trim() || loading}>Open</button></form>
        <div className="filter-row" aria-label="Market filters">
          {(["ALL", "OPEN", "LIVE", "RESOLVED"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value.toLowerCase()}</button>)}
        </div>
        {!CONTRACT_READY ? <div className="preview-ribbon">Product preview</div> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="market-items">
          {visibleItems.map((item) => (
            <button className={`market-item ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => void selectWager(item.id)}>
              <span className={`status-dot status-${item.status.toLowerCase()}`} />
              <span><small>{item.id} · {statusLabel(item.status)}</small><strong>{item.question}</strong><em>{formatGen(item.stake_atto)} test GEN per side</em></span>
            </button>
          ))}
          {visibleItems.length === 0 ? <p className="list-empty">No markets in this filter.</p> : null}
        </div>
      </aside>
      {selected ? <MarketDetail session={session} wager={selected} onRefresh={async () => { await load(); }} /> : <div className="empty-panel"><p className="eyebrow">No markets yet</p><h2>Post the first wager.</h2></div>}
    </section>
  );
}

export function MarketDetail({ session, wager: storedWager, onRefresh }: { session: WalletSession | null; wager: WagerView; onRefresh: () => Promise<void> }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [appealStatement, setAppealStatement] = useState("");
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [error, setError] = useState("");
  const busy = transactionPending(progress);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const wager = {
    ...storedWager,
    original_record: storedWager.original_record ?? emptyRecord,
    appeal_record: storedWager.appeal_record ?? emptyRecord,
    resolution_recovery_unix: storedWager.resolution_recovery_unix ?? "0",
    claimable: storedWager.status === "PROVISIONAL" && now > Number(storedWager.appeal_deadline_unix),
  };
  const account = session?.address.toLowerCase() ?? "";
  const creator = wager.creator.toLowerCase();
  const taker = wager.taker.toLowerCase();
  const unmatched = taker === creator;
  const winner = wager.winner.toLowerCase();
  const isCreator = account !== "" && account === creator;
  const isTaker = account !== "" && account === taker && taker !== creator;
  const isWinner = account !== "" && account === winner;
  const isLoser = (isCreator || isTaker) && !isWinner;
  const pastDeadline = now >= Number(wager.deadline_unix);
  const recoveryAvailable = wager.status === "LIVE" && Number(wager.resolution_recovery_unix) > 0 && now > Number(wager.resolution_recovery_unix);
  const appealOpen = wager.status === "PROVISIONAL" && now <= Number(wager.appeal_deadline_unix);
  const stake = stakePresentation(wager);

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setError("");
    if (!session || !CONTRACT_READY) { setError(CONTRACT_READY ? "Connect your wallet to continue." : "Transactions are disabled in preview mode."); return; }
    try { await action(); await onRefresh(); }
    catch (reason) { setError(friendlyError(reason)); }
  }

  async function copyLink() {
    const link = marketShareUrl(window.location.origin, wager.id);
    try { await navigator.clipboard.writeText(link); setProgress({ state: "confirmed", label: "Wager link copied" }); }
    catch { setError(`Copy this wager link: ${link}`); }
  }

  function submitAppeal() {
    if (appealStatement.trim().length < 10) { setError("Explain the appeal in at least 10 characters."); return; }
    void run(() => appealWager(session!, wager.id, appealStatement.trim(), BigInt(wager.stake_atto), setProgress));
  }

  return (
    <article className="market-detail">
      <header className="detail-header">
        <div><div className="detail-chips"><span className="id-chip">{wager.id}</span><span className={`status-chip status-${wager.status.toLowerCase()}`}>{statusLabel(wager.status)}</span>{wager.appealed ? <span className="appeal-chip">Appealed</span> : null}</div><h2>{wager.question}</h2></div>
        <button className="button button-secondary" onClick={() => void copyLink()} disabled={busy}>Copy link</button>
      </header>

      <div className="source-card"><span>Resolution source</span><a href={wager.source_url} target="_blank" rel="noreferrer">{wager.source_url} ↗</a><small>Fetched when adjudication runs after the deadline—not snapshotted at the deadline.</small></div>

      <div className="sides-grid">
        <div className={wager.outcome_label === wager.creator_side ? "winning-side" : ""}><span>Creator · {shortenAddress(wager.creator)}</span><strong>{wager.creator_side}</strong></div>
        <div className={wager.outcome_label === wager.taker_side ? "winning-side" : ""}><span>{wager.status === "OPEN" ? "Open side" : unmatched ? "No taker" : `Taker · ${shortenAddress(wager.taker)}`}</span><strong>{wager.taker_side}</strong></div>
      </div>

      {wager.status === "VOIDED" ? <div className="callout"><strong>Wager voided</strong><p>{wager.verdict_reason || "The wager was cancelled or could not be determined. Test stakes were refunded."}</p></div> : null}

      <div className="metric-row">
        <div><span>Test GEN</span><strong>{formatGen(stake.amountAtto)}</strong><small>{stake.label}</small></div>
        <div><span>Deadline</span><strong>{pastDeadline ? "Reached" : formatCountdown(wager.deadline_unix, now)}</strong><small>{new Date(Number(wager.deadline_unix) * 1000).toLocaleString()}</small></div>
        <div><span>Confidence</span><strong>{wager.confidence_bucket === "0" ? "—" : `${wager.confidence_bucket}%`}</strong><small>validator bucket</small></div>
      </div>

      {wager.verdict_reason ? <section className="verdict-card"><p className="eyebrow">Validator verdict</p><h3>{wager.outcome_label || "Undetermined"}</h3><p>{wager.verdict_reason}</p>{wager.appeal_statement ? <blockquote><strong>Appeal:</strong> {wager.appeal_statement}</blockquote> : null}</section> : null}

      {wager.original_record.exists || wager.appeal_record.exists ? (
        <section className="audit-trail" aria-label="Adjudication audit trail">
          <div><p className="eyebrow">Audit trail</p><h3>Immutable adjudication records</h3></div>
          <div className="audit-grid">
            {wager.original_record.exists ? <AuditRecord label="Original" record={wager.original_record} /> : null}
            {wager.appeal_record.exists ? <AuditRecord label="Appeal" record={wager.appeal_record} /> : null}
          </div>
        </section>
      ) : null}

      <section className="action-panel">
        <div><p className="eyebrow">Next step</p><h3>{actionHeading(wager, isCreator, pastDeadline, appealOpen, recoveryAvailable)}</h3></div>
        <fieldset disabled={busy}>
          {wager.status === "OPEN" && isCreator ? <button className="button button-danger" onClick={() => void run(() => cancelWager(session!, wager.id, setProgress))}>Cancel and refund</button> : null}
          {wager.status === "OPEN" && !isCreator && !pastDeadline ? <button className="button button-primary" onClick={() => void run(() => acceptWager(session!, wager.id, BigInt(wager.stake_atto), setProgress))}>Match {formatGen(wager.stake_atto)} test GEN</button> : null}
          {wager.status === "OPEN" && !isCreator && pastDeadline ? <p className="muted">The matching deadline has passed.</p> : null}
          {wager.status === "LIVE" && pastDeadline ? <button className="button button-primary" onClick={() => void run(() => resolveWager(session!, wager.id, setProgress))}>Ask validators to resolve</button> : null}
          {recoveryAvailable ? <button className="button button-secondary" onClick={() => void run(() => voidUnresolvedWager(session!, wager.id, setProgress))}>Refund both test stakes</button> : null}
          {wager.status === "LIVE" && pastDeadline && !recoveryAvailable ? <p className="muted">Timeout refund opens in {formatCountdown(wager.resolution_recovery_unix, now)}.</p> : null}
          {wager.status === "LIVE" && !pastDeadline ? <p className="muted">Resolution opens in {formatCountdown(wager.deadline_unix, now)}.</p> : null}
          {wager.status === "PROVISIONAL" && appealOpen && isLoser && !wager.appealed ? <div className="appeal-form"><label><span>Appeal statement</span><textarea rows={3} maxLength={800} value={appealStatement} onChange={(event) => setAppealStatement(event.target.value)} placeholder="Explain what the source or verdict got wrong." /></label><button className="button button-secondary" onClick={submitAppeal}>Appeal with {formatGen(wager.stake_atto)} test GEN bond</button></div> : null}
          {wager.status === "PROVISIONAL" && appealOpen && !isLoser ? <p className="muted">Payout remains locked for {formatCountdown(wager.appeal_deadline_unix, now)}.</p> : null}
          {wager.status === "PROVISIONAL" && wager.claimable && isWinner ? <button className="button button-primary" onClick={() => void run(() => claimWager(session!, wager.id, setProgress))}>Claim {formatGen(wager.pot_atto)} test GEN</button> : null}
          {!session && ["OPEN", "LIVE", "PROVISIONAL"].includes(wager.status) ? <p className="muted">Connect your wallet to take an action.</p> : null}
        </fieldset>
        {session ? <p className="account-note">Acting as {shortenAddress(session.address)}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <TxNotice progress={progress} />
      </section>
    </article>
  );
}

function actionHeading(wager: WagerView, isCreator: boolean, pastDeadline: boolean, appealOpen: boolean, recoveryAvailable: boolean): string {
  if (wager.status === "OPEN") return isCreator ? "Share or cancel" : pastDeadline ? "Closed to matching" : "Take the other side";
  if (wager.status === "LIVE") return recoveryAvailable ? "Resolve or recover the stakes" : pastDeadline ? "Ready for validator resolution" : "Waiting for the deadline";
  if (wager.status === "PROVISIONAL") return appealOpen ? "Verdict open to appeal" : "Winner can claim";
  if (wager.status === "SETTLED") return "Wager settled";
  return "No action required";
}

function AuditRecord({ label, record }: { label: string; record: AdjudicationRecord }) {
  const digest = record.source_digest ? `${record.source_digest.slice(0, 12)}…${record.source_digest.slice(-8)}` : "—";
  return (
    <article>
      <span>{label}</span>
      <strong>{record.outcome_label || "Refund"} · {record.confidence_bucket}%</strong>
      <code title={record.source_digest}>SHA-256 {digest}</code>
      <small>{record.judged_at_iso ? new Date(record.judged_at_iso).toLocaleString() : ""} · {record.source_bytes} bytes</small>
      <p>{record.reason}</p>
      {record.source_snapshot ? <details><summary>Stored source snapshot</summary><pre>{record.source_snapshot}</pre></details> : null}
    </article>
  );
}
