"use client";

import type { CoachSuggestion } from "@/lib/engine/types";

/** A deliberately optional next-step prompt. It never tells the user what the
 * other person thinks; it offers a way to make the user's own reply clearer. */
export default function AnswerCoachPrompt({
  suggestions,
  onClose,
}: {
  suggestions: CoachSuggestion[];
  onClose: () => void;
}) {
  const first = suggestions[0];
  if (!first) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sbt-ink/25 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="answer-coach-title">
      <section className="w-full max-w-md rounded-sbt border border-sbt-gold/35 bg-sbt-paper p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-sbt-gold-700">answer coach</p>
            <h2 id="answer-coach-title" className="mt-1 font-display text-xl text-sbt-ink">
              Want help with your next reply?
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-sbt-mute hover:text-sbt-ink" aria-label="Close answer coach">Not now</button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-sbt-dusk">
          A useful next move is to {first.action.toLowerCase()}
        </p>
        <p className="mt-2 rounded-sbt bg-white/65 p-3 text-[13px] leading-relaxed text-sbt-dusk">
          The coach helps you state what you need clearly. It does not guess feelings or give tactics for controlling someone else.
        </p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-sbt bg-sbt-gold px-4 py-2.5 text-sm font-medium text-white hover:bg-sbt-gold-700">
          Show me the coach
        </button>
      </section>
    </div>
  );
}
