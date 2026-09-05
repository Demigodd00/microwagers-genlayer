"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletButton from "./WalletButton";
import { useWallet } from "./WalletProvider";

const routes = [
  { href: "/markets", label: "Markets" },
  { href: "/markets/new", label: "Post a wager" },
  { href: "/how-it-works", label: "How it works" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { error } = useWallet();
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
