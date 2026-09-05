import assert from "node:assert/strict";
import test from "node:test";
import { formatGen, friendlyError, isPublicHttpsSource, parseGen, withReadRetry } from "../src/lib/contract";

test("GEN parsing and formatting preserve 18-decimal integer values", () => {
  assert.equal(parseGen("0.001"), 10n ** 15n);
  assert.equal(parseGen("10"), 10n * 10n ** 18n);
  assert.equal(formatGen("2000000000000000"), "0.002");
  assert.throws(() => parseGen("1.0000000000000000001"), /18 decimal places/);
});

test("transient reads retry twice and recover", async () => {
  let attempts = 0;
  const waits: number[] = [];
  const result = await withReadRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("An unknown RPC error occurred. Details: Failed to fetch");
    return "ok";
  }, async (delayMs) => { waits.push(delayMs); });
  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [300, 900]);
});

test("contract errors are not retried and expected reasons are cleaned", async () => {
  let attempts = 0;
  await assert.rejects(withReadRetry(async () => { attempts += 1; throw new Error("[EXPECTED] wager not found"); }, async () => {}), /wager not found/);
  assert.equal(attempts, 1);
  assert.equal(friendlyError(new Error("[EXPECTED] wager is not live")), "wager is not live");
});

test("raw network and wallet errors become useful messages", () => {
  assert.match(friendlyError(new Error("Failed to fetch Version: viem@2.55.19")), /StudioNet is temporarily unreachable/);
  assert.equal(friendlyError(new Error("User rejected request")), "The wallet request was cancelled.");
});

test("resolution sources match the contract's public HTTPS boundary", () => {
  assert.equal(isPublicHttpsSource("https://example.com/results"), true);
  assert.equal(isPublicHttpsSource("http://example.com/results"), false);
  assert.equal(isPublicHttpsSource("HTTPS://example.com/results"), false);
  assert.equal(isPublicHttpsSource("https://localhost/results"), false);
  assert.equal(isPublicHttpsSource("https://127.0.0.1/results"), false);
  assert.equal(isPublicHttpsSource("https://user@example.com/results"), false);
  assert.equal(isPublicHttpsSource("https://example..com/results"), false);
  assert.equal(isPublicHttpsSource("https://example.com:invalid/results"), false);
  assert.equal(isPublicHttpsSource("https://example.com/bad path"), false);
});
