"use client";

import type { Interpretation } from "@/lib/engine/types";

/**
 * 3–5 competing reads, weighted, summing to 100 — and the most-charitable
 * one is always present and always visually distinct (teal). The design
 * never lets the darkest read stand alone.
 */
export default function Interpretations({ items }: { items: Interpretation[] }) {
  const charitable = items.find((item) => item.charitable) ?? items[0];
  const alternatives = items.filter((item) => item !== charitable);

  const card = (it: Interpretation) => (
    <article
      className={`rounded-sbt border p-4 ${
        it.charitable ? "border-sbt-teal/35 bg-sbt-teal/[0.05]" : "border-sbt-linen bg-sbt-paper/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[15px] text-sbt-ink">{it.title}</h3>
        <span className={`font-display text-base tabular-nums ${it.charitable ? "text-sbt-teal" : "text-sbt-dusk"}`}>
          {it.weight}%
        </span>
      </div>
      {it.charitable ? (
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-sbt-teal">the most charitable reading</p>
      ) : null}
      <p className="mt-2 text-[13.5px] leading-relaxed text-sbt-dusk">{it.body}</p>
      {(it.quotes ?? []).map((quote) => (
        <p key={quote} className="mt-2 border-l-2 border-sbt-gold/50 pl-2.5 font-display text-[13px] italic leading-relaxed text-sbt-mute">
          “{quote}”
        </p>
      ))}
      <div className="mt-3 rounded-sbt bg-white/80 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-sbt-mute">if this reading is the right one</p>
        <p className="mt-1 font-display text-[13.5px] italic leading-relaxed text-sbt-ink">{it.suggestedNext}</p>
      </div>
    </article>
  );

  return (
    <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5">
      <header className="mb-4">
        <h2 className="font-display text-lg text-sbt-ink">Other possible explanations</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-sbt-mute">
          These percentages compare different explanations for the same messages. They are not
          certainty scores, so read the evidence under each one before drawing a conclusion.
        </p>
      </header>

      {charitable ? card(charitable) : null}
      {alternatives.length ? (
        <details className="mt-3 rounded-sbt border border-sbt-linen bg-sbt-paper/40 p-3">
          <summary className="cursor-pointer text-sm font-medium text-sbt-gold-700">
            See {alternatives.length} other possible explanation{alternatives.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-3 space-y-3">{alternatives.map((item) => <div key={item.id}>{card(item)}</div>)}</div>
        </details>
      ) : null}
    </section>
  );
}
