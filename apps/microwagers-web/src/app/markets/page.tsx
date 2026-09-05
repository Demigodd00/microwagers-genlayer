"use client";

import AppShell from "@/components/AppShell";
import MarketBoard from "@/components/MarketBoard";
import { useWallet } from "@/components/WalletProvider";

export default function MarketsPage() {
  const { session } = useWallet();
  return <AppShell><section className="workspace"><MarketBoard key={session?.address ?? "disconnected"} session={session} /></section></AppShell>;
}
