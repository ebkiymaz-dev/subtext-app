"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BASE_PATH } from "@/lib/basePath";
import { COACH_GOALS, type CoachGoalId, type PersonalizedCoachResult } from "@/lib/engine/answerCoach";
import { recordProductEvent } from "@/lib/product-events";

export default function CoachCard({ locked, state, result, goal, onUnlock, onRun, freeTrial = false }: {
  freeTrial?: boolean;
  locked: boolean;
  state: "idle" | "running" | "done";
  result: PersonalizedCoachResult | null;
  goal: CoachGoalId;
  onUnlock?: () => void;
  onRun: () => void;
}) {
  const [providerDisclosure, setProviderDisclosure] = useState<{ label: string; privacy: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${BASE_PATH}/api/capabilities`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((report) => {
        const provider = report?.coachProvider;
        if (active && provider?.configured && provider?.label) {
          setProviderDisclosure({ label: String(provider.label), privacy: String(provider.privacy ?? "") });
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <section id="answer-coach" className="relative overflow-hidden rounded-sbt border-2 border-sbt-gold/55 bg-gradient-to-br from-sbt-gold/[0.18] via-white/90 to-sbt-gold/[0.08] p-5 shadow-soft">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sbt-gold-700">✦ Premium · personalized</p><h2 className="mt-0.5 font-display text-xl text-sbt-ink">Your next move</h2><p className="mt-1 text-xs text-sbt-mute">Goal: {COACH_GOALS[goal].label}</p></div>
        <span className="rounded-full bg-sbt-ink px-2.5 py-1 text-[10px] uppercase tracking-wider text-sbt-paper">AnswerAce</span>
      </header>

      {locked ? (
        <div className="rounded-sbt border border-sbt-gold/30 bg-white/95 p-4 text-center shadow-soft">
          <p className="font-display text-[15px] text-sbt-ink">A situation-aware approach and three editable replies.</p>
          <p className="mt-1 text-[12px] leading-relaxed text-sbt-mute">AnswerAce weighs the actual words, your goal, competing explanations, your own contribution, and practical risk.</p>
          <div className="mt-3 space-y-2 text-left" aria-label="Locked reply styles">
            {["Calm and low-pressure", "Clear and direct", "Protective boundary"].map((label) => (
              <div key={label} className="flex min-h-11 items-center justify-between rounded-sbt border border-sbt-linen bg-sbt-paper/70 px-3 text-xs text-sbt-dusk">
                <span>{label}</span><span aria-hidden="true">🔒</span>
              </div>
            ))}
          </div>
          {onUnlock ? <button type="button" onClick={onUnlock} className="mt-3 min-h-11 w-full rounded-sbt bg-sbt-gold-700 px-4 py-2.5 text-sm font-medium text-white">Unlock AnswerAce — $8.99/mo</button> : <Link href="/plans" className="mt-3 flex min-h-11 items-center justify-center rounded-sbt bg-sbt-gold-700 px-4 py-2.5 text-sm font-medium text-white">See AnswerAce</Link>}
          <p className="mt-2 text-[10px] uppercase tracking-wider text-sbt-mute">Optional paid access · see AnswerAce plans</p>
        </div>
      ) : null}

      {freeTrial && <p className="mb-3 text-sm text-sbt-dusk">Three free AnswerAce generations each UTC calendar month per installation. Your free allowance is checked on the server. Local reads remain free.</p>}
      {!locked && state === "idle" ? <div><p className="text-[13px] leading-relaxed text-sbt-dusk">{providerDisclosure ? <>This sends the conversation, selected context, goal, tone, and optional notes to Subtext and <strong>{providerDisclosure.label}</strong> to generate the answer. {providerDisclosure.privacy}</> : <>AnswerAce is unavailable until Subtext can identify the configured AI provider and show its data terms here.</>} Your subscription or free allowance is verified first.</p><p className="mt-2 text-xs text-sbt-mute">Remove names, phone numbers, addresses, order details, or payment information you do not want transmitted. Nothing is sent unless you choose the button below.</p><button type="button" disabled={!providerDisclosure} onClick={onRun} className="mt-3 min-h-11 w-full rounded-sbt bg-sbt-ink px-4 py-2.5 text-sm font-medium text-sbt-paper disabled:cursor-not-allowed disabled:opacity-45">{providerDisclosure ? "Generate my approach and replies" : "Provider disclosure unavailable"}</button></div> : null}
      {!locked && state === "running" ? <div className="flex items-center gap-3 py-4"><div className="h-1 w-32 overflow-hidden rounded-full bg-sbt-linen"><div className="h-full w-1/2 animate-pulse rounded-full bg-sbt-gold" /></div><p className="font-display italic text-sbt-mute">Reading the actual exchange…</p></div> : null}
      {!locked && state === "done" && result && !result.ok ? <div className="rounded-sbt bg-white/75 p-3.5"><p className="text-[13px] leading-relaxed text-sbt-dusk">{result.reason}</p><button type="button" onClick={onRun} className="mt-2 text-xs text-sbt-gold-700 underline underline-offset-2">Try again</button></div> : null}
      {!locked && state === "done" && result?.ok && result.coach ? <CoachResult result={result} /> : null}
      <p className="mt-3 text-[11px] leading-relaxed text-sbt-mute">Evidence-informed communication support—not therapy, mind-reading, or a guaranteed outcome. Keep only what is true in your voice.</p>
    </section>
  );
}

function CoachResult({ result }: { result: PersonalizedCoachResult }) {
  const coach = result.coach!;
  const [copiedReply, setCopiedReply] = useState<number | null>(null);
  async function copyReply(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReply(index);
      recordProductEvent("answer_reply_copied");
      window.setTimeout(() => setCopiedReply((current) => current === index ? null : current), 1800);
    } catch {
      setCopiedReply(null);
    }
  }
  const decisionLabel = {
    reply_once: "Reply once",
    clarify: "Ask for clarity",
    wait: "Wait for their response",
    no_reply: "Do not reply",
    document: "Keep it in writing",
    seek_support: "Get support",
  } as const;
  const exposureLabel = {
    low: "Low emotional exposure",
    balanced: "Balanced",
    open: "More emotionally open",
    protective: "Protective / firm boundary",
  } as const;
  return (
    <div className="space-y-4">
      <p className="font-display text-[16px] leading-relaxed text-sbt-ink">{coach.summary}</p>
      <div className="rounded-sbt bg-white/75 p-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-wider text-sbt-mute">Recommended approach</p><span className="rounded-full bg-sbt-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-sbt-paper">{decisionLabel[coach.responseDecision]}</span></div><p className="mt-1 text-[13.5px] leading-relaxed text-sbt-ink">{coach.recommendedApproach}</p></div>
      <div className="rounded-sbt border border-sbt-gold/30 bg-white/85 p-3.5">
        <p className="text-[10px] uppercase tracking-wider text-sbt-mute">Your action plan</p>
        <ol className="mt-2 space-y-2.5">
          <li className="grid grid-cols-[3.5rem_1fr] gap-2 text-[12.5px] leading-relaxed"><span className="font-semibold text-sbt-gold-700">Now</span><span className="text-sbt-dusk">{coach.actionPlan.now}</span></li>
          <li className="grid grid-cols-[3.5rem_1fr] gap-2 text-[12.5px] leading-relaxed"><span className="font-semibold text-sbt-gold-700">Message</span><span className="text-sbt-dusk">{coach.actionPlan.messageStrategy}</span></li>
          <li className="grid grid-cols-[3.5rem_1fr] gap-2 text-[12.5px] leading-relaxed"><span className="font-semibold text-sbt-gold-700">After</span><span className="text-sbt-dusk">{coach.actionPlan.after}</span></li>
        </ol>
        <p className="mt-3 border-l-2 border-sbt-gold/40 pl-2 text-[11px] italic leading-relaxed text-sbt-mute">Based on: “{coach.actionPlan.evidenceQuotes.join("” · “")}”</p>
      </div>
      <div><h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">Replies you can edit</h3><p className="mt-1 text-[11px] leading-relaxed text-sbt-mute">Choose how much emotion and vulnerability fits this situation. More open is not automatically better.</p><ul className="mt-2 space-y-2.5">{coach.replies.map((reply, index) => <li key={`${reply.style}-${reply.exposure}`} className="rounded-sbt border border-sbt-gold/25 bg-white/85 p-3.5"><div className="flex items-start justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-sbt-gold-700">{exposureLabel[reply.exposure]} · {reply.style}</p><button type="button" onClick={() => void copyReply(reply.text, index)} className="min-h-9 shrink-0 rounded-full border border-sbt-gold/35 px-3 text-[11px] font-semibold text-sbt-gold-700" aria-label={`Copy ${reply.style} reply`}>{copiedReply === index ? "Copied ✓" : "Copy"}</button></div><p className="mt-1.5 font-display text-[14px] leading-relaxed text-sbt-ink">“{reply.text}”</p><p className="mt-2 text-[12px] leading-relaxed text-sbt-dusk">{reply.why}</p><p className="mt-1 text-[11px] leading-relaxed text-sbt-mute">Tradeoff: {reply.tradeoff}</p></li>)}</ul><p className="sr-only" role="status" aria-live="polite">{copiedReply === null ? "" : "Reply copied to clipboard"}</p></div>
      <details className="rounded-sbt border border-sbt-linen bg-white/60 p-3"><summary className="cursor-pointer text-sm font-medium text-sbt-gold-700">See evidence, alternatives, and cautions</summary><div className="mt-3 space-y-3">
        <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">What is observable</p>{coach.observations.map((item) => <div key={item.quote} className="mt-2 text-[12.5px] text-sbt-dusk"><p>{item.observation}</p><p className="mt-1 border-l-2 border-sbt-gold/40 pl-2 italic text-sbt-mute">“{item.quote}”</p></div>)}</div>
        <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">Possible readings</p>{coach.possibleReadings.map((item) => <div key={item.title} className="mt-2"><p className="font-display text-[13px] text-sbt-ink">{item.title}</p><p className="text-[12px] leading-relaxed text-sbt-dusk">{item.explanation}</p></div>)}</div>
        <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">Your side of the pattern</p><p className="mt-1 text-[12px] leading-relaxed text-sbt-dusk">{coach.userContribution}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">What is still unknown</p><ul className="mt-1 list-disc pl-4 text-[12px] leading-relaxed text-sbt-dusk">{coach.missingContext.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">What would clarify the pattern</p>{coach.whatWouldClarify.map((item) => <div key={item.observe} className="mt-2 text-[12px] leading-relaxed text-sbt-dusk"><p>{item.observe}</p><p className="text-sbt-mute">How it updates the read: {item.wouldChange}</p></div>)}</div>
        {coach.avoid.length ? <div><p className="text-[10px] uppercase tracking-wider text-sbt-mute">Avoid</p><ul className="mt-1 list-disc pl-4 text-[12px] leading-relaxed text-sbt-dusk">{coach.avoid.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        <p className="text-[12px] leading-relaxed text-sbt-dusk">{coach.safetyNote}</p><p className="text-[11px] text-sbt-mute">Evidence strength: {coach.confidence.level} — {coach.confidence.why}</p>
      </div></details>
      <p className="text-[10px] uppercase tracking-wider text-sbt-mute">{result.provider} · {result.model} · quoted evidence checked before display</p>
      <a
        href="mailto:partnerslocalmaps@gmail.com?subject=Report%20an%20AnswerAce%20response"
        className="inline-flex min-h-11 items-center text-xs text-sbt-rose underline underline-offset-2"
      >
        Report this response
      </a>
    </div>
  );
}
