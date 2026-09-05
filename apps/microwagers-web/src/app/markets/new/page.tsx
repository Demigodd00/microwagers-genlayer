"use client";

import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import CreateMarket from "@/components/CreateMarket";
import { useWallet } from "@/components/WalletProvider";

export default function NewMarketPage() {
  const router = useRouter();
  const { session } = useWallet();
  return <AppShell><section className="workspace"><CreateMarket session={session} onCreated={() => router.push("/markets")} /></section></AppShell>;
}
