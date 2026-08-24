"use client";

import type { CoachSuggestion } from "@/lib/engine/types";

/** A deliberately optional next-step prompt. It never tells the user what the
 * other person thinks; it offers a way to make the user's own reply clearer. */
export default function AnswerCoachPrompt({
  suggestions,
  onClose,
  onOpen,
}: {
  suggestions: CoachSuggestion[];
  onClose: () => void;
  onOpen: () => void;
}) {
  const first = suggestions[0];
  if (!first) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sbt-ink/25 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="answer-coach-title">
      <section className="relative w-full max-w-md overflow-hidden rounded-sbt border-2 border-sbt-gold/60 bg-gradient-to-br from-sbt-paper via-white to-sbt-gold/15 p-5 shadow-soft">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-sbt-gold/25 blur-2xl" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sbt-gold-700">✦ Premium extra · Answer Coach</p>
            <h2 id="answer-coach-title" className="mt-1 font-display text-xl text-sbt-ink">
              Want help with your next reply?
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-sbt-mute hover:text-sbt-ink" aria-label="Close answer coach">Not now</button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-sbt-dusk">
          Answer Coach has clearer reply options ready for this conversation, including a lower-pressure alternative.
        </p>
        <p className="mt-2 rounded-sbt bg-white/65 p-3 text-[13px] leading-relaxed text-sbt-dusk">
          The coach helps you state what you need clearly. It does not guess feelings or give tactics for controlling someone else.
        </p>
        <button type="button" onClick={onOpen} className="mt-4 w-full rounded-sbt bg-sbt-gold px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-sbt-gold-700">
          Open Answer Coach ✦
        </button>
      </section>
    </div>
  );
}
