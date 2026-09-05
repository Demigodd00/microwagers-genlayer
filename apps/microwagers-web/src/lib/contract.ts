import { chains, createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import { assertSuccessfulExecution } from "./receipt";
import { oneTransactionAtATime } from "./ui-state";
import { connectStudioWallet, type EthereumProvider, type WalletOption } from "./wallet";

export type { EthereumProvider } from "./wallet";
export type Address = `0x${string}`;

export interface WalletSession {
  address: Address;
  client: ReturnType<typeof createClient>;
  provider: EthereumProvider;
  walletName: string;
}

export interface WagerSummary {
  id: string;
  status: string;
  question: string;
  creator_side: string;
  taker_side: string;
  stake_atto: string;
  outcome_label: string;
  appealed: boolean;
}

export interface AdjudicationRecord {
  exists: boolean;
  outcome: string;
  outcome_label: string;
  winner: string;
  confidence_bucket: string;
  reason: string;
  source_url: string;
  source_digest: string;
  source_snapshot: string;
  source_bytes: string;
  source_chars: string;
  judged_at_unix: string;
  judged_at_iso: string;
  provenance: string;
}

export interface WagerView extends WagerSummary {
  source_url: string;
  creator: string;
  taker: string;
  deadline_unix: string;
  created_at_iso: string;
  winner: string;
  confidence_bucket: string;
  verdict_reason: string;
  resolved_at_unix: string;
  resolved_at_iso: string;
  appeal_deadline_unix: string;
  resolution_recovery_unix: string;
  recoverable: boolean;
  claimable: boolean;
  appeal_statement: string;
  pot_bonus_atto: string;
  pot_atto: string;
  original_record: AdjudicationRecord;
  appeal_record: AdjudicationRecord;
}

export interface MarketStats {
  total_created: string;
  total_settled: string;
  fee_bps: string;
  treasury: string;
  appeal_window_secs: string;
  resolution_timeout_secs: string;
  experimental: boolean;
  max_page_size: string;
  max_source_bytes: string;
  max_source_chars: string;
  source_policy: string;
  version: string;
}

export interface TxProgress {
  state: "awaiting-signature" | "submitted" | "finalizing" | "confirmed" | "failed";
  label: string;
  hash?: string;
}

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MICROWAGERS_ADDRESS ?? "";
export const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME ?? "StudioNet";
export const CONTRACT_READY = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS) && !/^0x0{40}$/i.test(CONTRACT_ADDRESS);
export const CONTRACT_EXPLORER_URL = CONTRACT_READY
  ? `https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`
  : "https://explorer-studio.genlayer.com";

const readClient = createClient({ chain: chains.studionet });
const readRetryDelays = [300, 900] as const;

function contractAddress(): Address {
  if (!CONTRACT_READY) throw new Error("MicroWagers has not been configured for this environment.");
  return CONTRACT_ADDRESS as Address;
}

export function formatGen(attoValue: string | bigint, precision = 4): string {
  const atto = typeof attoValue === "bigint" ? attoValue : BigInt(attoValue || "0");
  const whole = atto / 10n ** 18n;
  const fraction = (atto % 10n ** 18n).toString().padStart(18, "0").slice(0, precision).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function parseGen(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,18})?$/.test(trimmed)) throw new Error("Enter a valid GEN amount with at most 18 decimal places.");
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
}

export function isPublicHttpsSource(value: string): boolean {
  const source = value.trim();
  if (source.length < 12 || source.length > 360 || /\s|\0/.test(source)) return false;
  if (!/^https:\/\/[^/]+(?:\/.*)?$/.test(source)) return false;
  const authority = source.slice(8).split("/", 1)[0];
  if (!authority || /@|\[|\]/.test(authority)) return false;
  const [rawHost, port] = authority.split(":", 2);
  if (port !== undefined && (!/^\d{1,5}$/.test(port) || Number(port) > 65535)) return false;
  const host = rawHost.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || host === "localhost" || host.endsWith(".local")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  return /^[a-z0-9.-]+$/.test(host) && !host.includes("..");
}

export function shortenAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const expected = message.match(/\[EXPECTED\]\s*([^"\n]+)/);
  if (expected?.[1]) return expected[1].trim();
  if (/rejected|denied|cancelled/i.test(message)) return "The wallet request was cancelled.";
  if (/wrong chain|configured for chain/i.test(message)) return `Switch your wallet to ${NETWORK_NAME} and try again.`;
  if (/failed to fetch|fetch failed|network error|econn|socket hang up|service unavailable|\b(?:502|503|504)\b/i.test(message)) {
    return "StudioNet is temporarily unreachable. If you just submitted a transaction, check your wallet activity before retrying, then refresh.";
  }
  if (/timeout|timed out/i.test(message)) return "Confirmation is taking longer than expected. Check the transaction before retrying.";
  return message.length > 220 ? `${message.slice(0, 217)}…` : message;
}

export function isTransientReadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|fetch failed|network error|timeout|timed out|econn|socket hang up|service unavailable|\b(?:502|503|504)\b/i.test(message);
}

export async function withReadRetry<T>(operation: () => Promise<T>, wait: (delayMs: number) => Promise<void> = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      if (!isTransientReadError(error) || attempt >= readRetryDelays.length) throw error;
      await wait(readRetryDelays[attempt]);
    }
  }
}

