"use client";

import { shortenAddress } from "@/lib/contract";
import { useWallet } from "./WalletProvider";

export default function WalletButton() {
  const { session, connecting, choices, beginConnect, chooseWallet, closeWalletPicker } = useWallet();

  return (
    <div className="wallet-control">
      <button className="wallet-button" type="button" onClick={() => void beginConnect()} disabled={connecting}>
        <span className={session ? "wallet-dot connected" : "wallet-dot"} />
        {connecting ? "Finding wallets…" : session ? `${session.walletName} · ${shortenAddress(session.address)}` : "Connect wallet"}
      </button>

      {choices.length > 1 ? (
        <div className="wallet-picker" role="dialog" aria-label="Choose a wallet">
          <div className="wallet-picker-heading">
            <div><strong>Choose wallet</strong><small>Select the extension you want to use.</small></div>
            <button type="button" onClick={closeWalletPicker} aria-label="Close wallet picker">×</button>
          </div>
          <div className="wallet-picker-list">
            {choices.map((choice) => (
              <button type="button" key={choice.id} onClick={() => void chooseWallet(choice)}>
                <span>{choice.name.slice(0, 1).toUpperCase()}</span>
                <span><strong>{choice.name}</strong><small>{choice.rdns ?? "Injected browser wallet"}</small></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
