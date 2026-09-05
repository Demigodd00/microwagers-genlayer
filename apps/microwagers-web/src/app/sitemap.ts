import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/markets`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/markets/new`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/status`, changeFrequency: "weekly", priority: 0.6 },
  ];
}
