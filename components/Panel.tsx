"use client";

import type { Analysis, CategoryId } from "@/lib/engine/types";
import { CONFIDENCE_CAPTION } from "@/lib/legitimacy";

const strength = (percent: number) => percent >= 65 ? "Strong evidence" : percent >= 35 ? "Moderate evidence" : "Weak evidence";

function preview(read: string, limit = 220) {
  if (read.length <= limit) return read;
  const clipped = read.slice(0, limit);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 150 ? lastSpace : limit).trim()}…`;
}

/**
 * THE HERO — the category panel. Calm sequential fills, never red-by-default:
 * the anti-alarmist rule is what keeps this "not a toy" and "not clinical"
 * at the same time. Every bar carries a one-line read and a caveat.
 */
export default function Panel({
  analysis,
  youName,
  themName,
  activeCategory,
  onSelect,
  showAll,
  onToggleAll,
}: {
  analysis: Analysis;
  youName: string;
  themName: string;
  activeCategory: CategoryId | null;
  onSelect: (id: CategoryId | null) => void;
  showAll: boolean;
  onToggleAll: () => void;
}) {
  // Relevance gating — quiet categories collapse rather than pad the panel.
  const relevant = analysis.categories.filter((c) => c.percent >= 12);
  // Always expose a small percentage read, even when every signal is weak.
  // Hiding all bars made a careful low-confidence result look broken.
  const shown = showAll
    ? analysis.categories
    : relevant.length > 0
      ? relevant.slice(0, 5)
      : analysis.categories.slice(0, 3);
  const hidden = analysis.categories.length - shown.length;
  const isPost = themName === "Post author";

  return (
    <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5">
      <header className="mb-4">
        <h2 className="font-display text-lg text-sbt-ink">Pattern scores</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-sbt-mute">{CONFIDENCE_CAPTION}</p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span className="text-emerald-700"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />{youName} = your context</span>
          <span className="text-sky-700"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />{themName} = {isPost ? "the wording being read" : "the side these readings describe"}</span>
        </p>
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
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? "text-sbt-gold-700" : "text-sbt-mute"}`}>
                    {c.percent}% · {strength(c.percent)} · {c.evidence.length} {isPost ? `wording cue${c.evidence.length === 1 ? "" : "s"}` : `message moment${c.evidence.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                <p className="mt-1.5 text-[13px] leading-relaxed text-sbt-dusk">{active ? c.read : preview(c.read)}</p>

                {!active && c.read.length > 220 ? (
                  <span className="mt-1 block text-[11px] font-medium text-sbt-gold-700">Open for the full explanation</span>
                ) : null}

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
