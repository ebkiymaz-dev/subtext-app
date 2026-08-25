"use client";

import Link from "next/link";
import { COACH_GOALS, type CoachGoalId, type PersonalizedCoachResult } from "@/lib/engine/answerCoach";

export default function CoachCard({ locked, state, result, goal, onUnlock, onRun }: {
  locked: boolean;
  state: "idle" | "running" | "done";
  result: PersonalizedCoachResult | null;
  goal: CoachGoalId;
  onUnlock?: () => void;
  onRun: () => void;
}) {
  return (
    <section id="answer-coach" className="relative overflow-hidden rounded-sbt border-2 border-sbt-gold/55 bg-gradient-to-br from-sbt-gold/[0.18] via-white/90 to-sbt-gold/[0.08] p-5 shadow-soft">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sbt-gold-700">✦ Premium · individualized</p><h2 className="mt-0.5 font-display text-xl text-sbt-ink">Help with your next reply</h2><p className="mt-1 text-xs text-sbt-mute">Goal: {COACH_GOALS[goal].label}</p></div>
        <span className="rounded-full bg-sbt-ink px-2.5 py-1 text-[10px] uppercase tracking-wider text-sbt-paper">Answer Coach</span>
      </header>

      {locked ? (
        <div className="rounded-sbt border border-sbt-gold/30 bg-white/95 p-4 text-center shadow-soft">
          <p className="font-display text-[15px] text-sbt-ink">Conversation-specific analysis and three editable replies.</p>
          <p className="mt-1 text-[12px] leading-relaxed text-sbt-mute">Coach considers the actual words, your goal, competing explanations, your own contribution, and practical risk.</p>
          {onUnlock ? <button type="button" onClick={onUnlock} className="mt-3 min-h-11 w-full rounded-sbt bg-sbt-gold-700 px-4 py-2.5 text-sm font-medium text-white">Unlock Answer Coach — $8.99/mo</button> : <Link href="/plans" className="mt-3 flex min-h-11 items-center justify-center rounded-sbt bg-sbt-gold-700 px-4 py-2.5 text-sm font-medium text-white">See Answer Coach</Link>}
          <p className="mt-2 text-[10px] uppercase tracking-wider text-sbt-mute">Google Play subscription · cancel anytime</p>
        </div>
      ) : null}

      {!locked && state === "idle" ? <div><p className="text-[13px] leading-relaxed text-sbt-dusk">This sends the conversation, selected context, goal, tone, and optional notes to Subtext and the named AI provider shown at generation time. The Subtext application does not intentionally retain the conversation; the provider processes it under its own terms. Google Play entitlement is verified first.</p><p className="mt-2 text-xs text-sbt-mute">Remove names, phone numbers, addresses, order details, or payment information you do not want transmitted.</p><button type="button" onClick={onRun} className="mt-3 min-h-11 w-full rounded-sbt bg-sbt-ink px-4 py-2.5 text-sm font-medium text-sbt-paper">Send and generate</button></div> : null}
      {!locked && state === "running" ? <div className="flex items-center gap-3 py-4"><div className="h-1 w-32 overflow-hidden rounded-full bg-sbt-linen"><div className="h-full w-1/2 animate-pulse rounded-full bg-sbt-gold" /></div><p className="font-display italic text-sbt-mute">Reading the actual exchange…</p></div> : null}
      {!locked && state === "done" && result && !result.ok ? <div className="rounded-sbt bg-white/75 p-3.5"><p className="text-[13px] leading-relaxed text-sbt-dusk">{result.reason}</p><button type="button" onClick={onRun} className="mt-2 text-xs text-sbt-gold-700 underline underline-offset-2">Try again</button></div> : null}
      {!locked && state === "done" && result?.ok && result.coach ? <CoachResult result={result} /> : null}
      <p className="mt-3 text-[11px] leading-relaxed text-sbt-mute">Psychologically informed communication support—not therapy, mind-reading, or a guaranteed outcome. Keep only what is true in your voice.</p>
    </section>
  );
}

function CoachResult({ result }: { result: PersonalizedCoachResult }) {
  const coach = result.coach!;
  return (
    <div className="space-y-4">
      <p className="font-display text-[16px] leading-relaxed text-sbt-ink">{coach.summary}</p>
      <div className="rounded-sbt bg-white/75 p-3.5"><p className="text-[10px] uppercase tracking-wider text-sbt-mute">Recommended approach</p><p className="mt-1 text-[13.5px] leading-relaxed text-sbt-ink">{coach.recommendedApproach}</p></div>
      <div><h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">Replies you can edit</h3><ul className="mt-2 space-y-2.5">{coach.replies.map((reply) => <li key={reply.style} className="rounded-sbt border border-sbt-gold/25 bg-white/85 p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wider text-sbt-gold-700">{reply.style}</p><p className="mt-1.5 font-display text-[14px] leading-relaxed text-sbt-ink">“{reply.text}”</p><p className="mt-2 text-[12px] leading-relaxed text-sbt-dusk">{reply.why}</p><p className="mt-1 text-[11px] leading-relaxed text-sbt-mute">Tradeoff: {reply.tradeoff}</p></li>)}</ul></div>
      <details className="rounded-sbt border border-sbt-linen bg-white/60 p-3"><summary className="cursor-pointer text-sm font-medium text-sbt-gold-700">See evidence, alternatives, and cautions</summary><div className="mt-3 space-y-3">
        <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">What is observable</p>{coach.observations.map((item) => <div key={item.quote} className="mt-2 text-[12.5px] text-sbt-dusk"><p>{item.observation}</p><p className="mt-1 border-l-2 border-sbt-gold/40 pl-2 italic text-sbt-mute">“{item.quote}”</p></div>)}</div>
        <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">Possible readings</p>{coach.possibleReadings.map((item) => <div key={item.title} className="mt-2"><p className="font-display text-[13px] text-sbt-ink">{item.title}</p><p className="text-[12px] leading-relaxed text-sbt-dusk">{item.explanation}</p></div>)}</div>
        <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">Your side of the pattern</p><p className="mt-1 text-[12px] leading-relaxed text-sbt-dusk">{coach.userContribution}</p></div>
        {coach.avoid.length ? <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">Avoid</p><ul className="mt-1 list-disc pl-4 text-[12px] leading-relaxed text-sbt-dusk">{coach.avoid.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        <p className="text-[12px] leading-relaxed text-sbt-dusk">{coach.safetyNote}</p><p className="text-[11px] text-sbt-mute">Evidence strength: {coach.confidence.level} — {coach.confidence.why}</p>
      </div></details>
      <p className="text-[10px] uppercase tracking-wider text-sbt-mute">{result.provider} · {result.model} · quoted evidence checked before display</p>
    </div>
  );
}
