import type { TxProgress } from "@/lib/contract";

export default function TxNotice({ progress }: { progress: TxProgress | null }) {
  if (!progress) return null;
  return (
    <div className={`tx-notice tx-${progress.state}`} role="status">
      <span />
      <div><strong>{progress.label}</strong>{progress.hash ? <details><summary>Transaction hash</summary><code>{progress.hash}</code></details> : null}</div>
    </div>
  );
}
