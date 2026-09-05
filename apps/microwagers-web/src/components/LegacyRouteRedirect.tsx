"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { legacyMarketRoute } from "@/lib/ui-state";

export default function LegacyRouteRedirect() {
  const router = useRouter();

  useEffect(() => {
    const destination = legacyMarketRoute(window.location.search);
    if (destination) router.replace(destination);
  }, [router]);

  return null;
}
