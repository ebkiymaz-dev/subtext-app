"use client";

import type { Analysis, CategoryId } from "@/lib/engine/types";
import { CONFIDENCE_CAPTION } from "@/lib/legitimacy";

const TONE_FILL: Record<string, string> = {
  neutral: "bg-sbt-dusk",
  warm: "bg-sbt-teal",
  caution: "bg-sbt-amber",
};

/**
 * THE HERO — the category panel. Calm sequential fills, never red-by-default:
 * the anti-alarmist rule is what keeps this "not a toy" and "not clinical"
 * at the same time. Every bar carries a one-line read and a caveat.
 */
export default function Panel({
  analysis,
  activeCategory,
  onSelect,
  showAll,
  onToggleAll,
}: {
  analysis: Analysis;
  activeCategory: CategoryId | null;
  onSelect: (id: CategoryId | null) => void;
  showAll: boolean;
  onToggleAll: () => void;
}) {
  // Relevance gating — quiet categories collapse rather than pad the panel.
  const relevant = analysis.categories.filter((c) => c.percent >= 12);
  const shown = showAll ? analysis.categories : relevant.slice(0, 8);
  const hidden = analysis.categories.length - shown.length;

  return (
    <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5">
      <header className="mb-4">
        <h2 className="font-display text-lg text-sbt-ink">What the language carries</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-sbt-mute">{CONFIDENCE_CAPTION}</p>
      </header>

      <ul className="space-y-3.5">
        {shown.map((c) => {
          const active = activeCategory === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : c.id)}
                className={`w-full rounded-sbt p-2.5 text-left transition-colors ${
                  active ? "bg-sbt-gold/10" : "hover:bg-sbt-linen/50"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-[15px] text-sbt-ink">{c.label}</span>
                  <span
                    className={`font-display text-base tabular-nums ${
                      active ? "text-sbt-gold-700" : "text-sbt-dusk"
                    }`}
                  >
                    {c.percent}%
                  </span>
                </div>

                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sbt-linen">
                  <div
                    className={`animate-fill-bar h-full rounded-full ${TONE_FILL[c.tone]}`}
                    style={{ width: `${c.percent}%` }}
                  />
                </div>

                <p className="mt-1.5 text-[13px] leading-relaxed text-sbt-dusk">{c.read}</p>

                <p className="mt-1 text-[10px] uppercase tracking-wider text-sbt-mute">
                  {c.tier === "deterministic" ? "computed on your device" : "inferred · on-device heuristic"}
                  {c.evidence.length ? ` · ${c.evidence.length} evidence line${c.evidence.length > 1 ? "s" : ""}` : ""}
                </p>

                {active ? (
                  <p className="mt-2 rounded-sbt bg-sbt-paper px-3 py-2 text-[12px] leading-relaxed text-sbt-mute">
                    {c.caveat}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={onToggleAll}
          className="mt-4 text-xs text-sbt-gold-700 underline underline-offset-2"
        >
          {showAll ? "Show fewer categories" : `Show ${hidden} quieter categor${hidden === 1 ? "y" : "ies"}`}
        </button>
      ) : null}
    </section>
  );
}
