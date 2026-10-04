export type SolanaWalletName = "phantom" | "solflare";

type PublicKeyLike = { toString(): string };
type ConnectResult = { publicKey?: PublicKeyLike } | void;

interface InjectedProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: PublicKeyLike | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<ConnectResult>;
}

export interface WalletWindow {
  phantom?: { solana?: InjectedProvider };
  solflare?: InjectedProvider;
  solana?: InjectedProvider;
}

export type WalletConnectionResult =
  | { status: "connected"; address: string }
  | { status: "unavailable" };

function providerFor(name: SolanaWalletName, scope: WalletWindow): InjectedProvider | null {
  if (name === "phantom") {
    return scope.phantom?.solana ?? (scope.solana?.isPhantom ? scope.solana : null);
  }
  return scope.solflare ?? (scope.solana?.isSolflare ? scope.solana : null);
}

export async function connectInjectedWallet(
  name: SolanaWalletName,
  scope: WalletWindow,
): Promise<WalletConnectionResult> {
  const provider = providerFor(name, scope);
  if (!provider) return { status: "unavailable" };
  const result = await provider.connect();
  const publicKey = result && "publicKey" in result ? result.publicKey : provider.publicKey;
  const address = publicKey?.toString().trim() ?? "";
  if (!address) throw new Error(`${name === "phantom" ? "Phantom" : "Solflare"} connected without sharing an address.`);
  return { status: "connected", address };
}

export function walletBrowseUrl(name: SolanaWalletName, rawAppUrl: string): string {
  const appUrl = new URL(rawAppUrl);
  const ref = appUrl.origin;
  const encodedApp = encodeURIComponent(appUrl.toString());
  const encodedRef = encodeURIComponent(ref);
  return name === "phantom"
    ? `https://phantom.com/ul/browse/${encodedApp}?ref=${encodedRef}`
    : `https://solflare.com/ul/v1/browse/${encodedApp}?ref=${encodedRef}`;
}

export function walletInstallUrl(name: SolanaWalletName): string {
  return name === "phantom" ? "https://phantom.com/download" : "https://www.solflare.com/download";
}

export function mobileWalletHandoff(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|SubtextAndroid/i.test(userAgent);
}
