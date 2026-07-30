"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { analyze } from "@/lib/engine/analyze";
import { segment } from "@/lib/engine/segment";
import type { Analysis, CategoryId, ContextId, FamiliarityId } from "@/lib/engine/types";
import {
  CONTEXTS, CONTEXT_ORDER, FAMILIARITIES, FAMILIARITY_ORDER, resolveProfile,
} from "@/lib/engine/relationship";
import SubtextLogo from "@/components/SubtextLogo";
import { SAMPLES } from "@/lib/samples";
import {
  canAnalyse, FREE_LIMIT, isPaid, readUsage, recordAnalysis, remaining, type Usage,
} from "@/lib/usage";
import { config } from "@/lib/config";
import { requestDeepRead } from "@/lib/deepReadClient";
import type { DeepReadResult } from "@/lib/engine/deepRead";
import { withBase } from "@/lib/basePath";
import DeepReadCard from "@/components/DeepReadCard";
import DistressCard from "@/components/DistressCard";
import SegmentedTranscript from "@/components/SegmentedTranscript";
import Panel from "@/components/Panel";
import Interpretations from "@/components/Interpretations";
import CoachCard from "@/components/CoachCard";

type Phase = "intake" | "analyzing" | "result" | "distress";

export default function Home() {
  const [raw, setRaw] = useState("");
  const [context, setContext] = useState<ContextId>("dating");
  const [familiarity, setFamiliarity] = useState<FamiliarityId>("months");
  const [youName, setYouName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("intake");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [active, setActive] = useState<CategoryId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [blocked, setBlocked] = useState(false);

  // The AI-assisted tier. Deliberately NOT run automatically: the on-device
  // analysis is complete, and the deep read is the one action in this app
  // that sends text off the device, so it takes a deliberate press.
  const [deepState, setDeepState] = useState<"idle" | "running" | "done">("idle");
  const [deepResult, setDeepResult] = useState<DeepReadResult | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);

  useEffect(() => setUsage(readUsage()), []);

  useEffect(() => {
    // Configuration state only — no message text is ever sent to this endpoint.
    fetch(withBase("/api/capabilities"))
      .then((r) => r.json())
      .then((d) => {
        const llm = d?.capabilities?.llm;
        if (llm?.configured) setProviderLabel(llm.label as string);
      })
      .catch(() => setProviderLabel(null));
  }, []);

  // Live preview of the parse, so "which one is you?" is answerable up front.
  const preview = useMemo(() => (raw.trim() ? segment(raw) : null), [raw]);

  useEffect(() => {
    if (preview?.names.length && !preview.names.includes(youName ?? "")) {
      setYouName(preview.names[0]);
    }
  }, [preview, youName]);

  /**
   * WHICH SIDE IS THE USER — resolved at run time, never trusted from state.
   *
   * `youName` is set by an effect and survives a `reset()`, so a name chosen
   * for one paste could still be sitting in state when a different paste is
   * analysed. If it no longer matches any speaker in the CURRENT transcript
   * the whole read silently inverts: their formality is scored as yours, the
   * bids swap owners, and the app confidently describes the wrong person.
   * That is the worst failure this product has, so the name is re-derived
   * here against the transcript actually being read, and anything stale is
   * dropped in favour of the segmenter's own first-person heuristic.
   */
  function resolveYouName(): string | undefined {
    const names = preview?.names ?? [];
    if (!names.length) return undefined;
    if (youName && names.includes(youName)) return youName;
    return names.find((n) => /^(you|me|myself)$/i.test(n)) ?? names[0];
  }

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
      const result = analyze(raw, context, resolveYouName(), familiarity);
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
      setDeepState("idle");
      setDeepResult(null);
      setPhase("result");
    }, 900);
  }

  async function runDeepRead() {
    if (!analysis) return;
    setDeepState("running");
    const res = await requestDeepRead(raw, context, resolveYouName(), familiarity);
    setDeepResult(res);
    setDeepState("done");
  }

  function reset() {
    setPhase("intake");
    // Cleared deliberately: a "who is you" choice belongs to one transcript.
    setYouName(null);
    setAnalysis(null);
    setActive(null);
    setDeepState("idle");
    setDeepResult(null);
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
              {analysis.transcript.format} · reading{" "}
              <span className="text-sbt-dusk">
                {analysis.transcript.messages.find((m) => m.speaker === "you")?.name ?? "you"}
              </span>{" "}
              as you · {analysis.profile.contextLabel.toLowerCase()} · known{" "}
              {analysis.profile.familiarityLabel.toLowerCase()}
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

        {/* THE HEADLINE. Nine bars is not an answer; this is the answer. */}
        <section className="rounded-sbt border border-sbt-gold/30 bg-sbt-gold/[0.06] p-5">
          <p className="text-[10px] uppercase tracking-widest text-sbt-mute">the short version</p>
          <p className="mt-1.5 font-display text-[17px] leading-relaxed text-sbt-ink sm:text-[19px]">
            {analysis.headline}
          </p>
          {/* The weighting is shown, not hidden. A tuned read that will not
              say what it was tuned by is just an opinion with a percentage. */}
          <p className="mt-3 border-t border-sbt-gold/20 pt-2.5 text-[11.5px] leading-relaxed text-sbt-mute">
            Weighted for <span className="text-sbt-dusk">{analysis.profile.contextLabel.toLowerCase()}</span>,
            known <span className="text-sbt-dusk">{analysis.profile.familiarityLabel.toLowerCase()}</span> —
            expected register {Math.round(analysis.profile.expectedFormality * 100)}%, observed{" "}
            {Math.round(analysis.signals.themFormality * 100)}%.{" "}
            {analysis.profile.deviation < 1
              ? "Relational readings are held back at this length of history."
              : analysis.profile.deviation > 1
                ? "Departures from your usual register are scored at full weight."
                : "Standard weighting."}
          </p>
        </section>

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

            <DeepReadCard
              state={deepState}
              result={deepResult}
              locked={!paid}
              providerLabel={providerLabel}
              onRun={runDeepRead}
            />

            <section className="rounded-sbt border border-sbt-linen bg-sbt-linen/40 p-4">
              <h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">
                how each reading is produced
              </h3>
              <ul className="mt-2 space-y-1.5">
                {analysis.methodNotes.map((n: string) => (
                  <li key={n} className="text-[11px] leading-relaxed text-sbt-dusk">
                    · {n}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-sbt-mute">
                {analysis.engineVersion} · everything on this page: on-device
                {providerLabel ? ` · deep read available via ${providerLabel}` : " · no model provider configured"}
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
      <section className="pt-2 sm:pt-6">
        <SubtextLogo />
        <h1 className="mx-auto mt-7 max-w-2xl text-center font-display text-[26px] leading-tight text-sbt-ink sm:text-[34px]">
          Paste a conversation. See what the language is carrying.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] leading-relaxed text-sbt-dusk">
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

        {/* ── WHO IS THIS. The two inputs that retune the engine. ──
            Both are required to interpret anything: the same message means
            different things from a colleague and from a sibling, and it means
            different things again from a sibling you spoke to yesterday and
            one you have not written to properly in five years. */}
        <div className="mt-6 rounded-sbt border border-sbt-gold/25 bg-sbt-gold/[0.045] p-4">
          <p className="font-display text-[15px] text-sbt-ink">Who are you talking to?</p>
          <p className="mt-1 text-[12px] leading-relaxed text-sbt-mute">
            These two answers change how every signal below is weighted — not which words are
            looked for, but what their presence is allowed to mean.
          </p>

          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-sbt-mute">Relationship</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CONTEXT_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setContext(id)}
                  aria-pressed={context === id}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    context === id
                      ? "border-sbt-ink bg-sbt-ink text-sbt-paper"
                      : "border-sbt-linen bg-white/50 text-sbt-dusk hover:border-sbt-gold/60"
                  }`}
                >
                  {CONTEXTS[id].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-sbt-mute">
              {CONTEXTS[context].hint}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-sbt-mute">
              How long have you known this person?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {FAMILIARITY_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFamiliarity(id)}
                  aria-pressed={familiarity === id}
                  className={`rounded-sbt border px-2.5 py-2 text-[13px] leading-tight transition-colors ${
                    familiarity === id
                      ? "border-sbt-gold bg-sbt-gold/15 font-medium text-sbt-ink"
                      : "border-sbt-linen bg-white/50 text-sbt-dusk hover:border-sbt-gold/60"
                  }`}
                >
                  {FAMILIARITIES[id].label}
                </button>
              ))}
            </div>
          </div>

          {/* The resolved weighting, stated before the user presses the button.
              Nothing about this layer is hidden — that is the whole posture. */}
          <div className="mt-4 rounded-sbt border border-sbt-linen bg-sbt-paper px-3.5 py-3">
            <p className="text-[10px] uppercase tracking-widest text-sbt-mute">
              what that changes
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-sbt-dusk">
              {FAMILIARITIES[familiarity].note}
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-sbt-mute">
              Expected register for this pairing:{" "}
              <span className="text-sbt-dusk">
                {Math.round(resolveProfile(context, familiarity).expectedFormality * 100)}%
              </span>
              . Anything above that is scored as distance; anything at or below it is not.
              {resolveProfile(context, familiarity).pool.length
                ? ` Extra categories switched on: ${resolveProfile(context, familiarity)
                    .pool.map((c) => c.replace(/_/g, " "))
                    .join(", ")}.`
                : " No extra categories — universal core only."}
            </p>
          </div>
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
          Five real-shaped examples. No sign-up, no gate. The last one is the important one.
        </p>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setRaw(s.text);
                  setContext(s.context);
                  setFamiliarity(s.familiarity);
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
                  {s.triggersCare
                    ? "shows the care path"
                    : `${CONTEXTS[s.context].label.toLowerCase()} · known ${FAMILIARITIES[s.familiarity].label.toLowerCase()}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
