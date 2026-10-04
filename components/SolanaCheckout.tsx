"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { checkoutAction, checkoutState, type SolanaCheckoutState, type SolanaOrder } from "@/lib/solanaCheckoutClient";
import { getFreeAnswerAceRecoveryCode, restoreFreeAnswerAceIdentity } from "@/lib/freeAnswerAceClient";

type Payment = { ok: true; status: "pending" | "expired" | "paid"; signature?: string | null };

export default function SolanaCheckout() {
  const [offer, setOffer] = useState<SolanaCheckoutState>({ enabled: false });
  const [order, setOrder] = useState<SolanaOrder | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "checking" | "paid" | "expired">("idle");
  const [message, setMessage] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    checkoutState().then(async (next) => {
      setOffer(next);
      if (next.recoveryEnabled) {
        try {
          const access = await checkoutAction<{ ok: boolean; active: boolean }>("entitlement");
          if (access.active) setStatus("paid");
        } catch { /* Checkout status remains available on request. */ }
      }
    }).catch(() => setOffer({ enabled: false }));
  }, []);
  if (!offer.enabled && !offer.recoveryEnabled) return null;

  async function start() {
    setMessage("");
    try {
      const next = await checkoutAction<SolanaOrder>("create");
      const image = await QRCode.toDataURL(next.url, { width: 256, margin: 2, errorCorrectionLevel: "M" });
      setOrder(next);
      setQr(image);
      setStatus("pending");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checkout is unavailable."); }
  }

  async function check() {
    if (!order) return;
    setStatus("checking");
    setMessage("");
    try {
      const result = await checkoutAction<Payment>("settle", order.orderId);
      setStatus(result.status);
      setMessage(result.status === "paid" ? "Payment verified on Solana. Your 30-day AnswerAce web pass is active."
        : "Payment has not been finalized yet. Check again after your wallet confirms it.");
    } catch (error) {
      setStatus("pending");
      setMessage(error instanceof Error ? error.message : "Verification is temporarily unavailable.");
    }
  }

  async function copyRecovery() {
    const code = await getFreeAnswerAceRecoveryCode();
    if (!code) { setMessage("Recovery code is unavailable. Keep this browser's data and contact support."); return; }
    setRecoveryCode(code);
    try { await navigator.clipboard.writeText(code); setMessage("Recovery code copied. Save it privately; anyone with this code can use your pass."); }
    catch { setMessage("Copy the recovery code shown below and save it privately."); }
  }

  async function restore() {
    try {
      if (!await restoreFreeAnswerAceIdentity(recoveryInput.trim())) throw new Error("The recovery code was not accepted.");
      const result = await checkoutAction<{ ok: boolean; active: boolean }>("entitlement");
      setMessage(result.active ? "Your paid AnswerAce web pass is restored on this browser." : "This code has no active paid pass.");
      if (result.active) setRecoveryInput("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not restore the pass."); }
  }

  return <section className="rounded-sbt border border-sbt-gold/50 bg-white p-5 text-sm text-sbt-dusk">
    <h2 className="font-display text-xl text-sbt-ink">Solana web pass</h2>
    {offer.enabled ? <><p className="mt-2">Get a <strong>30-day prepaid AnswerAce web pass</strong> for {offer.amount} {offer.asset}. Use Phantom, Solflare, or another Solana Pay wallet. This payment does not renew automatically.</p>
    <p className="mt-2 text-xs">Save your recovery code after payment. It restores access if you change browsers or phones. Android purchases from Google Play remain in Google Play.</p>
    {!order || status === "expired" ? <button type="button" onClick={start} className="mt-4 min-h-11 w-full rounded-sbt bg-sbt-ink px-4 py-3 font-semibold text-sbt-paper">Create Solana payment</button> : null}</> : null}
    {order && status !== "expired" ? <div className="mt-4 space-y-3">
      <p><strong>Exact payment:</strong> {order.amount} {order.asset} on Solana mainnet. Confirm the recipient and amount in your wallet before sending.</p>
      {qr ? <Image unoptimized src={qr} width={256} height={256} alt="Solana Pay code for this Subtext order" className="rounded bg-white p-2" /> : null}
      <a href={order.url} className="inline-block rounded-sbt border border-sbt-gold/50 px-4 py-3 font-medium text-sbt-gold-700">Open in a Solana wallet</a>
      <p className="break-all text-xs">Receiving wallet: {order.recipient}</p>
      <p className="text-xs">This payment request expires at {new Date(order.expiresAt).toLocaleString()}.</p>
      {status !== "paid" ? <button type="button" disabled={status === "checking"} onClick={check} className="min-h-11 w-full rounded-sbt bg-sbt-gold-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{status === "checking" ? "Checking Solana…" : "I paid — verify payment"}</button> : null}
    </div> : null}
    {status === "paid" ? <button type="button" onClick={copyRecovery} className="mt-4 rounded-sbt border border-sbt-gold/50 px-4 py-3 font-medium">Copy private recovery code</button> : null}
    {recoveryCode ? <p className="mt-2 break-all rounded-sbt bg-sbt-paper p-3 font-mono text-xs">{recoveryCode}</p> : null}
    {offer.recoveryEnabled ? <div className="mt-5 border-t border-sbt-linen pt-4">
      <button type="button" onClick={() => setRecoveryVisible(!recoveryVisible)} className="text-sm font-medium text-sbt-gold-700 underline underline-offset-2">Already paid? Restore with a recovery code</button>
      {recoveryVisible ? <div className="mt-3 space-y-2"><label htmlFor="solana-recovery" className="block text-xs">Private recovery code</label><input id="solana-recovery" type="password" autoComplete="off" value={recoveryInput} onChange={(event) => setRecoveryInput(event.target.value)} className="min-h-11 w-full rounded-sbt border border-sbt-linen p-2" /><button type="button" onClick={restore} className="min-h-11 rounded-sbt bg-sbt-ink px-4 py-2 text-sbt-paper">Restore pass</button></div> : null}
    </div> : null}
    {message ? <p role="status" className="mt-3">{message}</p> : null}
  </section>;
}
