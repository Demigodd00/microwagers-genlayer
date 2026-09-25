export default function HowItWorks() {
  return (
    <section className="how-section">
      <div className="how-heading"><p className="eyebrow">How it works</p><h1>Post. Match. Resolve.</h1><p>MicroWagers is a zero-value StudioNet lab for testing source-based validator judgment.</p></div>
      <div className="how-grid">
        <article><span>01</span><h3>Fix the question</h3><p>Choose two clear sides, two public HTTPS sources on different hosts, a deadline, and a test stake.</p></article>
        <article><span>02</span><h3>Match the stake</h3><p>Another wallet takes the other side with the same amount of valueless test GEN.</p></article>
        <article><span>03</span><h3>Resolve and appeal</h3><p>Validators compare both sources. A bonded appeal is queued separately and rechecks the original frozen snapshots.</p></article>
      </div>
      <div className="boundary-grid">
        <div><p className="eyebrow">GenLayer decides</p><h3>Which side both sources support.</h3><p>Validators agree on both snapshots, cited findings, and outcome. Source agreement is not a confidence percentage or proof of publisher independence.</p></div>
        <div><p className="eyebrow">Recovery boundary</p><h3>Timeout recovery is permissionless.</h3><p>Ambiguous findings credit both stakes for withdrawal. If retrieval or consensus fails, anyone can request a timeout refund. Use Claim GEN to withdraw credited funds.</p></div>
      </div>
    </section>
  );
}
