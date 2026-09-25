import type { AdjudicationRecord, WagerView } from "./contract";

export function isUnmatched(wager: Pick<WagerView, "creator" | "taker">): boolean {
  return !wager.taker || wager.taker.toLowerCase() === wager.creator.toLowerCase();
}

export function sourceAgreement(record: AdjudicationRecord): string {
  if (!record.exists) return "Not judged";
  const sources = record.sources ?? [];
  return sources.length === 2 && ["A", "B"].includes(sources[0].finding)
    && sources[0].finding === sources[1].finding && sources.every((source) => source.citation)
    ? "2 / 2 agree" : "No decisive agreement";
}

/** Explain legacy contract wording without altering the stored audit record. */
export function verdictExplanation(reason: string): string {
  return reason.replace("Both independent sources", "Both configured sources")
    .replace("[LOW CONFIDENCE]", "[NO SOURCE AGREEMENT]");
}
