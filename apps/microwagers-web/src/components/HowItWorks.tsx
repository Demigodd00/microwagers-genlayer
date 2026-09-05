export default function HowItWorks() {
  return (
    <section className="how-section">
      <div className="how-heading"><p className="eyebrow">How it works</p><h1>Post. Match. Resolve.</h1><p>MicroWagers is a zero-value StudioNet lab for testing source-based validator judgment.</p></div>
      <div className="how-grid">
        <article><span>01</span><h3>Fix the question</h3><p>Choose two clear sides, a public HTTPS source, a deadline, and a test stake.</p></article>
        <article><span>02</span><h3>Match the stake</h3><p>Another wallet takes the other side with the same amount of valueless test GEN.</p></article>
        <article><span>03</span><h3>Resolve and appeal</h3><p>Validators fetch the source when resolution is requested. The losing participant gets one bonded appeal.</p></article>
      </div>
      <div className="boundary-grid">
        <div><p className="eyebrow">GenLayer decides</p><h3>Which side the fetched source supports.</h3><p>Validators agree on the page bytes, outcome, and confidence bucket. Both adjudication records remain public.</p></div>
        <div><p className="eyebrow">Recovery boundary</p><h3>No wager stays locked forever.</h3><p>Ambiguous evidence is refunded. If resolution cannot finalize, anyone can trigger a refund after the timeout.</p></div>
      </div>
    </section>
  );
}
