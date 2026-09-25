"use client";

import { useEffect, useState } from "react";
import { CONTRACT_ADDRESS, CONTRACT_EXPLORER_URL, CONTRACT_READY, NETWORK_NAME, formatGen, friendlyError, getAccounting, getStats, shortenAddress, type ContractAccounting, type MarketStats } from "@/lib/contract";

interface ReleaseHealth {
  contractConfigured: boolean;
  studioNetConfigured: boolean;
  readyForStudioNetTesting: boolean;
}

function duration(seconds: string): string {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value % 3600 === 0) return `${value / 3600}h`;
  if (value % 60 === 0) return `${value / 60}m`;
  return `${value}s`;
}

export default function StatusDashboard() {
  const [health, setHealth] = useState<ReleaseHealth | null>(null);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [accounting, setAccounting] = useState<ContractAccounting | null>(null);
  const [error, setError] = useState("");
  const [accountingError, setAccountingError] = useState("");

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" }).then((response) => response.json() as Promise<ReleaseHealth>).then(setHealth).catch(() => setHealth(null));
    if (CONTRACT_READY) {
      getStats().then(setStats).catch((reason) => setError(friendlyError(reason)));
      getAccounting().then(setAccounting).catch((reason) => setAccountingError(friendlyError(reason)));
    }
  }, []);

  return (
    <main className="status-shell">
      <header className="status-header"><a href="/" className="brand"><span className="brand-mark">M</span><span>MicroWagers<small>by demigodd00</small></span></a><a className="button button-secondary" href="/">Back to app</a></header>
      <section className="status-hero"><div><p className="eyebrow">StudioNet · Read-only</p><h1>App status</h1><p>Configuration and contract activity. Test GEN has no monetary value.</p></div><a className="contract-card" href={CONTRACT_EXPLORER_URL} target="_blank" rel="noreferrer"><span className={CONTRACT_READY ? "network-dot online" : "network-dot"} /><div><small>{NETWORK_NAME} · Explorer ↗</small><strong>{CONTRACT_READY ? shortenAddress(CONTRACT_ADDRESS) : "Not configured"}</strong></div></a></section>
      <section className="health-grid" aria-label="Runtime release configuration"><Health label="Contract" ready={health?.contractConfigured} /><Health label="StudioNet" ready={health?.studioNetConfigured} /><Health label="Release configuration" ready={health?.readyForStudioNetTesting} /></section>
      {error ? <div className="status-notice"><strong>Metrics unavailable</strong><p>{error}</p></div> : !stats ? <div className="loading-panel"><span />Loading contract activity…</div> : (
        <>
          <section className="status-metrics"><Metric label="Wagers created" value={stats.total_created} /><Metric label="Wagers settled" value={stats.total_settled} /><Metric label="Evidence sources" value={stats.max_sources} /><Metric label="Protocol fee" value={`${Number(stats.fee_bps) / 100}%`} /><Metric label="Appeal window" value={duration(stats.appeal_window_secs)} /><Metric label="Refund timeout" value={duration(stats.resolution_timeout_secs)} /></section>
          {accounting ? <section className="accounting-card"><div><p className="eyebrow">Contract accounting</p><h2>{accounting.liabilities_covered ? "Participant funds accounted for" : "Accounting needs attention"}</h2><p>Live contract balance compared with wager escrow and user-claimable balances.</p></div><div className="accounting-metrics"><Metric label="Contract balance" value={`${formatGen(accounting.contract_balance_atto)} GEN`} /><Metric label="Escrowed" value={`${formatGen(accounting.escrowed_atto)} GEN`} /><Metric label="Claimable" value={`${formatGen(accounting.claimable_atto)} GEN`} /><Metric label="Unallocated surplus" value={`${formatGen(accounting.unallocated_surplus_atto)} GEN`} /></div></section> : null}
          {accountingError ? <div className="status-notice"><strong>Accounting unavailable</strong><p>{accountingError}</p></div> : null}
          <section className="owner-boundary"><div><p className="eyebrow">Owner boundary</p><h2>No settlement controls.</h2></div><p>The deployer cannot rewrite questions, choose winners, block appeals, or move participant stakes. This page only reads public configuration and activity.</p></section>
        </>
      )}
    </main>
  );
}

function Health({ label, ready }: { label: string; ready: boolean | undefined }) {
  return <div className={ready ? "ready" : ""}><span>{label}<strong>{ready === undefined ? "Unknown" : ready ? "Configured" : "Incomplete"}</strong></span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
