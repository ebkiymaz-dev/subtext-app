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
  onUnlock,
}: {
  suggestions: CoachSuggestion[];
  locked: boolean;
  onUnlock?: () => void;
}) {
  const visibleSuggestions = locked
    ? [
        { action: "A clearer reply option is ready", reasoning: "Unlock Answer Coach to see the wording and why it fits this conversation." },
        { action: "A lower-pressure alternative is ready", reasoning: "The locked page never embeds your paid suggestions in the browser." },
      ]
    : suggestions;

  return (
    <section id="answer-coach" className="relative overflow-hidden rounded-sbt border-2 border-sbt-gold/55 bg-gradient-to-br from-sbt-gold/[0.18] via-white/90 to-sbt-gold/[0.08] p-5 shadow-soft">
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-sbt-gold/20 blur-2xl" />
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sbt-gold-700">✦ Premium extra</p>
          <h2 className="mt-0.5 font-display text-xl text-sbt-ink">Answer Coach</h2>
        </div>
        <span className="animate-pulse rounded-full bg-sbt-ink px-2.5 py-1 text-[10px] uppercase tracking-wider text-sbt-paper">
          Next reply
        </span>
      </header>

      <ul className={`space-y-3 ${locked ? "select-none blur-[4px]" : ""}`} aria-hidden={locked}>
        {visibleSuggestions.map((s) => (
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
              Answer Coach turns this read into a clearer next reply.
            </p>
            {onUnlock ? (
              <button type="button" onClick={onUnlock} className="mt-3 block w-full rounded-sbt bg-sbt-gold px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sbt-gold-700">
                Unlock Answer Coach — $8.99/mo
              </button>
            ) : (
              <Link href="/plans" className="mt-3 block rounded-sbt bg-sbt-gold px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sbt-gold-700">
                See Answer Coach
              </Link>
            )}
            <p className="mt-2 text-[10px] uppercase tracking-wider text-sbt-mute">
              Google Play subscription · cancel anytime
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
