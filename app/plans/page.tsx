"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { checkout, FREE_LIMIT, PLANS, readUsage, type PlanId, type Usage } from "@/lib/usage";
import { config } from "@/lib/config";
import { LEGITIMACY_LAWS } from "@/lib/legitimacy";

export default function PlansPage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setUsage(readUsage()), []);

  async function choose(id: PlanId) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await checkout(id);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setNotice(r.message);
      setUsage(readUsage());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Checkout unavailable.");
    } finally {
      setBusy(false);
    }
  }

  if (config.billingMode === "mock") {
    return (
      <section className="mx-auto max-w-2xl rounded-sbt border border-sbt-linen bg-white/70 p-6 shadow-soft sm:p-8">
        <p className="text-[10px] uppercase tracking-widest text-sbt-mute">first public release</p>
        <h1 className="mt-2 font-display text-3xl text-sbt-ink">Subtext is free right now.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-sbt-dusk">
          Unlimited on-device reads, the evidence behind every score, and Answer Coach are included.
          There is no checkout and no payment is taken in this release.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-sbt bg-sbt-gold px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sbt-gold-700"
        >
          Read a conversation
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl text-sbt-ink">Plans</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-sbt-dusk">
          Free is capped at {FREE_LIMIT} reads a month rather than throttled, because every
          analysis — including a free one — costs a real model call. The cap is the cost control,
          honestly stated.
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-sbt-mute">
          billing mode: {config.billingMode} · no payment is taken in this build
        </p>
      </header>

      {notice ? (
        <p className="rounded-sbt border border-sbt-teal/40 bg-sbt-teal/10 px-4 py-3 text-sm text-sbt-teal">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const active = usage?.plan === p.id;
          return (
            <div
              key={p.id}
              className={`flex flex-col rounded-sbt border p-5 ${
                active ? "border-sbt-gold bg-sbt-gold/[0.06]" : "border-sbt-linen bg-white/70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg text-sbt-ink">{p.name}</h2>
                {active ? (
                  <span className="rounded-full bg-sbt-gold px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">
                    current
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-3xl text-sbt-ink">{p.price}</span>
                <span className="text-xs text-sbt-mute">{p.cadence}</span>
              </div>
              {p.annual ? <p className="text-[11px] text-sbt-teal">{p.annual}</p> : null}

              <p className="mt-2 text-[13px] leading-relaxed text-sbt-dusk">{p.blurb}</p>

              <ul className="mt-4 flex-1 space-y-1.5 text-[13px] text-sbt-dusk">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-sbt-gold">·</span>
                    {b}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={busy || active}
                onClick={() => choose(p.id)}
                className="mt-5 rounded-sbt bg-sbt-gold px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sbt-gold-700 disabled:opacity-40"
              >
                {active ? "Your plan" : busy ? "Opening…" : `Choose ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5">
        <h2 className="font-display text-lg text-sbt-ink">The seven legitimacy laws</h2>
        <p className="mt-1 text-[12px] text-sbt-mute">
          Enforced in code on every output, forever — not a launch checklist.
        </p>
        <ol className="mt-3 space-y-2">
          {LEGITIMACY_LAWS.map((law, i) => (
            <li key={law} className="flex gap-3 text-[13px] leading-relaxed text-sbt-dusk">
              <span className="font-display text-sbt-gold">{i + 1}</span>
              <span>{law}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-sbt border border-sbt-linen bg-sbt-linen/40 p-5">
        <h2 className="text-[10px] uppercase tracking-widest text-sbt-mute">wiring payments</h2>
        <ol className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-sbt-dusk">
          <li>1 · Lemon Squeezy store with three variants (Premium monthly, Premium annual, Work).</li>
          <li>
            2 · Add <code>/api/checkout</code> and <code>/api/webhooks/lemon</code> (HMAC-verified).
          </li>
          <li>3 · The webhook writes the entitlement server-side; the client never grants itself.</li>
          <li>
            4 · Set <code>NEXT_PUBLIC_BILLING_MODE=lemonsqueezy</code> — every gate keeps working
            unchanged.
          </li>
        </ol>
      </section>
    </div>
  );
}
