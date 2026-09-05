"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { connectWallet, friendlyError, type WalletSession } from "@/lib/contract";
import { discoverWalletProviders, type WalletOption } from "@/lib/wallet";
import { watchWalletSession } from "@/lib/ui-state";

interface WalletContextValue {
  session: WalletSession | null;
  connecting: boolean;
  choices: WalletOption[];
  error: string;
  beginConnect(): Promise<void>;
  chooseWallet(choice: WalletOption): Promise<void>;
  closeWalletPicker(): void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [choices, setChoices] = useState<WalletOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    return watchWalletSession(session.provider, session.address, () => {
      setSession(null);
      setChoices([]);
      setError("Wallet changed or disconnected. Reconnect to continue.");
    });
  }, [session]);

  async function activate(choice: WalletOption) {
    setConnecting(true);
    setChoices([]);
    setError("");
    try {
      setSession(await connectWallet(choice));
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setConnecting(false);
    }
  }

  async function beginConnect() {
    setConnecting(true);
    setChoices([]);
    setError("");
    try {
      const discovered = await discoverWalletProviders(window);
      if (discovered.length === 0) throw new Error("No compatible browser wallet was found. Install or enable MetaMask, then try again.");
      if (discovered.length === 1) {
        setSession(await connectWallet(discovered[0]));
      } else {
        setChoices(discovered);
      }
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <WalletContext.Provider value={{
      session,
      connecting,
      choices,
      error,
      beginConnect,
      chooseWallet: activate,
      closeWalletPicker: () => setChoices([]),
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used within WalletProvider.");
  return value;
}
