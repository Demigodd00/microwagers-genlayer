import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MicroWagersApp from "../src/components/MicroWagersApp";
import CreateMarket from "../src/components/CreateMarket";
import { MarketDetail, stakePresentation } from "../src/components/MarketBoard";
import type { AdjudicationRecord, WagerView, WalletSession } from "../src/lib/contract";

const creator = `0x${"1".repeat(40)}` as const;
const taker = `0x${"2".repeat(40)}` as const;
const emptyRecord: AdjudicationRecord = {
  exists: false, outcome: "", outcome_label: "", winner: "", confidence_bucket: "0", reason: "",
  source_url: "https://example.com/", source_digest: "", source_snapshot: "", source_bytes: "0", source_chars: "0",
  judged_at_unix: "0", judged_at_iso: "", provenance: "",
};
const wager: WagerView = {
  id: "w-3", status: "OPEN", question: "Does the public source support side A?", creator_side: "Side A", taker_side: "Side B",
  stake_atto: "1000000000000000", outcome_label: "", appealed: false, source_url: "https://example.com/", creator, taker: creator,
  deadline_unix: String(Math.floor(Date.now() / 1000) + 600), created_at_iso: new Date().toISOString(), winner: creator,
  confidence_bucket: "0", verdict_reason: "", resolved_at_unix: "0", resolved_at_iso: "", appeal_deadline_unix: "0",
  resolution_recovery_unix: String(Math.floor(Date.now() / 1000) + 1200), recoverable: false,
  claimable: false, appeal_statement: "", pot_bonus_atto: "0", pot_atto: "2000000000000000",
  original_record: emptyRecord, appeal_record: emptyRecord,
};

function renderDetail(value: WagerView, address: `0x${string}` | null) {
  const session = address ? { address, client: {} } as WalletSession : null;
  return renderToStaticMarkup(createElement(MarketDetail, { wager: value, session, onRefresh: async () => {} }));
}

test("the home page identifies the creator, network, value boundary, and example", () => {
  const html = renderToStaticMarkup(createElement(MicroWagersApp));
  assert.match(html, /by demigodd00/);
  assert.match(html, /Test GEN has no monetary value/);
  assert.match(html, /EXAMPLE WAGER/);
  assert.match(html, /GenLayer validators/);
  assert.doesNotMatch(html, /guaranteed|risk-free|real money/i);
});

test("the creation flow keeps source and stake disclosures visible", () => {
  const html = renderToStaticMarkup(createElement(CreateMarket, { session: null, onCreated: () => {} }));
  assert.match(html, /Public HTTPS resolution source/);
  assert.match(html, /Test stake in GEN/);
  assert.match(html, /when resolution is requested after the deadline/);
  assert.match(html, /Example Domain/);
  assert.doesNotMatch(html, /At the deadline, does the source page state/);
});

test("a stuck live wager exposes the permissionless timeout refund", () => {
  const live = {
    ...wager,
    status: "LIVE",
    taker,
    deadline_unix: String(Math.floor(Date.now() / 1000) - 900),
    resolution_recovery_unix: String(Math.floor(Date.now() / 1000) - 1),
    recoverable: true,
  };
  const html = renderDetail(live, creator);
  assert.match(html, /Refund both test stakes/);
  assert.match(html, /Resolve or recover the stakes/);
});

test("original and appeal source fingerprints remain visible", () => {
  const record = {
    ...emptyRecord,
    exists: true,
    outcome: "CREATOR",
    outcome_label: "Side A",
    winner: creator,
    confidence_bucket: "90",
    reason: "The fetched source supports side A.",
    source_digest: "a".repeat(64),
    source_snapshot: "Example source snapshot.",
    source_bytes: "1256",
    source_chars: "1256",
    judged_at_unix: "2000000000",
    judged_at_iso: "2033-05-18T03:33:20+00:00",
    provenance: "GENLAYER_VALIDATOR_FETCH_AT_ADJUDICATION",
  };
  const appealed = { ...record, source_digest: "b".repeat(64), provenance: "GENLAYER_VALIDATOR_REFETCH_AT_APPEAL" };
  const html = renderDetail({ ...wager, status: "PROVISIONAL", taker, winner: creator, original_record: record, appeal_record: appealed }, creator);
  assert.match(html, /Immutable adjudication records/);
  assert.match(html, /SHA-256 a{12}…a{8}/);
  assert.match(html, /SHA-256 b{12}…b{8}/);
  assert.match(html, /Stored source snapshot/);
});

test("an unmatched cancellation shows the refunded stake rather than a theoretical pot", () => {
  const voided = { ...wager, status: "VOIDED" };
  assert.deepEqual(stakePresentation(voided), { amountAtto: "1000000000000000", label: "refunded" });
  const html = renderDetail(voided, creator);
  assert.match(html, /0\.001/);
  assert.match(html, /refunded/);
  assert.match(html, /No taker/);
  assert.doesNotMatch(html, /Taker ·/);
  assert.doesNotMatch(html, /0\.002/);
});

test("only the correct participant actions render", () => {
  assert.match(renderDetail(wager, creator), /Cancel and refund/);
  assert.doesNotMatch(renderDetail(wager, creator), /Match 0\.001/);
  assert.match(renderDetail(wager, taker), /Match 0\.001 test GEN/);
  const expiredOpen = { ...wager, deadline_unix: String(Math.floor(Date.now() / 1000) - 1) };
  assert.match(renderDetail(expiredOpen, taker), /Closed to matching/);
  assert.doesNotMatch(renderDetail(expiredOpen, taker), /Match 0\.001/);
  const provisional = { ...wager, status: "PROVISIONAL", taker, winner: creator, appeal_deadline_unix: String(Math.floor(Date.now() / 1000) + 300), verdict_reason: "The source supports side A.", outcome_label: "Side A", confidence_bucket: "90" };
  assert.match(renderDetail(provisional, taker), /Appeal statement/);
  assert.doesNotMatch(renderDetail(provisional, creator), /Appeal statement/);
});
