"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CONTRACT_READY, claimFunds, formatGen, friendlyError, getClaimableBalance, type TxProgress } from "@/lib/contract";
import WalletButton from "./WalletButton";
import { useWallet } from "./WalletProvider";
import TxNotice from "./TxNotice";

const routes = [
  { href: "/markets", label: "Markets" },
  { href: "/markets/new", label: "Post a wager" },
  { href: "/how-it-works", label: "How it works" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { error, session } = useWallet();
  const active = (href: string) => href === "/markets" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <main>
        <div className="site-shell">
          <nav className="topbar" aria-label="Primary navigation">
            <Link className="brand brand-button" href="/"><span className="brand-mark">M</span><span>MicroWagers<small>by demigodd00</small></span></Link>
            <div className="topbar-links">
              <Link className={pathname === "/status" ? "active" : ""} href="/status">App status</Link>
            </div>
            <WalletButton />
          </nav>
          <div className="network-banner" role="note"><strong>StudioNet lab</strong><span>Test GEN has no monetary value</span><span>· public sources · 5m appeals</span></div>
          <nav className="workspace-tabs route-navigation" aria-label="MicroWagers workspace">
            {routes.map((route) => <Link className={active(route.href) ? "active" : ""} href={route.href} key={route.href}>{route.label}</Link>)}
          </nav>
          <ClaimableFunds />
          {error ? <p className="form-error wallet-error wallet-error-shell" role="alert">{error}</p> : null}
          {children}
        </div>
      </main>
      <footer>
        <div className="site-shell footer-inner">
          <Link className="brand" href="/"><span className="brand-mark">M</span><span>MicroWagers<small>by demigodd00 · StudioNet</small></span></Link>
          <p>© 2026 demigodd00. All rights reserved.</p>
          <Link href="/status">App status →</Link>
        </div>
      </footer>
    </>
  );
}

function ClaimableFunds() {
  const { session } = useWallet();
  const [amount, setAmount] = useState(0n);
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!session || !CONTRACT_READY) { setAmount(0n); return; }
    try { setAmount(await getClaimableBalance(session.address)); }
    catch { /* Keep the last visible amount during temporary RPC outages. */ }
  }, [session]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    const onRefresh = () => void refresh();
    window.addEventListener("microwagers:refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("microwagers:refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [refresh]);

  async function claim() {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await claimFunds(session, setProgress);
      await refresh();
    } catch (reason) { setError(friendlyError(reason)); }
    finally { setBusy(false); }
  }

  if (!session || amount <= 0n) return null;
  return (
    <section className="claimable-banner" aria-label="Claimable GEN">
      <div><strong>{formatGen(amount)} test GEN ready to claim</strong><span>Includes any refunds or settled payouts for this wallet.</span></div>
      <button className="button button-secondary" onClick={() => void claim()} disabled={busy}>{busy ? "Claiming…" : "Claim GEN"}</button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <TxNotice progress={progress} />
    </section>
  );
}
