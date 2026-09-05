import Link from "next/link";
import { CONTRACT_READY } from "@/lib/contract";

export default function MicroWagersApp() {
  return (
    <>
      <header className="hero">
        <div className="hero-copy">
          <div className="hero-kicker"><span />MicroWagers by demigodd00 · source-bound peer predictions</div>
          <h1>Make a call.<br />Name the source.</h1>
          <p>Two sides stake test GEN. After the deadline, GenLayer validators fetch the chosen source and settle the result.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/markets/new">Post a wager <span>→</span></Link>
            <Link className="button button-secondary button-large" href="/markets">Browse markets</Link>
          </div>
          <p className="environment-note">{CONTRACT_READY ? "StudioNet · Test GEN has no monetary value" : "Preview · Test GEN has no monetary value · transactions unavailable"}</p>
        </div>
        <div className="hero-visual" aria-label="Example resolved prediction">
          <div className="orb orb-a" /><div className="orb orb-b" />
          <div className="example-card">
            <div className="example-top"><span>EXAMPLE WAGER</span><small>W-12</small></div>
            <p>DOES THE SOURCE SUPPORT SIDE A?</p>
            <div className="example-sides"><div className="example-win"><span>A</span><strong>YES</strong><small>creator</small></div><div><span>B</span><strong>NO</strong><small>taker</small></div></div>
            <div className="example-bottom"><span>VALIDATOR RESULT</span><strong>90% · SIDE A</strong></div>
          </div>
          <div className="float-card source-float"><small>PUBLIC SOURCE</small><strong>example.com ↗</strong></div>
          <div className="float-card appeal-float"><small>SETTLEMENT</small><strong>Appeal protected</strong></div>
        </div>
      </header>
      <section className="trust-strip" aria-label="Product boundaries"><div><strong>Hashed source bytes</strong></div><div><strong>Two fixed sides</strong></div><div><strong>Timeout refunds</strong></div></section>
    </>
  );
}
