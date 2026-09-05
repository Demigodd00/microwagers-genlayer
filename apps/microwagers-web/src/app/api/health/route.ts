import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const address = process.env.NEXT_PUBLIC_MICROWAGERS_ADDRESS ?? "";
  const network = process.env.NEXT_PUBLIC_NETWORK_NAME ?? "";
  const contractConfigured = /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/i.test(address);
  const studioNetConfigured = network.toLowerCase() === "studionet";
  return NextResponse.json({
    product: "MicroWagers",
    release: "1.2.1",
    network: network || "Not configured",
    contractConfigured,
    studioNetConfigured,
    readyForStudioNetTesting: contractConfigured && studioNetConfigured,
  }, { status: contractConfigured && studioNetConfigured ? 200 : 503 });
}
