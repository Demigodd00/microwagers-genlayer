import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import LegacyRouteRedirect from "@/components/LegacyRouteRedirect";
import MicroWagersApp from "@/components/MicroWagersApp";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <AppShell><LegacyRouteRedirect /><MicroWagersApp /></AppShell>;
}
