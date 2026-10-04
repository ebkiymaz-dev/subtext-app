"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SolanaCheckout from "@/components/SolanaCheckout";
import WalletConnect from "@/components/WalletConnect";
import {
  PLAY_BILLING_EVENT,
  managePlaySubscription,
  readPlayBillingState,
  requestPlayPurchase,
  restorePlayPurchases,
  stateFromBillingEvent,
  type PlayBillingState,
} from "@/lib/playBilling";

export default function PlansPage() {
  const [billing, setBilling] = useState<PlayBillingState>({ android: false, status: "loading", entitled: false });

  useEffect(() => {
    setBilling(readPlayBillingState());
    const onBilling = (event: Event) => {
      const next = stateFromBillingEvent(event);
      if (next) setBilling(next);
    };
    window.addEventListener(PLAY_BILLING_EVENT, onBilling);
    return () => window.removeEventListener(PLAY_BILLING_EVENT, onBilling);
  }, []);

  const price = billing.price ?? "$8.99/month";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sbt-gold-700">✦ Optional paid extra</p>
        <h1 className="mt-2 font-display text-3xl text-sbt-ink">AnswerAce</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-sbt-dusk">
          The conversation reader, speaker labels, evidence strengths, explanations, and private archive stay free.
          AnswerAce adds individualized analysis and editable replies grounded in the conversation and your goal.
        </p>
      </header>

      <section className="overflow-hidden rounded-sbt border-2 border-sbt-gold/55 bg-gradient-to-br from-white via-sbt-paper to-sbt-gold/10 p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-sbt-ink">AnswerAce Premium</h2>
            <p className="mt-1 text-sm text-sbt-mute">Google Play subscription · cancel anytime</p>
          </div>
          <p className="font-display text-2xl text-sbt-ink">{price}</p>
        </div>
        <ul className="mt-5 space-y-2 text-sm leading-relaxed text-sbt-dusk">
          <li>✓ Actual conversation analyzed against your chosen goal</li>
          <li>✓ Warm, direct, and boundary replies with tradeoffs</li>
          <li>✓ Competing explanations and your side of the pattern</li>
          <li>✓ No instructions for manipulating or controlling another person</li>
          <li>✓ Restores automatically with the purchasing Google Play account</li>
          <li>✓ Core Subtext analysis remains free if you cancel</li>
        </ul>

        {billing.entitled ? (
          <div className="mt-5 space-y-3">
            <p role="status" className="rounded-sbt bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              AnswerAce is active on this device.
            </p>
            <button type="button" onClick={() => managePlaySubscription()} className="w-full rounded-sbt border border-sbt-gold/40 px-4 py-3 text-sm font-medium text-sbt-gold-700">
              Manage subscription in Google Play
            </button>
          </div>
        ) : billing.android ? (
          <div className="mt-5 space-y-3">
            <button type="button" disabled={billing.status === "loading"} onClick={() => requestPlayPurchase()} className="min-h-11 w-full rounded-sbt bg-sbt-gold-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {billing.status === "loading" ? "Connecting to Google Play…" : `Start AnswerAce — ${price}`}
            </button>
            <button type="button" onClick={() => restorePlayPurchases()} className="w-full px-4 py-2 text-sm text-sbt-gold-700 underline underline-offset-2">
              Restore an existing purchase
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-sbt border border-sbt-linen bg-white/70 p-4">
            <p className="text-sm leading-relaxed text-sbt-dusk">
              Google Play subscriptions are purchased and managed inside the Subtext Android app.
              The web reader remains free; an optional prepaid Solana pass appears below when available.
            </p>
          </div>
        )}

        {billing.message ? <p role="status" className="mt-3 text-xs leading-relaxed text-sbt-mute">{billing.message}</p> : null}
      </section>

      <WalletConnect />
      {billing.status !== "loading" && billing.solanaAllowed ? <SolanaCheckout /> : null}

      <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5 text-sm leading-relaxed text-sbt-dusk">
        <h2 className="font-display text-lg text-sbt-ink">Before you subscribe</h2>
        <p className="mt-2">
          AnswerAce is communication guidance, not professional, medical, legal, or emergency advice.
          It can be wrong. Review every suggestion before sending it.
        </p>
        <p className="mt-2">
          Unlike the free reader, AnswerAce sends the conversation to the configured AI provider for one requested analysis. Subtext does not intentionally retain the conversation.
        </p>
      </section>

      <Link href="/" className="inline-block text-sm text-sbt-gold-700 underline underline-offset-2">Back to your read</Link>
    </div>
  );
}
