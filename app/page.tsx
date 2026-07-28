"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { analyze } from "@/lib/engine/analyze";
import { segment } from "@/lib/engine/segment";
import type { Analysis, CategoryId, ContextId } from "@/lib/engine/types";
import { SAMPLES } from "@/lib/samples";
import {
  canAnalyse, FREE_LIMIT, isPaid, readUsage, recordAnalysis, remaining, type Usage,
} from "@/lib/usage";
import { config } from "@/lib/config";
import DistressCard from "@/components/DistressCard";
import SegmentedTranscript from "@/components/SegmentedTranscript";
import Panel from "@/components/Panel";
import Interpretations from "@/components/Interpretations";
import CoachCard from "@/components/CoachCard";

type Phase = "intake" | "analyzing" | "result" | "distress";

const CONTEXTS: { id: ContextId; label: string }[] = [
  { id: "dating", label: "Dating" },
  { id: "work", label: "Work" },
  { id: "family", label: "Family" },
  { id: "friendship", label: "Friendship" },
  { id: "other", label: "Other" },
];

export default function Home() {
  const [raw, setRaw] = useState("");
  const [context, setContext] = useState<ContextId>("dating");
  const [youName, setYouName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("intake");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [active, setActive] = useState<CategoryId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => setUsage(readUsage()), []);

  // Live preview of the parse, so "which one is you?" is answerable up front.
  const preview = useMemo(() => (raw.trim() ? segment(raw) : null), [raw]);

  useEffect(() => {
    if (preview?.names.length && !preview.names.includes(youName ?? "")) {
      setYouName(preview.names[0]);
    }
  }, [preview, youName]);

  function run() {
    if (!raw.trim() || !usage) return;
    if (!canAnalyse(usage)) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    setPhase("analyzing");

    // A beat of deliberate slowness — this app never feels twitchy.
    window.setTimeout(() => {
      const result = analyze(raw, context, youName ?? undefined);
      if (result.kind === "distress") {
        // THE HARD RULE: no scores, and the free counter is NOT ticked.
        setAnalysis(null);
        setPhase("distress");
        return;
      }
      setAnalysis(result.analysis);
      setUsage(recordAnalysis());
      setActive(null);
      setShowAll(false);
      setPhase("result");
    }, 900);
  }

  function reset() {
    setPhase("intake");
    setAnalysis(null);
    setActive(null);
  }

  const paid = usage ? isPaid(usage) : false;
  const left = usage ? remaining(usage) : FREE_LIMIT;

  if (phase === "distress") return <DistressCard onBack={reset} />;

  if (phase === "analyzing") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-sbt-linen">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-sbt-gold" />
        </div>
        <p className="font-display text-lg italic text-sbt-mute">Reading the rhythm…</p>
      </div>
    );
  }

  if (phase === "result" && analysis) {
    return (
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-sbt-ink">The read</h1>
            <p className="mt-1 text-xs text-sbt-mute">
              {analysis.transcript.messages.length} messages · parsed as{" "}
              {analysis.transcript.format} · {context} context
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!paid && usage ? (
              <span className="text-xs text-sbt-mute">
                {left} of {FREE_LIMIT} free reads left this month
              </span>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="rounded-sbt border border-sbt-linen px-3 py-2 text-sm text-sbt-dusk transition-colors hover:border-sbt-mute"
            >
              New conversation
            </button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="order-2 lg:order-1">
            <div className="rounded-sbt border border-sbt-linen bg-sbt-paper p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg text-sbt-ink">The conversation</h2>
                {active ? (
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    className="text-xs text-sbt-gold-700 underline underline-offset-2"
                  >
                    clear highlight
                  </button>
                ) : (
                  <span className="text-[11px] text-sbt-mute">
                    tap a category to light up its lines
                  </span>
                )}
              </div>
              <SegmentedTranscript
                analysis={analysis}
                activeCategory={active}
                onFocusCategory={setActive}
                locked={!paid}
              />
              {!paid ? (
                <p className="mt-4 rounded-sbt bg-sbt-linen/60 px-3 py-2.5 text-[12px] leading-relaxed text-sbt-dusk">
                  The lines behind each score are marked, but the reasoning is blurred on Free.{" "}
                  <Link href="/plans" className="text-sbt-gold-700 underline underline-offset-2">
                    Premium
                  </Link>{" "}
                  shows the evidence for every category.
                </p>
              ) : null}
            </div>
          </div>

          <div className="order-1 space-y-5 lg:order-2">
            <Panel
              analysis={analysis}
              activeCategory={active}
              onSelect={setActive}
              showAll={showAll}
              onToggleAll={() => setShowAll((s) => !s)}
            />

            <Interpretations items={analysis.interpretations} />

            {analysis.whatWasntSaid.length ? (
              <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5">
                <h2 className="font-display text-lg text-sbt-ink">What wasn&rsquo;t said</h2>
                <ul className="mt-3 space-y-2">
                  {analysis.whatWasntSaid.map((w) => (
                    <li key={w} className="flex gap-2 text-[13.5px] leading-relaxed text-sbt-dusk">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sbt-gold" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <CoachCard suggestions={analysis.coach} locked={!paid} />

            <section className="rounded-sbt border border-sbt-linen bg-sbt-linen/40 p-4">
              <h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">
                how each reading is produced
              </h3>
              <ul className="mt-2 space-y-1.5">
                {analysis.mockNotes.map((n) => (
                  <li key={n} className="text-[11px] leading-relaxed text-sbt-dusk">
                    · {n}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-sbt-mute">
                {analysis.engineVersion} · llm mode: {config.llmMode}
              </p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ── INTAKE ──────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h1 className="font-display text-3xl leading-tight text-sbt-ink sm:text-4xl">
          Paste a conversation. See what the language is carrying.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-sbt-dusk">
          Subtext reads word choice and structure, shows you the exact lines behind every signal,
          and gives you the competing readings side by side — including the kindest one. It will
          never tell you someone lied, and it cannot diagnose anything.
        </p>
      </section>

      <section className="rounded-sbt border border-sbt-linen bg-white/70 p-5 shadow-soft">
        <label htmlFor="paste" className="font-display text-lg text-sbt-ink">
          The conversation
        </label>
        <p className="mt-1 text-[12px] text-sbt-mute">
          Works with a WhatsApp export, &ldquo;Name: message&rdquo; lines, or plain alternating
          lines. Nothing is uploaded and nothing is stored — this runs on your device.
        </p>

        <textarea
          id="paste"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={9}
          placeholder={"You: are we still on for thursday?\nSam: yeah maybe, this week is insane"}
          className="thin-scroll mt-3 w-full resize-y rounded-sbt border border-sbt-linen bg-sbt-paper px-4 py-3 font-body text-[15px] leading-relaxed text-sbt-ink outline-none transition-shadow placeholder:text-sbt-mute/60 focus:ring-2 focus:ring-sbt-gold/30"
        />

        {preview && preview.names.length > 1 ? (
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-sbt-mute">Which one is you?</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {preview.names.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setYouName(n)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    youName === n
                      ? "border-sbt-gold bg-sbt-gold/10 text-sbt-gold-700"
                      : "border-sbt-linen text-sbt-dusk hover:border-sbt-mute"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-sbt-mute">Context</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CONTEXTS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setContext(c.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  context === c.id
                    ? "border-sbt-ink bg-sbt-ink text-sbt-paper"
                    : "border-sbt-linen text-sbt-dusk hover:border-sbt-mute"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-sbt-mute">
            Context adds a small pool of extra categories to the universal core. The map is a fixed
            config — the model never chooses what to measure.
          </p>
        </div>

        {blocked ? (
          <div className="mt-4 rounded-sbt border border-sbt-gold/40 bg-sbt-gold/[0.07] p-4">
            <p className="font-display text-[15px] text-sbt-ink">
              You&rsquo;ve used your {FREE_LIMIT} free reads this month.
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-sbt-dusk">
              Every analysis costs a real model call, so the free tier is capped rather than
              throttled. Premium is unlimited and unlocks the evidence behind every score.
            </p>
            <Link
              href="/plans"
              className="mt-3 inline-block rounded-sbt bg-sbt-gold px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sbt-gold-700"
            >
              See plans
            </Link>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!raw.trim()}
            className="rounded-sbt bg-sbt-gold px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-sbt-gold-700 disabled:opacity-40"
          >
            Read this conversation
          </button>
          {usage ? (
            <p className="text-xs text-sbt-mute">
              {paid
                ? "Premium · unlimited reads"
                : `${left} of ${FREE_LIMIT} free reads left this month`}
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-sbt-ink">See it in action</h2>
        <p className="mt-1 text-[13px] text-sbt-mute">
          Four real-shaped examples. No sign-up, no gate. The last one is the important one.
        </p>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setRaw(s.text);
                  setContext(s.context);
                  setYouName(s.youName);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`h-full w-full rounded-sbt border p-4 text-left transition-colors ${
                  s.triggersCare
                    ? "border-sbt-rose/30 bg-sbt-rose/[0.05] hover:border-sbt-rose/60"
                    : "border-sbt-linen bg-white/60 hover:border-sbt-gold/50"
                }`}
              >
                <p className="font-display text-[15px] text-sbt-ink">{s.label}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-sbt-dusk">{s.blurb}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wider text-sbt-mute">
                  {s.triggersCare ? "shows the care path" : `${s.context} context`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
