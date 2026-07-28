"use client";

import Link from "next/link";
import type { DeepReadResult } from "@/lib/engine/deepRead";

/**
 * THE AI-ASSISTED READ (Premium).
 *
 * Two things this component does that most "AI section" UIs do not:
 *
 *   1. It states the privacy trade BEFORE the button, not in a footer. The
 *      free tier's promise is that nothing leaves the device; this tier
 *      breaks that promise on purpose and the user has to be the one who
 *      decides to. A consent line that appears after the request would be
 *      decoration.
 *   2. It shows the validator's repairs. When the model invented a quote and
 *      the grounding check deleted it, that is visible here. A model that is
 *      being corrected is more trustworthy than one that appears perfect,
 *      and hiding the corrections is how a product loses the right to be
 *      believed about anything else.
 */
export default function DeepReadCard({
  state,
  result,
  locked,
  providerLabel,
  onRun,
}: {
  state: "idle" | "running" | "done";
  result: DeepReadResult | null;
  locked: boolean;
  providerLabel: string | null;
  onRun: () => void;
}) {
  if (locked) {
    return (
      <section className="rounded-sbt border border-sbt-gold/30 bg-sbt-gold/[0.05] p-5">
        <header className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-sbt-ink">The deep read</h2>
          <span className="rounded-full border border-sbt-gold/40 bg-sbt-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sbt-gold-700">
            Premium · AI-assisted
          </span>
        </header>
        <p className="text-[13.5px] leading-relaxed text-sbt-dusk">
          Everything above is computed on your device. The deep read sends this conversation to a
          language model for one structured pass — attachment and relational cues, what the moves may
          be doing, and competing readings argued from quoted lines.
        </p>
        <Link
          href="/plans"
          className="mt-3 inline-block rounded-sbt bg-sbt-gold px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sbt-gold-700"
        >
          Unlock Premium — $8.99/mo
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-sbt-ink">The deep read</h2>
        <span className="rounded-full border border-sbt-gold/40 bg-sbt-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sbt-gold-700">
          AI-assisted{providerLabel ? ` · ${providerLabel}` : ""}
        </span>
      </header>

      {state === "idle" ? (
        <>
          <div className="rounded-sbt border border-sbt-amber/30 bg-sbt-amber/[0.06] p-3.5">
            <p className="text-[10px] uppercase tracking-wider text-sbt-mute">before you press this</p>
            <p className="mt-1 text-[13px] leading-relaxed text-sbt-dusk">
              Everything you have read so far ran <strong>on your device</strong> and went nowhere.
              The deep read is different: it sends this conversation to{" "}
              {providerLabel ?? "a hosted model"} for one pass. Nothing is stored by Subtext, but the
              text does leave your machine. If that is not a trade you want to make, the analysis
              above is complete on its own.
            </p>
          </div>
          <button
            type="button"
            onClick={onRun}
            className="mt-3 rounded-sbt bg-sbt-ink px-5 py-2.5 text-sm font-medium text-sbt-paper transition-colors hover:bg-sbt-dusk"
          >
            Run the deep read
          </button>
        </>
      ) : null}

      {state === "running" ? (
        <div className="flex items-center gap-3 py-4">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-sbt-linen">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-sbt-gold" />
          </div>
          <p className="font-display text-[15px] italic text-sbt-mute">Reading it properly…</p>
        </div>
      ) : null}

      {state === "done" && result && !result.ok ? (
        <div className="rounded-sbt bg-sbt-linen/60 p-3.5">
          <p className="text-[13px] leading-relaxed text-sbt-dusk">{result.reason}</p>
          <button
            type="button"
            onClick={onRun}
            className="mt-2 text-xs text-sbt-gold-700 underline underline-offset-2"
          >
            try again
          </button>
        </div>
      ) : null}

      {state === "done" && result?.ok && result.read ? (
        <div className="space-y-4">
          <p className="font-display text-[16px] leading-relaxed text-sbt-ink">{result.read.headline}</p>

          <Claims title="What the phrasing is doing" items={result.read.subtext} />
          {result.read.relationalCues.length ? (
            <Claims title="Relational patterns in this exchange" items={result.read.relationalCues} />
          ) : null}

          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">competing readings</h3>
            <ul className="mt-2 space-y-2.5">
              {result.read.interpretations.map((it) => (
                <li
                  key={it.title}
                  className={`rounded-sbt border p-3.5 ${
                    it.charitable ? "border-sbt-teal/35 bg-sbt-teal/[0.05]" : "border-sbt-linen bg-sbt-paper/60"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="font-display text-[14.5px] text-sbt-ink">{it.title}</h4>
                    <span
                      className={`font-display text-[15px] tabular-nums ${
                        it.charitable ? "text-sbt-teal" : "text-sbt-dusk"
                      }`}
                    >
                      {it.weight}%
                    </span>
                  </div>
                  {it.charitable ? (
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-sbt-teal">
                      the most charitable reading
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-sbt-dusk">{it.body}</p>
                  {it.quotes.map((q) => (
                    <p
                      key={q}
                      className="mt-1.5 border-l-2 border-sbt-gold/50 pl-2.5 font-display text-[13px] italic text-sbt-mute"
                    >
                      “{q}”
                    </p>
                  ))}
                  {it.suggestedNext ? (
                    <p className="mt-2 rounded-sbt bg-white/80 px-3 py-2 text-[13px] leading-relaxed text-sbt-ink">
                      {it.suggestedNext}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {result.read.whatWasntSaid.length ? (
            <div>
              <h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">what wasn&rsquo;t said</h3>
              <ul className="mt-2 space-y-1.5">
                {result.read.whatWasntSaid.map((w) => (
                  <li key={w} className="flex gap-2 text-[13px] leading-relaxed text-sbt-dusk">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sbt-gold" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.read.nextMoves.length ? (
            <div>
              <h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">
                options — not instructions
              </h3>
              <ul className="mt-2 space-y-2">
                {result.read.nextMoves.map((n) => (
                  <li key={n.option} className="rounded-sbt bg-sbt-paper/70 p-3">
                    <p className="font-display text-[14px] text-sbt-ink">{n.option}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-sbt-dusk">{n.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-sbt bg-sbt-linen/50 p-3">
            <p className="text-[11px] leading-relaxed text-sbt-dusk">
              <span className="uppercase tracking-wider text-sbt-mute">confidence: </span>
              {result.read.confidence.level} — {result.read.confidence.why}
            </p>
            <p className="mt-1.5 text-[10px] uppercase tracking-wider text-sbt-mute">
              AI-assisted · {result.provider} · {result.model} · every quote above was checked
              character-for-character against your paste before it was shown
            </p>
            {result.repairs?.length ? (
              <ul className="mt-1.5 space-y-0.5">
                {result.repairs.map((r) => (
                  <li key={r} className="text-[10px] leading-relaxed text-sbt-mute">
                    · validator: {r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Claims({
  title,
  items,
}: {
  title: string;
  items: { observation: string; quote: string; reading: string }[];
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">{title}</h3>
      <ul className="mt-2 space-y-2.5">
        {items.map((c) => (
          <li key={c.quote + c.observation} className="rounded-sbt bg-sbt-paper/70 p-3.5">
            <p className="text-[13.5px] leading-relaxed text-sbt-ink">{c.observation}</p>
            <p className="mt-1.5 border-l-2 border-sbt-gold/50 pl-2.5 font-display text-[13px] italic text-sbt-mute">
              “{c.quote}”
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-sbt-dusk">{c.reading}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
