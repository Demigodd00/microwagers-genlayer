import assert from "node:assert/strict";
import test from "node:test";
import { getSiteUrl } from "../src/lib/site-url";

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("site URL prefers an explicit canonical host", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalVercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test/";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "ignored.vercel.app";
  assert.equal(getSiteUrl(), "https://example.test");
  restore("NEXT_PUBLIC_SITE_URL", originalSiteUrl);
  restore("VERCEL_PROJECT_PRODUCTION_URL", originalVercelUrl);
});

test("Vercel's production URL is normalized when no explicit host is set", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalVercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "microwagers.vercel.app";
  assert.equal(getSiteUrl(), "https://microwagers.vercel.app");
  restore("NEXT_PUBLIC_SITE_URL", originalSiteUrl);
  restore("VERCEL_PROJECT_PRODUCTION_URL", originalVercelUrl);
});
