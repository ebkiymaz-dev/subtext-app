"use client";

import Link from "next/link";
import type { CoachSuggestion } from "@/lib/engine/types";

/**
 * PREMIUM Coach. Options tied to evidence, never commands, never tactics for
 * managing the other person — it optimises YOUR communication only, and it is
 * disabled entirely on the care path.
 */
export default function CoachCard({
  suggestions,
  locked,
}: {
  suggestions: CoachSuggestion[];
  locked: boolean;
}) {
  return (
    <section className="relative rounded-sbt border border-sbt-linen bg-white/70 p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-sbt-ink">Coach</h2>
        <span className="rounded-full border border-sbt-gold/40 bg-sbt-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sbt-gold-700">
          Answer Coach
        </span>
      </header>

      <ul className={`space-y-3 ${locked ? "select-none blur-[4px]" : ""}`} aria-hidden={locked}>
        {suggestions.map((s) => (
          <li key={s.action} className="rounded-sbt bg-sbt-paper/70 p-3.5">
            <p className="font-display text-[14px] text-sbt-ink">{s.action}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-sbt-dusk">{s.reasoning}</p>
          </li>
        ))}
      </ul>

      {locked ? (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-sbt border border-sbt-gold/30 bg-white/95 p-4 text-center shadow-soft">
            <p className="font-display text-[15px] text-sbt-ink">
              Coach reads the whole thread and suggests what you could do next.
            </p>
            <Link
              href="/plans"
              className="mt-3 block rounded-sbt bg-sbt-gold px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sbt-gold-700"
            >
              Unlock Premium — $8.99/mo
            </Link>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-sbt-mute">
              billing not connected · no payment is taken
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
