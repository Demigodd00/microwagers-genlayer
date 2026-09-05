"use client";

import { useMemo, useState } from "react";
import { CONTRACT_READY, createWager, formatGen, friendlyError, isPublicHttpsSource, parseGen, type TxProgress, type WalletSession } from "@/lib/contract";
import { transactionPending } from "@/lib/ui-state";
import TxNotice from "./TxNotice";

const demoTemplate = {
  question: "When validators resolve this wager after the deadline, does the source page state that this domain is reserved for illustrative examples?",
  creatorSide: "Yes, the page says it is for illustrative examples",
  takerSide: "No, the page says something different",
  sourceUrl: "https://example.com/",
};

function defaultDeadline(): string {
  const date = new Date(Date.now() + 10 * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function CreateMarket({ session, onCreated }: { session: WalletSession | null; onCreated: () => void }) {
  const [question, setQuestion] = useState(demoTemplate.question);
  const [creatorSide, setCreatorSide] = useState(demoTemplate.creatorSide);
  const [takerSide, setTakerSide] = useState(demoTemplate.takerSide);
  const [sourceUrl, setSourceUrl] = useState(demoTemplate.sourceUrl);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [stake, setStake] = useState("0.001");
  const [reviewing, setReviewing] = useState(false);
  const [created, setCreated] = useState(false);
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [error, setError] = useState("");
  const busy = transactionPending(progress);

  const stakeAtto = useMemo(() => {
    try { return parseGen(stake); } catch { return 0n; }
  }, [stake]);

  function resetTemplate() {
    if (busy) return;
    setQuestion(demoTemplate.question);
    setCreatorSide(demoTemplate.creatorSide);
    setTakerSide(demoTemplate.takerSide);
    setSourceUrl(demoTemplate.sourceUrl);
    setDeadline(defaultDeadline());
    setReviewing(false);
  }

  function validate(): string {
    if (!question.trim() || question.trim().length > 500) return "Enter a question with no more than 500 characters.";
    if (!creatorSide.trim() || creatorSide.trim().length > 80) return "Describe your side in no more than 80 characters.";
    if (!takerSide.trim() || takerSide.trim().length > 80) return "Describe the other side in no more than 80 characters.";
    if (creatorSide.trim().toLowerCase() === takerSide.trim().toLowerCase()) return "The two sides must be different.";
    if (!isPublicHttpsSource(sourceUrl)) return "Use a public HTTPS source with a valid domain and no embedded credentials.";
    if (stakeAtto < 10n ** 15n || stakeAtto > 10n * 10n ** 18n) return "Choose a test stake between 0.001 and 10 GEN.";
    if (new Date(deadline).getTime() < Date.now() + 2 * 60_000) return "Set the deadline at least two minutes from now.";
    return "";
  }

  function openReview() {
    const nextError = validate();
    setError(nextError);
    if (!nextError) setReviewing(true);
  }

  async function submit() {
    if (busy) return;
    if (!session) { setError("Connect your wallet before posting a wager."); return; }
    if (!CONTRACT_READY) { setError("Transactions are unavailable in preview mode."); return; }
    const nextError = validate();
    if (nextError) { setError(nextError); return; }
    setError("");
    try {
      await createWager(session, {
        question: question.trim(),
        creatorSide: creatorSide.trim(),
        takerSide: takerSide.trim(),
        sourceUrl: sourceUrl.trim(),
        deadlineUnix: Math.floor(new Date(deadline).getTime() / 1000),
        stakeAtto,
      }, setProgress);
      setCreated(true);
      onCreated();
    } catch (reason) { setError(friendlyError(reason)); }
  }

  if (created) {
    return (
      <section className="success-panel">
        <span className="success-mark">✓</span>
        <p className="eyebrow">Wager confirmed</p>
        <h2>Your market is live.</h2>
        <p>Share it with the person taking the other side.</p>
        <button className="button button-primary" onClick={() => { setCreated(false); setReviewing(false); }}>Post another</button>
      </section>
    );
  }

  return (
    <section className="create-layout">
      <aside className="template-panel">
        <p className="eyebrow">Safe demo</p>
        <h2>Start with a stable source.</h2>
        <p>The included example tests the full validator flow without claiming a real-world event occurred.</p>
        <button className="template-card" onClick={resetTemplate} disabled={busy}>
          <span>Source check</span>
          <strong>Example Domain</strong>
          <small>Objective page text · 10-minute deadline</small>
        </button>
        <div className="callout"><strong>Public-source rule</strong><p>Use a static UTF-8 text page up to 8,000 characters. Validators store the agreed snapshot and SHA-256 fingerprint.</p></div>
      </aside>

      <div className="form-card">
        <div className="form-heading"><div><p className="eyebrow">{reviewing ? "Review" : "New wager"}</p><h2>{reviewing ? "Check both sides" : "Post a prediction"}</h2></div><span>{reviewing ? "2 / 2" : "1 / 2"}</span></div>
        {reviewing ? (
          <div className="review-stack">
            <div className="review-question"><span>Question</span><h3>{question}</h3></div>
            <div className="sides-review">
              <div><span>Your side</span><strong>{creatorSide}</strong></div>
              <div><span>Other side</span><strong>{takerSide}</strong></div>
            </div>
            <dl className="review-grid">
              <div><dt>Your test stake</dt><dd>{formatGen(stakeAtto)} GEN</dd></div>
              <div><dt>Deadline</dt><dd>{new Date(deadline).toLocaleString()}</dd></div>
              <div className="review-wide"><dt>Resolution source</dt><dd>{sourceUrl}</dd></div>
            </dl>
            <div className="callout"><strong>Rules become permanent</strong><p>Matched wagers resolve after the deadline. A timed-out resolution can be refunded by anyone.</p></div>
            <div className="form-actions"><button className="button button-secondary" onClick={() => setReviewing(false)} disabled={busy}>Edit</button><button className="button button-primary" onClick={() => void submit()} disabled={busy}>{CONTRACT_READY ? "Confirm test stake" : "Preview only"}</button></div>
          </div>
        ) : (
          <div className="form-stack">
            <label><span>Question and resolution rule</span><textarea rows={4} maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
            <div className="field-row">
              <label><span>Your side</span><input maxLength={80} value={creatorSide} onChange={(event) => setCreatorSide(event.target.value)} /></label>
              <label><span>Other side</span><input maxLength={80} value={takerSide} onChange={(event) => setTakerSide(event.target.value)} /></label>
            </div>
            <label><span>Public HTTPS resolution source</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /><small>Validators fetch this page when resolution is requested after the deadline.</small></label>
            <div className="field-row">
              <label><span>Deadline in your timezone</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
              <label><span>Test stake in GEN</span><input inputMode="decimal" value={stake} onChange={(event) => setStake(event.target.value)} /></label>
            </div>
            <button className="button button-primary button-wide" onClick={openReview}>Review wager</button>
          </div>
        )}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <TxNotice progress={progress} />
      </div>
    </section>
  );
}
