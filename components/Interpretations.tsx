"use client";

import type { Interpretation } from "@/lib/engine/types";

/**
 * 3–5 competing reads, weighted, summing to 100 — and the most-charitable
 * one is always present and always visually distinct (teal). The design
 * never lets the darkest read stand alone.
 */
export default function Interpretations({ items }: { items: Interpretation[] }) {
  return (
    <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5">
      <header className="mb-4">
        <h2 className="font-display text-lg text-sbt-ink">Competing readings</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-sbt-mute">
          These weights are how the evidence distributes across possible readings — not how likely
          each one is to be true. They add to 100 because they are alternatives, and none is allowed
          to dominate.
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            className={`rounded-sbt border p-4 ${
              it.charitable ? "border-sbt-teal/35 bg-sbt-teal/[0.05]" : "border-sbt-linen bg-sbt-paper/60"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[15px] text-sbt-ink">{it.title}</h3>
              <span
                className={`font-display text-base tabular-nums ${
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

            <p className="mt-2 text-[13.5px] leading-relaxed text-sbt-dusk">{it.body}</p>

            {/* Law 2 again: a reading with no line behind it is a horoscope. */}
            {(it.quotes ?? []).map((q) => (
              <p
                key={q}
                className="mt-2 border-l-2 border-sbt-gold/50 pl-2.5 font-display text-[13px] italic leading-relaxed text-sbt-mute"
              >
                “{q}”
              </p>
            ))}

            <div className="mt-3 rounded-sbt bg-white/80 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-sbt-mute">
                if this reading is the right one
              </p>
              <p className="mt-1 font-display text-[13.5px] italic leading-relaxed text-sbt-ink">
                {it.suggestedNext}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
