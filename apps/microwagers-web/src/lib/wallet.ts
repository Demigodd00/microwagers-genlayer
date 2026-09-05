import { chains } from "genlayer-js";

export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  providers?: EthereumProvider[];
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isMetaMask?: boolean;
  isRabby?: boolean;
}

export interface WalletOption {
  id: string;
  name: string;
  provider: EthereumProvider;
  rdns?: string;
}

interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; rdns?: string };
  provider: EthereumProvider;
}

export interface WalletDiscoveryHost {
  ethereum?: EthereumProvider;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  dispatchEvent(event: Event): boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function walletAddress(accounts: unknown): `0x${string}` {
  const address = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address)) {
    throw new Error("The wallet returned an invalid account.");
  }
  return address as `0x${string}`;
}

function isStudioChain(value: unknown): boolean {
  return typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)
    && BigInt(value) === BigInt(chains.studionet.id);
}

function unknownChain(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; data?: { originalError?: { code?: unknown } } };
  return value.code === 4902 || value.data?.originalError?.code === 4902;
}

function providerName(provider: EthereumProvider): string {
  if (provider.isRabby) return "Rabby Wallet";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isBraveWallet) return "Brave Wallet";
  if (provider.isMetaMask) return "MetaMask";
  return "Browser wallet";
}

function validDetail(value: unknown): value is Eip6963ProviderDetail {
  if (!value || typeof value !== "object") return false;
  const detail = value as Partial<Eip6963ProviderDetail>;
  return typeof detail.provider?.request === "function"
    && typeof detail.info?.uuid === "string"
    && detail.info.uuid.length > 0
    && typeof detail.info.name === "string"
    && detail.info.name.length > 0;
}

export async function discoverWalletProviders(
  host: WalletDiscoveryHost,
  wait: (delayMs: number) => Promise<void> = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
): Promise<WalletOption[]> {
  const choices: WalletOption[] = [];
  const seen = new Set<EthereumProvider>();

  const add = (provider: EthereumProvider | undefined, id: string, name: string, rdns?: string) => {
    if (!provider || typeof provider.request !== "function" || seen.has(provider)) return;
    seen.add(provider);
    choices.push({ id, name, provider, ...(rdns ? { rdns } : {}) });
  };

  const onAnnouncement: EventListener = (event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (validDetail(detail)) add(detail.provider, `eip6963:${detail.info.uuid}`, detail.info.name, detail.info.rdns);
  };

  host.addEventListener("eip6963:announceProvider", onAnnouncement);
  try {
    host.dispatchEvent(new Event("eip6963:requestProvider"));
    await wait(120);
  } finally {
    host.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }

  const injected = host.ethereum?.providers?.length ? host.ethereum.providers : [host.ethereum];
  injected.forEach((provider, index) => add(provider, `legacy:${index}`, provider ? providerName(provider) : "Browser wallet"));

  return choices.sort((left, right) => {
    const leftMetaMask = left.name.toLowerCase().includes("metamask") ? 0 : 1;
    const rightMetaMask = right.name.toLowerCase().includes("metamask") ? 0 : 1;
    return leftMetaMask - rightMetaMask || left.name.localeCompare(right.name);
  });
}

export async function connectStudioWallet(provider: EthereumProvider | undefined): Promise<`0x${string}`> {
  if (!provider) throw new Error("No compatible browser wallet was found.");
  walletAddress(await provider.request({ method: "eth_requestAccounts" }));
  const chain = chains.studionet;
  const chainId = `0x${chain.id.toString(16)}`;
  if (!isStudioChain(await provider.request({ method: "eth_chainId" }))) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    } catch (error) {
      if (!unknownChain(error)) throw error;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId,
          chainName: chain.name,
          rpcUrls: [...chain.rpcUrls.default.http],
          nativeCurrency: chain.nativeCurrency,
          ...(chain.blockExplorers?.default.url ? { blockExplorerUrls: [chain.blockExplorers.default.url] } : {}),
        }],
      });
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    }
  }
  if (!isStudioChain(await provider.request({ method: "eth_chainId" }))) {
    throw new Error("Switch your wallet to StudioNet and reconnect.");
  }
  return walletAddress(await provider.request({ method: "eth_accounts" }));
}