export async function connectWallet(wallet: WalletOption): Promise<WalletSession> {
  const address = await connectStudioWallet(wallet.provider);
  return {
    address,
    client: createClient({ chain: chains.studionet, account: address, provider: wallet.provider as never }),
    provider: wallet.provider,
    walletName: wallet.name,
  };
}

async function waitForSuccess(hash: unknown, onProgress: (progress: TxProgress) => void): Promise<void> {
  const txHash = String(hash);
  onProgress({ state: "finalizing", label: "GenLayer validators are finalizing the transaction", hash: txHash });
  const receipt = await readClient.waitForTransactionReceipt({ hash: hash as never, status: TransactionStatus.FINALIZED, retries: 120 });
  assertSuccessfulExecution(receipt);
  onProgress({ state: "confirmed", label: "Confirmed by GenLayer validators", hash: txHash });
}

async function write(session: WalletSession, functionName: string, args: unknown[], value: bigint, onProgress: (progress: TxProgress) => void): Promise<string> {
  return oneTransactionAtATime(session.address, async () => {
    let txHash: string | undefined;
    onProgress({ state: "awaiting-signature", label: "Confirm this transaction in your wallet" });
    try {
      const hash = await session.client.writeContract({ address: contractAddress(), functionName, args: args as never[], value });
      txHash = String(hash);
      onProgress({ state: "submitted", label: "Transaction submitted", hash: txHash });
      await waitForSuccess(hash, onProgress);
      return txHash;
    } catch (error) {
      onProgress({ state: "failed", label: friendlyError(error), hash: txHash });
      throw error;
    }
  });
}

export async function listWagers(): Promise<WagerSummary[]> {
  const first = await withReadRetry(() => readClient.readContract({ address: contractAddress(), functionName: "list_wagers", args: [0, 25] })) as unknown as { total: string; items: WagerSummary[] };
  const total = Number(first.total);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("The contract returned an invalid market count.");
  const page = total > 25
    ? await withReadRetry(() => readClient.readContract({ address: contractAddress(), functionName: "list_wagers", args: [total - 25, 25] })) as unknown as { items: WagerSummary[] }
    : first;
  return [...page.items].reverse();
}

export async function getWager(wagerId: string): Promise<WagerView> {
  return await withReadRetry(() => readClient.readContract({ address: contractAddress(), functionName: "get_wager", args: [wagerId] })) as unknown as WagerView;
}

export async function getStats(): Promise<MarketStats> {
  return await withReadRetry(() => readClient.readContract({ address: contractAddress(), functionName: "get_stats", args: [] })) as unknown as MarketStats;
}

export const createWager = (session: WalletSession, input: { question: string; creatorSide: string; takerSide: string; sourceUrl: string; deadlineUnix: number; stakeAtto: bigint }, onProgress: (progress: TxProgress) => void) =>
  write(session, "create_wager", [input.question, input.creatorSide, input.takerSide, input.sourceUrl, input.deadlineUnix], input.stakeAtto, onProgress);
export const acceptWager = (session: WalletSession, wagerId: string, stakeAtto: bigint, onProgress: (progress: TxProgress) => void) => write(session, "accept_wager", [wagerId], stakeAtto, onProgress);
export const cancelWager = (session: WalletSession, wagerId: string, onProgress: (progress: TxProgress) => void) => write(session, "cancel_wager", [wagerId], 0n, onProgress);
export const resolveWager = (session: WalletSession, wagerId: string, onProgress: (progress: TxProgress) => void) => write(session, "resolve_wager", [wagerId], 0n, onProgress);
export const voidUnresolvedWager = (session: WalletSession, wagerId: string, onProgress: (progress: TxProgress) => void) => write(session, "void_unresolved", [wagerId], 0n, onProgress);
export const appealWager = (session: WalletSession, wagerId: string, statement: string, bondAtto: bigint, onProgress: (progress: TxProgress) => void) => write(session, "appeal_wager", [wagerId, statement], bondAtto, onProgress);
export const claimWager = (session: WalletSession, wagerId: string, onProgress: (progress: TxProgress) => void) => write(session, "claim", [wagerId], 0n, onProgress);
