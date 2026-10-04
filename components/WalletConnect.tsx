"use client";

import { useState } from "react";
import {
  connectInjectedWallet,
  mobileWalletHandoff,
  walletBrowseUrl,
  walletInstallUrl,
  type SolanaWalletName,
  type WalletWindow,
} from "@/lib/walletConnect";

type State = { kind: "idle" | "connecting" | "connected" | "message"; message?: string };

function walletLabel(name: SolanaWalletName): string {
  return name === "phantom" ? "Phantom" : "Solflare";
}

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;
}

export default function WalletConnect() {
  const [state, setState] = useState<Record<SolanaWalletName, State>>({
    phantom: { kind: "idle" },
    solflare: { kind: "idle" },
  });

  function update(name: SolanaWalletName, next: State) {
    setState((current) => ({ ...current, [name]: next }));
  }

  async function connect(name: SolanaWalletName) {
    const label = walletLabel(name);
    update(name, { kind: "connecting", message: `Connecting to ${label}…` });
    try {
      const result = await connectInjectedWallet(name, window as unknown as WalletWindow);
      if (result.status === "connected") {
        update(name, { kind: "connected", message: `${label} connected: ${shortAddress(result.address)}` });
        return;
      }

      if (mobileWalletHandoff(navigator.userAgent)) {
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.set("wallet", name);
        update(name, { kind: "message", message: `Opening ${label}. Return here and tap Connect again to approve.` });
        window.location.assign(walletBrowseUrl(name, returnUrl.toString()));
        return;
      }

      window.open(walletInstallUrl(name), "_blank", "noopener,noreferrer");
      update(name, { kind: "message", message: `${label} is not installed in this browser. Install its extension, refresh Subtext, then connect.` });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : `${label} did not approve the connection.`;
      update(name, { kind: "message", message });
    }
  }

  return <section className="rounded-sbt border border-sbt-gold/50 bg-white p-5 text-sm text-sbt-dusk">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-sbt-gold-700">Solana wallets</p>
    <h2 className="mt-2 font-display text-xl text-sbt-ink">Connect your wallet</h2>
    <p className="mt-2 leading-relaxed">
      Connect Phantom or Solflare in your browser or phone. Connecting shares only your public wallet address; it does not create a payment or request a signature.
    </p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {(["phantom", "solflare"] as const).map((name) => {
        const item = state[name];
        const label = walletLabel(name);
        return <div key={name} className="rounded-sbt border border-sbt-linen bg-sbt-paper/60 p-3">
          <button
            type="button"
            disabled={item.kind === "connecting" || item.kind === "connected"}
            onClick={() => connect(name)}
            className="min-h-11 w-full rounded-sbt bg-sbt-ink px-4 py-3 font-semibold text-sbt-paper disabled:opacity-60"
          >
            {item.kind === "connecting" ? `Connecting ${label}…` : item.kind === "connected" ? `${label} connected` : `Connect ${label}`}
          </button>
          {item.message ? <p role="status" className="mt-2 text-xs leading-relaxed text-sbt-mute">{item.message}</p> : null}
        </div>;
      })}
    </div>
    <p className="mt-3 text-xs leading-relaxed text-sbt-mute">
      On mobile, Subtext opens the selected wallet&apos;s secure in-app browser. Approve the connection inside the wallet and never enter a recovery phrase into Subtext.
    </p>
  </section>;
}
