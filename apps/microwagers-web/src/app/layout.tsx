import type { Metadata, Viewport } from "next";
import { WalletProvider } from "@/components/WalletProvider";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const appUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "MicroWagers by demigodd00", template: "%s · MicroWagers" },
  description: "Source-bound peer predictions resolved by GenLayer validators on StudioNet.",
  applicationName: "MicroWagers",
  authors: [{ name: "demigodd00" }],
  creator: "demigodd00",
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "MicroWagers",
    title: "MicroWagers by demigodd00",
    description: "Make a test prediction, name the source, and let GenLayer validators settle it.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MicroWagers by demigodd00",
    description: "Source-bound peer predictions on GenLayer StudioNet.",
  },
  category: "technology",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0912" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><WalletProvider>{children}</WalletProvider></body></html>;
}
