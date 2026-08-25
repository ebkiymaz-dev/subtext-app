"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { analyze } from "@/lib/engine/analyze";
import { segment } from "@/lib/engine/segment";
import type { Analysis, CategoryId, ContextId, DistressResult, FamiliarityId } from "@/lib/engine/types";
import {
  CONTEXTS, CONTEXT_ORDER, FAMILIARITIES, FAMILIARITY_ORDER,
} from "@/lib/engine/relationship";
import SubtextLogo from "@/components/SubtextLogo";
import { SAMPLES } from "@/lib/samples";
import { readUsage, recordAnalysis, type Usage } from "@/lib/usage";
import DistressCard from "@/components/DistressCard";
import SegmentedTranscript from "@/components/SegmentedTranscript";
import Panel from "@/components/Panel";
import Interpretations from "@/components/Interpretations";
import CoachCard from "@/components/CoachCard";
import {
  PLAY_BILLING_EVENT,
  readPlayEntitlementProof,
  readPlayBillingState,
  requestPlayPurchase,
  stateFromBillingEvent,
  type PlayBillingState,
} from "@/lib/playBilling";
import { requestPersonalizedCoach } from "@/lib/answerCoachClient";
import {
  COACH_GOALS, COACH_TONES,
  type CoachGoalId, type CoachToneId, type PersonalizedCoachResult,
} from "@/lib/engine/answerCoach";
import { recordProductEvent } from "@/lib/product-events";
import {
  OCR_LANGUAGE_OPTIONS,
  readChatScreenshot,
  type OcrLanguage,
} from "@/lib/screenshot-ocr";
import {
  activeParticipants,
  assignedName,
  availableParticipants,
  focusedTranscript,
  participantStats,
  type ExcludedMessages,
  type SpeakerAssignments,
} from "@/lib/group-chat";
import {
  createLocalProfile,
  readLocalProfile,
  saveArchivedConversation,
  type LocalProfile,
} from "@/lib/archive";
import { clearActiveRead, keepActiveRead, readActiveRead } from "@/lib/active-read";

type Phase = "intake" | "analyzing" | "result" | "distress";

const CONTEXT_PLACEHOLDERS: Record<ContextId, string> = {
  partner: "Paste the conversation with your partner here…",
  dating: "Paste their last text here…",
  friendship: "Paste the text you keep rereading here…",
  family: "Paste the family message you want help reading here…",
  work: "Paste that passive-aggressive email from your manager here…",
  roommate: "Paste the message about the dishes, rent, or boundaries here…",
  ex_partner: "Paste the 2 AM message here…",
  business: "Paste the negotiation message here…",
  marketplace: "Paste the Amazon, marketplace, buyer, or seller conversation here…",
  neighbor: "Paste the message from your neighbour here…",
  stranger: "Paste the conversation with the person you do not know here…",
  other: "Paste the conversation you want help reading here…",
};

const SPEAKER_COLOURS = [
  "border-emerald-200 bg-emerald-50 text-emerald-900",
  "border-sky-200 bg-sky-50 text-sky-900",
  "border-violet-200 bg-violet-50 text-violet-900",
  "border-amber-200 bg-amber-50 text-amber-900",
  "border-rose-200 bg-rose-50 text-rose-900",
  "border-cyan-200 bg-cyan-50 text-cyan-900",
  "border-lime-200 bg-lime-50 text-lime-900",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
] as const;

export default function Home() {
  const [raw, setRaw] = useState("");
  const [context, setContext] = useState<ContextId>("dating");
  const [familiarity, setFamiliarity] = useState<FamiliarityId>("months");
  const [contextConfirmed, setContextConfirmed] = useState(false);
  const [familiarityConfirmed, setFamiliarityConfirmed] = useState(false);
  const [youName, setYouName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("intake");
  const [distressMode, setDistressMode] = useState<DistressResult["mode"]>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [active, setActive] = useState<CategoryId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [billing, setBilling] = useState<PlayBillingState>({
    android: false,
    status: "loading",
    entitled: false,
  });
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [speakerAssignments, setSpeakerAssignments] = useState<SpeakerAssignments>({});
  const [excludedMessages, setExcludedMessages] = useState<ExcludedMessages>({});
  const [customParticipants, setCustomParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [focusName, setFocusName] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [ocrState, setOcrState] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>("auto");
  const [ocrSpeakersConfirmed, setOcrSpeakersConfirmed] = useState(true);
  const screenshotInput = useRef<HTMLInputElement>(null);
  const [localProfile, setLocalProfile] = useState<LocalProfile | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  const [coachGoal, setCoachGoal] = useState<CoachGoalId>("understand");
  const [coachTone, setCoachTone] = useState<CoachToneId>("direct");
  const [coachStakes, setCoachStakes] = useState("");
  const [coachState, setCoachState] = useState<"idle" | "running" | "done">("idle");
  const [coachResult, setCoachResult] = useState<PersonalizedCoachResult | null>(null);
  const [resolutionMarked, setResolutionMarked] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "failed">("idle");

  useEffect(() => {
    setUsage(readUsage());
    setBilling(readPlayBillingState());
    setLocalProfile(readLocalProfile());

    const activeRead = readActiveRead();
    if (activeRead) {
      setRaw(activeRead.raw);
      setContext(activeRead.context);
      setFamiliarity(activeRead.familiarity);
      setContextConfirmed(true);
      setFamiliarityConfirmed(true);
      setYouName(activeRead.youName);
      setFocusName(activeRead.focusName);
      setOtherName(activeRead.otherName);
      setSpeakerAssignments(activeRead.speakerAssignments);
      setExcludedMessages(activeRead.excludedMessages);
      setCustomParticipants(activeRead.customParticipants);
      setAnalysis(activeRead.analysis);
      setPhase("result");
    }

    const onBilling = (event: Event) => {
      const next = stateFromBillingEvent(event);
      if (next) setBilling(next);
    };
    window.addEventListener(PLAY_BILLING_EVENT, onBilling);
    return () => window.removeEventListener(PLAY_BILLING_EVENT, onBilling);
  }, []);

  // Live preview of the parse, so "which one is you?" is answerable up front.
  const preview = useMemo(() => (raw.trim() ? segment(raw) : null), [raw]);
  const unsupportedAnalysisLanguage = useMemo(() => {
    const messageText = preview?.messages.map((message) => message.text).join(" ") ?? "";
    return (messageText.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Thai}]/gu)?.length ?? 0) >= 2;
  }, [preview]);
  const participantNames = useMemo(
    () => activeParticipants(preview, speakerAssignments, excludedMessages),
    [preview, speakerAssignments, excludedMessages]
  );
  const availableNames = useMemo(
    () => availableParticipants(preview, speakerAssignments, customParticipants),
    [preview, speakerAssignments, customParticipants]
  );
  const groupStats = useMemo(
    () => participantStats(preview, speakerAssignments, excludedMessages),
    [preview, speakerAssignments, excludedMessages]
  );

  useEffect(() => {
    if (participantNames.length && !participantNames.includes(youName ?? "")) {
      setYouName(participantNames.find((name) => /^(you|me|myself)$/i.test(name)) ?? participantNames[0]);
    }
  }, [participantNames, youName]);

  useEffect(() => {
    const choices = participantNames.filter((name) => name !== youName);
    if (!focusName || !choices.includes(focusName)) setFocusName(choices[0] ?? null);
  }, [participantNames, youName, focusName]);

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
    const names = participantNames;
    if (!names.length) return undefined;
    if (youName && names.includes(youName)) return youName;
    return names.find((n) => /^(you|me|myself)$/i.test(n)) ?? names[0];
  }

  function resolveFocusName(): string | undefined {
    const selectedYou = resolveYouName();
    const choices = participantNames.filter((name) => name !== selectedYou);
    if (focusName && choices.includes(focusName)) return focusName;
    return choices[0];
  }

  function preparedTranscript(): string {
    if (!preview?.messages.length) return raw;
    const selectedYou = resolveYouName();
    const selectedOther = resolveFocusName();
    if (!selectedYou || !selectedOther) return raw;
    const genericSide = (name?: string) => name === "Left side" || name === "Right side";
    const yourDisplayName = localProfile?.name || (genericSide(selectedYou) ? "You" : selectedYou) || "You";
    const directChat = participantNames.length <= 2;
    const otherDisplayName = directChat && otherName.trim()
      ? otherName.trim()
      : genericSide(selectedOther) ? "Other person" : selectedOther;
    return focusedTranscript(
      preview,
      speakerAssignments,
      excludedMessages,
      selectedYou,
      selectedOther,
      yourDisplayName,
      otherDisplayName
    );
  }

  function preparedYouName(): string | undefined {
    const selected = resolveYouName();
    if (localProfile?.name) return localProfile.name;
    return selected === "Left side" || selected === "Right side" ? "You" : selected;
  }

  async function importScreenshot(file: File) {
    if (!file.type.startsWith("image/")) {
      setOcrState("error");
      setOcrMessage("Choose a PNG, JPG, WEBP, or another image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setOcrState("error");
      setOcrMessage("That screenshot is over 10 MB. Crop or compress it, then try again.");
      if (screenshotInput.current) screenshotInput.current.value = "";
      return;
    }
    setOcrState("reading");
    setOcrProgress(0);
    setOcrMessage("Preparing private screenshot reader…");
    setSpeakerAssignments({});
    setExcludedMessages({});
    setCustomParticipants([]);
    setFocusName(null);
    setOcrSpeakersConfirmed(false);
    try {
      const result = await readChatScreenshot(file, ({ status, progress }) => {
        setOcrProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
        setOcrMessage(status === "recognizing text" ? "Reading chat bubbles on this device…" : "Preparing screenshot reader…");
      }, ocrLanguage);
      setRaw(result.transcript);
      setYouName(result.participants.includes("You") ? "You" : null);
      setOtherName("");
      setOcrState("done");
      setOcrMessage(
        `${result.messageCount} chat bubble${result.messageCount === 1 ? "" : "s"} and ${result.participantCount} possible participant${result.participantCount === 1 ? "" : "s"} found. Names are estimates—confirm every speaker before reading.`
      );
      setParseWarning(null);
      setRunError(null);
      recordProductEvent("screenshot_imported");
    } catch (error) {
      console.error("Subtext screenshot OCR failed", error);
      setOcrState("error");
      setOcrMessage(error instanceof Error && error.message === "SCREENSHOT_TOO_LARGE"
        ? "That screenshot is too large to read safely. Crop it into smaller conversation sections and try again."
        : "I could not separate chat bubbles in that screenshot. Crop out the phone header and try a clearer image.");
    } finally {
      if (screenshotInput.current) screenshotInput.current.value = "";
    }
  }

  function run() {
    if (!raw.trim()) return;
    // Mobile restores and slow devices can receive a tap before the mount
    // effect has populated state. Never turn that valid tap into a silent
    // no-op: read the small local counter synchronously as a fallback.
    if (!usage) setUsage(readUsage());
    if (!contextConfirmed || !familiarityConfirmed) {
      setParseWarning("Choose the relationship and how long you have known them before reading. Subtext will not guess this context.");
      return;
    }
    if ((ocrState === "done" || preview?.format === "alternating") && !ocrSpeakersConfirmed) {
      setParseWarning("Confirm who wrote each message before reading. Subtext will not guess uncertain speakers.");
      return;
    }
    if (unsupportedAnalysisLanguage) {
      setParseWarning("Subtext can separate names and speakers in many scripts, but its language-pattern analysis is currently validated only for English messages. Review the transcript here; English analysis remains unavailable for this paste.");
      return;
    }
    if (preview && participantNames.length > 1 && !resolveFocusName()) {
      setParseWarning("Choose which participant you want Subtext to read in relation to you.");
      return;
    }
    setParseWarning(null);
    setRunError(null);
    recordProductEvent("analysis_started");
    setPhase("analyzing");

    // A beat of deliberate slowness — this app never feels twitchy.
    window.setTimeout(() => {
      try {
        const input = preparedTranscript();
        const result = analyze(input, context, preparedYouName(), familiarity);
        if (result.kind === "distress") {
          // THE HARD RULE: no scores, and the free counter is NOT ticked.
          setAnalysis(null);
          setDistressMode(result.distress.mode);
          recordProductEvent("distress_guard_shown");
          setPhase("distress");
          return;
        }
        setAnalysis(result.analysis);
        keepActiveRead({
          raw,
          context,
          familiarity,
          youName: resolveYouName() ?? null,
          focusName: resolveFocusName() ?? null,
          otherName,
          speakerAssignments: { ...speakerAssignments },
          excludedMessages: { ...excludedMessages },
          customParticipants: [...customParticipants],
          analysis: result.analysis,
        });
        recordProductEvent("analysis_completed");
        setUsage(recordAnalysis());
        setActive(null);
        setShowAll(false);
        setCoachState("idle");
        setCoachResult(null);
        setPhase("result");
      } catch (error) {
        // Do not log the pasted conversation. A safe diagnostic is enough.
        console.error("Subtext local analysis failed", error);
        recordProductEvent("analysis_failed");
        setAnalysis(null);
        setRunError(
          "Subtext could not read that paste on this device. Your text stayed private. Try the included example below; if that works, shorten the paste or remove export headers and try again."
        );
        setPhase("intake");
      }
    }, 900);
  }

  async function runAnswerCoach() {
    if (!analysis) return;
    const entitlement = readPlayEntitlementProof();
    if (!entitlement) {
      setCoachResult({ ok: false, reason: "Restore the active Google Play subscription, then try again." });
      setCoachState("done");
      return;
    }
    setCoachState("running");
    const result = await requestPersonalizedCoach({
      text: preparedTranscript(), context, familiarity, youName: preparedYouName(),
      goal: coachGoal, tone: coachTone, stakes: coachStakes, entitlement,
    });
    setCoachResult(result);
    setCoachState("done");
  }

  function reset() {
    clearActiveRead();
    setPhase("intake");
    setDistressMode(null);
    setRaw("");
    setYouName(null);
    setFocusName(null);
    setOtherName("");
    setSpeakerAssignments({});
    setExcludedMessages({});
    setCustomParticipants([]);
    setOcrState("idle");
    setOcrProgress(0);
    setOcrMessage(null);
    setOcrSpeakersConfirmed(true);
    if (screenshotInput.current) screenshotInput.current.value = "";
    setAnalysis(null);
    setActive(null);
    setCoachState("idle");
    setCoachResult(null);
    setContextConfirmed(false);
    setFamiliarityConfirmed(false);
    setRunError(null);
    setShareState("idle");
    setSaveState("idle");
    setResolutionMarked(false);
  }

  function loadSample(sample: (typeof SAMPLES)[number]) {
    clearActiveRead();
    setRaw(sample.text);
    setContext(sample.context);
    setFamiliarity(sample.familiarity);
    setContextConfirmed(true);
    setFamiliarityConfirmed(true);
    setYouName(sample.youName);
    setSpeakerAssignments({});
    setExcludedMessages({});
    setCustomParticipants([]);
    setFocusName(null);
    setOtherName("");
    setOcrState("idle");
    setOcrSpeakersConfirmed(true);
    setOcrMessage(null);
    setParseWarning(null);
    setRunError(null);
    setAnalysis(null);
    setPhase("intake");
    recordProductEvent("sample_loaded");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveCurrentRead(profile: LocalProfile) {
    if (!analysis) return;
    const themSpeaker = analysis.transcript.messages.find((message) => message.speaker === "them")?.name ?? "Other person";
    saveArchivedConversation(profile, {
      title: `${analysis.profile.contextLabel} read · ${themSpeaker}`,
      otherName: themSpeaker,
      raw: preparedTranscript(),
      context,
      familiarity,
      headline: analysis.headline,
      categories: analysis.categories.map(({ id, label, percent, read }) => ({ id, label, percent, read })),
    });
    recordProductEvent("conversation_archived");
    setSaveState("saved");
  }

  function saveToPrivateArchive() {
    try {
      const profile = localProfile ?? createLocalProfile("Private archive");
      if (!localProfile) setLocalProfile(profile);
      saveCurrentRead(profile);
    } catch {
      setSaveState("error");
    }
  }

  async function shareRead() {
    if (!analysis) return;
    const leadingReads = analysis.interpretations
      .slice(0, 2)
      .map((item) => `• ${item.title}`)
      .join("\n");
    const text = [
      "Subtext read",
      analysis.headline,
      leadingReads ? `\nOther possible explanations:\n${leadingReads}` : "",
      "\nGenerated on-device from language patterns. This does not determine intent or diagnose a person.",
    ].filter(Boolean).join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: "My Subtext read", text });
        recordProductEvent("read_shared");
        setShareState("shared");
      } else {
        await navigator.clipboard.writeText(text);
        recordProductEvent("read_shared");
        setShareState("copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareState("failed");
    }
  }

  // Standard reads and evidence stay free; only Answer Coach is a paid extra.
  const unlocked = true;
  const coachUnlocked = billing.entitled;

  if (phase === "distress") return <DistressCard onBack={reset} mode={distressMode} />;

  if (phase === "analyzing") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-sbt-linen">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-sbt-gold" />
        </div>
        <p className="font-display text-lg italic text-sbt-mute">Reading the rhythm…</p>
      </div>
    );
  }

  if (phase === "result" && analysis) {
    const youSpeaker = analysis.transcript.messages.find((m) => m.speaker === "you")?.name ?? "You";
    const themSpeaker = analysis.transcript.messages.find((m) => m.speaker === "them")?.name ?? "The other person";
    return (
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-sbt-ink">Your read</h1>
            <p className="mt-1 text-xs text-sbt-mute">{youSpeaker} and {themSpeaker} · {analysis.transcript.messages.length} messages</p>
          </div>
          <div>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 rounded-sbt px-3 py-2 text-sm text-sbt-mute underline decoration-sbt-linen underline-offset-4 transition-colors hover:text-sbt-ink"
            >
              New conversation
            </button>
          </div>
        </header>

        {/* The answer comes before every secondary action. This is the user's
            first moment of value and must not be buried under controls. */}
        <section className="rounded-sbt border border-sbt-gold/30 bg-sbt-gold/[0.06] p-5">
          <p className="text-[10px] uppercase tracking-widest text-sbt-mute">the short version</p>
          <p className="mt-1.5 font-display text-[17px] leading-relaxed text-sbt-ink sm:text-[19px]">
            {analysis.headline}
          </p>
          <details className="mt-3 border-t border-sbt-gold/20 pt-2.5 text-[11.5px] text-sbt-mute">
            <summary className="cursor-pointer">Why relationship context changes this read</summary>
            <p className="mt-2 leading-relaxed">
              Weighted for <span className="text-sbt-dusk">{analysis.profile.contextLabel.toLowerCase()}</span>,
              known <span className="text-sbt-dusk">{analysis.profile.familiarityLabel.toLowerCase()}</span>. The exchange is compared with the level of formality normally expected in that setting—not with a universal relationship standard.
            </p>
          </details>
        </section>

        {groupStats.length > 2 ? (
          <section className="rounded-sbt border border-sbt-gold/30 bg-sbt-gold/[0.05] p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-sbt-mute">Group overview</p>
                <h2 className="mt-1 font-display text-xl text-sbt-ink">Every participant stays separate</h2>
              </div>
              <p className="text-xs text-sbt-mute">Detailed read: {themSpeaker}</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {groupStats.map((participant, index) => (
                <div key={participant.name} className={`rounded-sbt border p-3 ${SPEAKER_COLOURS[index % SPEAKER_COLOURS.length]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{participant.name}{participant.name === youSpeaker ? " (you)" : ""}</p>
                    <p className="text-xs font-semibold">{participant.share}%</p>
                  </div>
                  <p className="mt-1 text-[11px] opacity-75">{participant.messages} messages · {participant.words} words</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div className="h-full rounded-full bg-current/60" style={{ width: `${participant.share}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-sbt-mute">
              Participation share is descriptive, not a judgment. Relational evidence below uses only {youSpeaker} and {themSpeaker}; messages from other participants are not attributed to either person.
            </p>
          </section>
        ) : null}

        <Interpretations items={analysis.interpretations} />

        <section aria-label="Read actions" className="rounded-sbt border border-sbt-linen bg-white/60 p-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              disabled={saveState === "saved"}
              onClick={saveToPrivateArchive}
              className="min-h-11 rounded-sbt border-2 border-sbt-gold/55 bg-sbt-gold/[0.10] px-3 py-2 text-sm font-semibold text-sbt-gold-700 disabled:border-emerald-300 disabled:bg-emerald-50 disabled:text-emerald-800"
            >
              {saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Try saving again" : "Save to archive"}
            </button>
            <button type="button" onClick={shareRead} className="min-h-11 rounded-sbt border border-sbt-linen px-3 py-2 text-sm text-sbt-dusk">
              {shareState === "shared" ? "Shared" : shareState === "copied" ? "Copied" : "Share read"}
            </button>
            <button type="button" disabled={resolutionMarked} onClick={() => setResolutionMarked(true)} className="col-span-2 min-h-11 rounded-sbt border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 disabled:opacity-60">
              {resolutionMarked ? "Marked complete ✓" : "Done with this read"}
            </button>
          </div>
          {shareState === "failed" ? (
            <p role="status" className="mt-2 text-xs text-sbt-mute">
              Sharing was unavailable on this device. Your conversation was not included or uploaded.
            </p>
          ) : null}
          {saveState === "error" ? (
            <p role="alert" className="mt-2 text-xs text-sbt-rose">
              This device could not save the archive, usually because private storage is unavailable or full. Nothing was uploaded.
            </p>
          ) : null}
        </section>

        <CoachCard
          locked={!coachUnlocked}
          state={coachState}
          result={coachResult}
          goal={coachGoal}
          onUnlock={billing.android ? () => requestPlayPurchase() : undefined}
          onRun={runAnswerCoach}
        />

        <details className="rounded-sbt border border-sbt-linen bg-white/50 p-3 sm:p-4">
          <summary className="cursor-pointer font-display text-[15px] text-sbt-gold-700">See conversation evidence and full analysis</summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
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
                locked={!unlocked}
              />
              {!unlocked ? (
                <p className="mt-4 rounded-sbt bg-sbt-linen/60 px-3 py-2.5 text-[12px] leading-relaxed text-sbt-dusk">
                  The lines behind each pattern are marked, but the reasoning is blurred on Free.{" "}
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
                youName={youSpeaker}
                themName={themSpeaker}
              activeCategory={active}
              onSelect={setActive}
              showAll={showAll}
              onToggleAll={() => setShowAll((s) => !s)}
            />

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

            <details className="rounded-sbt border border-sbt-linen bg-sbt-linen/30 p-4">
              <summary className="cursor-pointer text-xs text-sbt-mute">How this read was calculated</summary>
              <ul className="mt-2 space-y-1.5">
                {analysis.methodNotes.map((n: string) => (
                  <li key={n} className="text-[11px] leading-relaxed text-sbt-dusk">
                    · {n}
                  </li>
                ))}
              </ul>
            </details>

          </div>
        </div>
        </details>
      </div>
    );
  }

  // ── INTAKE ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <section className="pt-1 sm:pt-6">
        <div className="hidden sm:block">
          <SubtextLogo />
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-sbt-gold-700 sm:hidden">
          Private conversation reader
        </p>
        <h1 className="mt-2 max-w-2xl text-left font-display text-[24px] leading-tight text-sbt-ink sm:mx-auto sm:mt-7 sm:text-center sm:text-[34px]">
          Paste a conversation or upload a screenshot.
        </h1>
        <p className="mt-2 max-w-2xl text-left text-[14px] leading-relaxed text-sbt-dusk sm:mx-auto sm:mt-3 sm:text-center sm:text-[15px]">
          Add the conversation. Subtext separates the speakers and explains the patterns in plain language.
        </p>
      </section>

      <section className="rounded-sbt border border-sbt-linen bg-white/70 p-4 shadow-soft sm:p-5">
        <label htmlFor="paste" className="font-display text-xl text-sbt-ink">Add your conversation</label>
        <textarea
          id="paste"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setSpeakerAssignments({});
            setExcludedMessages({});
            setCustomParticipants([]);
            setFocusName(null);
            setOcrState("idle");
            setOcrSpeakersConfirmed(false);
            setOcrMessage(null);
            setParseWarning(null);
            setRunError(null);
          }}
          rows={7}
          maxLength={12_000}
          placeholder={CONTEXT_PLACEHOLDERS[contextConfirmed ? context : "other"]}
          className="thin-scroll mt-3 w-full resize-y rounded-sbt border border-sbt-linen bg-sbt-paper px-4 py-3 font-body text-[15px] leading-relaxed text-sbt-ink outline-none transition-shadow placeholder:text-sbt-mute/60 focus:ring-2 focus:ring-sbt-gold/30"
        />

        <p className="mt-1 text-right text-[10px] text-sbt-mute" aria-live="polite">
          {raw.length.toLocaleString()} / 12,000 characters
        </p>

        <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-900">
          <span aria-hidden="true">🔒</span>
          <span><strong>Private by default.</strong> The free read stays on this device and nothing is saved unless you archive it. Answer Coach sends text only when you explicitly request coaching.</span>
        </div>

        {!raw.trim() ? (
          <button
            type="button"
            onClick={() => loadSample(SAMPLES[0])}
            className="mt-3 min-h-11 rounded-sbt border border-sbt-gold/35 bg-sbt-gold/[0.05] px-3 py-2 text-sm font-medium text-sbt-gold-700 transition-colors hover:bg-sbt-gold/[0.12]"
          >
            Not ready to paste? Try a sample conversation
          </button>
        ) : null}

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <input
              ref={screenshotInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importScreenshot(file);
              }}
            />
            <button
              type="button"
              disabled={ocrState === "reading"}
              onClick={() => screenshotInput.current?.click()}
              className="min-h-11 flex-1 rounded-sbt border-2 border-sbt-gold/45 bg-sbt-gold/[0.08] px-3 py-2 text-sm font-semibold text-sbt-gold-700 transition-colors hover:bg-sbt-gold/[0.16] disabled:opacity-50"
            >
              {ocrState === "reading" ? "Reading screenshot…" : "▧ Upload a screenshot instead"}
            </button>
          </div>
          <details className="mt-2 text-[11px] text-sbt-mute">
            <summary className="cursor-pointer">
              Language: {ocrLanguage === "auto" ? "Automatic" : OCR_LANGUAGE_OPTIONS.find((option) => option.value === ocrLanguage)?.label}
            </summary>
            <label className="mt-2 block text-[11px] uppercase tracking-wider text-sbt-mute" htmlFor="screenshot-language">Choose language</label>
            <select
              id="screenshot-language"
              value={ocrLanguage}
              disabled={ocrState === "reading"}
              onChange={(event) => setOcrLanguage(event.target.value as OcrLanguage)}
              className="mt-1.5 min-h-10 w-full rounded-sbt border border-sbt-linen bg-sbt-paper px-3 text-sm text-sbt-ink outline-none focus:ring-2 focus:ring-sbt-gold/30 sm:max-w-md"
            >
              {OCR_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="mt-1">Automatic covers English, Chinese, Japanese, and Russian. Choosing one language is faster.</p>
          </details>
        </div>

        {ocrMessage ? (
          <div className={`mt-3 rounded-sbt border px-3 py-2.5 text-xs leading-relaxed ${ocrState === "error" ? "border-sbt-rose/30 bg-sbt-rose/[0.06] text-sbt-dusk" : "border-sbt-gold/25 bg-sbt-gold/[0.05] text-sbt-dusk"}`}>
            <p>{ocrMessage}</p>
            {ocrState === "reading" ? (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-sbt-linen"
                role="progressbar"
                aria-label="Screenshot reading progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={ocrProgress}
              >
                <div className="h-full rounded-full bg-sbt-gold transition-[width]" style={{ width: `${ocrProgress}%` }} />
              </div>
            ) : null}
            <p className="mt-1 text-[10px] text-sbt-mute">The OCR model may download once; your screenshot itself is not uploaded.</p>
          </div>
        ) : null}

        {preview && participantNames.length > 1 ? (
          <div className="mt-4">
            <p className="text-[12px] font-medium text-sbt-dusk">I am:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {participantNames.map((n, index) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setYouName(n)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    youName === n
                      ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                      : SPEAKER_COLOURS[index % SPEAKER_COLOURS.length]
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {participantNames.length > 2 ? (
              <div className="mt-4 rounded-sbt border border-sbt-gold/25 bg-sbt-gold/[0.05] p-3">
                <p className="text-[12px] font-medium text-sbt-dusk">Read this person:</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {participantNames.filter((name) => name !== resolveYouName()).map((name, index) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setFocusName(name)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        focusName === name
                          ? "border-sbt-gold bg-sbt-gold/20 font-medium text-sbt-ink"
                          : SPEAKER_COLOURS[(index + 1) % SPEAKER_COLOURS.length]
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <label className="mt-3 block text-[11px] uppercase tracking-wider text-sbt-mute" htmlFor="other-person-name">
                  Other person&apos;s name <span className="normal-case tracking-normal">(optional, used in the read)</span>
                </label>
                <input
                  id="other-person-name"
                  value={otherName}
                  onChange={(event) => setOtherName(event.target.value)}
                  placeholder="For example: Jordan"
                  className="mt-1.5 w-full rounded-sbt border border-sbt-linen bg-sbt-paper px-3 py-2.5 text-sm text-sbt-ink outline-none focus:ring-2 focus:ring-sbt-gold/30 sm:max-w-sm"
                />
              </>
            )}
          </div>
        ) : null}

        {preview && (preview.format === "alternating" || ocrState === "done" || participantNames.length > 2) ? (
          <details open={ocrState === "done" ? true : undefined} className="mt-3 rounded-sbt border border-sbt-linen bg-sbt-paper/70 p-3">
            <summary className="cursor-pointer text-xs font-medium text-sbt-dusk">
              Review detected speakers <span className="font-normal text-sbt-mute">— reassign or remove any wrong line</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2 rounded-sbt border border-sbt-linen bg-white/60 p-2 sm:flex-row">
              <input
                value={newParticipant}
                onChange={(event) => setNewParticipant(event.target.value)}
                placeholder="Add a missing participant name"
                className="min-h-10 flex-1 rounded-sbt border border-sbt-linen bg-sbt-paper px-3 text-xs text-sbt-ink outline-none focus:ring-2 focus:ring-sbt-gold/30"
              />
              <button
                type="button"
                disabled={!newParticipant.trim()}
                onClick={() => {
                  const name = newParticipant.trim();
                  if (name && !availableNames.includes(name)) setCustomParticipants((current) => [...current, name]);
                  setNewParticipant("");
                  setOcrSpeakersConfirmed(false);
                }}
                className="rounded-sbt border border-sbt-gold/40 px-3 py-2 text-xs font-medium text-sbt-gold-700 disabled:opacity-40"
              >
                Add participant
              </button>
            </div>
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {preview.messages.map((message) => {
                const speaker = assignedName(message, speakerAssignments);
                const colourIndex = Math.max(0, availableNames.indexOf(speaker)) % SPEAKER_COLOURS.length;
                const removed = Boolean(excludedMessages[message.id]);
                return (
                  <li key={message.id} className={`flex ${speaker === resolveYouName() ? "justify-end" : "justify-start"} ${removed ? "opacity-45" : ""}`}>
                    <div className={`max-w-[94%] rounded-sbt border px-3 py-2 text-left text-xs leading-relaxed ${SPEAKER_COLOURS[colourIndex]}`}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <select
                          aria-label={`Speaker for message ${message.index + 1}`}
                          value={speaker}
                          disabled={removed}
                          onChange={(event) => {
                            setSpeakerAssignments((current) => ({ ...current, [message.id]: event.target.value }));
                            setOcrSpeakersConfirmed(false);
                          }}
                          className="min-h-8 max-w-[12rem] rounded-full border border-current/20 bg-white/70 px-2 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {availableNames.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setExcludedMessages((current) => ({ ...current, [message.id]: !current[message.id] }));
                            setOcrSpeakersConfirmed(false);
                          }}
                          className="min-h-8 rounded-full border border-current/20 bg-white/70 px-2 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {removed ? "Restore" : "Not a message"}
                        </button>
                      </div>
                      <span className={removed ? "line-through" : ""}>{message.text}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {ocrState === "done" || preview.format === "alternating" ? (
              <div className="mt-3 rounded-sbt border border-sbt-gold/30 bg-white/70 p-3">
                <p className="text-xs leading-relaxed text-sbt-dusk">
                  Check each name above. Add a missing person, then use the name menu on any message that is wrong. Bare pasted lines are never assumed to alternate correctly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOcrSpeakersConfirmed(true);
                    setParseWarning(null);
                  }}
                  className="mt-2 min-h-11 w-full rounded-sbt bg-sbt-ink px-4 py-2.5 text-sm font-semibold text-sbt-paper"
                >
                  {ocrSpeakersConfirmed ? "Speakers confirmed ✓" : "Confirm these speakers"}
                </button>
              </div>
            ) : null}
          </details>
        ) : null}

        {preview && participantNames.length > 2 ? (
          <p className="mt-3 rounded-sbt border border-sbt-amber/35 bg-sbt-amber/10 px-3 py-2.5 text-[12px] leading-relaxed text-sbt-dusk">
            Group chat detected: {participantNames.length} participants remain separate. The overview includes everyone; the detailed read compares you with the selected participant only.
          </p>
        ) : null}

        <section className="mt-4 rounded-sbt border border-sbt-gold/25 bg-sbt-gold/[0.045] p-4" aria-labelledby="context-heading">
          <h2 id="context-heading" className="font-display text-base text-sbt-ink">Context for an accurate read</h2>
          <p className="mt-1 text-xs text-sbt-mute">Subtext will not assume this is dating, work, family, or anything else.</p>
          <div className="mt-4">
            <p className="text-xs font-medium text-sbt-dusk">Who is this conversation with?</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CONTEXT_ORDER.filter((id) => ["dating", "partner", "work", "friendship", "family", "other"].includes(id)).map((id) => (
                <button key={id} type="button" onClick={() => { setContext(id); setContextConfirmed(true); }} aria-pressed={contextConfirmed && context === id} className={`min-h-11 rounded-full border px-3 py-1.5 text-sm transition-colors ${contextConfirmed && context === id ? "border-sbt-ink bg-sbt-ink text-sbt-paper" : "border-sbt-linen bg-white/50 text-sbt-dusk hover:border-sbt-gold/60"}`}>
                  {CONTEXTS[id].label}
                </button>
              ))}
            </div>
            <details className="mt-2 rounded-sbt border border-sbt-linen bg-white/50 p-2.5">
              <summary className="cursor-pointer text-sm text-sbt-dusk">More relationship types</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CONTEXT_ORDER.filter((id) => !["dating", "partner", "work", "friendship", "family", "other"].includes(id)).map((id) => (
                  <button key={id} type="button" onClick={() => { setContext(id); setContextConfirmed(true); }} aria-pressed={contextConfirmed && context === id} className={`min-h-11 rounded-full border px-3 py-1.5 text-sm transition-colors ${contextConfirmed && context === id ? "border-sbt-ink bg-sbt-ink text-sbt-paper" : "border-sbt-linen bg-white/50 text-sbt-dusk hover:border-sbt-gold/60"}`}>
                    {CONTEXTS[id].label}
                  </button>
                ))}
              </div>
            </details>
          </div>
          <div className="mt-5">
            <p className="text-xs font-medium text-sbt-dusk">How long have you known them?</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {FAMILIARITY_ORDER.map((id) => (
                <button key={id} type="button" onClick={() => { setFamiliarity(id); setFamiliarityConfirmed(true); }} aria-pressed={familiarityConfirmed && familiarity === id} className={`min-h-11 rounded-sbt border px-2.5 py-2 text-[13px] leading-tight transition-colors ${familiarityConfirmed && familiarity === id ? "border-sbt-gold bg-sbt-gold/15 font-medium text-sbt-ink" : "border-sbt-linen bg-white/50 text-sbt-dusk hover:border-sbt-gold/60"}`}>
                  {FAMILIARITIES[id].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {unsupportedAnalysisLanguage ? (
          <p role="status" className="mt-3 rounded-sbt border border-sbt-amber/35 bg-sbt-amber/10 px-3 py-2.5 text-[12px] leading-relaxed text-sbt-dusk">
            Speaker separation supports these names and characters. Language-pattern analysis is currently validated only for English messages, so Subtext will not generate a potentially misleading reading for this paste.
          </p>
        ) : null}

        {parseWarning ? (
          <p role="alert" className="mt-3 rounded-sbt border border-sbt-amber/35 bg-sbt-amber/10 px-3 py-2.5 text-[12px] leading-relaxed text-sbt-dusk">
            {parseWarning}
          </p>
        ) : null}

        {runError ? (
          <div role="alert" className="mt-4 rounded-sbt border border-sbt-rose/30 bg-sbt-rose/[0.06] p-4 text-[13px] leading-relaxed text-sbt-dusk">
            {runError}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-sbt border border-sbt-linen bg-sbt-paper p-2 shadow-soft sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <button
            type="button"
            onClick={run}
            disabled={!raw.trim() || unsupportedAnalysisLanguage || !contextConfirmed || !familiarityConfirmed || ((ocrState === "done" || preview?.format === "alternating") && !ocrSpeakersConfirmed)}
            className="min-h-12 flex-1 rounded-sbt bg-sbt-gold-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-sbt-ink disabled:opacity-40 sm:flex-none"
          >
            {unsupportedAnalysisLanguage ? "English analysis only" : !contextConfirmed || !familiarityConfirmed ? "Choose context first" : (ocrState === "done" || preview?.format === "alternating") && !ocrSpeakersConfirmed ? "Confirm speakers first" : "Read this conversation"}
          </button>
          <p className="text-xs text-sbt-mute">Conversation reader · free</p>
        </div>

        <details className="mt-3 rounded-sbt border border-sbt-linen bg-white/50 p-4">
          <summary className="cursor-pointer font-display text-[15px] text-sbt-ink">Answer Coach preferences <span className="font-body text-[12px] text-sbt-mute">— optional paid feature</span></summary>
          <div className="mt-5 border-t border-sbt-gold/15 pt-4">
            <p className="text-[11px] uppercase tracking-wider text-sbt-mute">What do you want from Answer Coach?</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {(Object.keys(COACH_GOALS) as CoachGoalId[]).map((id) => (
                <button key={id} type="button" onClick={() => setCoachGoal(id)} aria-pressed={coachGoal === id} className={`rounded-sbt border px-2.5 py-2 text-[12px] leading-tight transition-colors ${coachGoal === id ? "border-sbt-gold bg-sbt-gold/15 font-medium text-sbt-ink" : "border-sbt-linen bg-white/50 text-sbt-dusk"}`}>
                  {COACH_GOALS[id].label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-sbt-mute">Preferred reply tone</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(COACH_TONES) as CoachToneId[]).map((id) => (
                <button key={id} type="button" onClick={() => setCoachTone(id)} aria-pressed={coachTone === id} className={`rounded-full border px-3 py-1.5 text-sm ${coachTone === id ? "border-sbt-ink bg-sbt-ink text-sbt-paper" : "border-sbt-linen bg-white/50 text-sbt-dusk"}`}>
                  {id[0].toUpperCase() + id.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="coach-stakes" className="text-[11px] uppercase tracking-wider text-sbt-mute">Anything Coach must protect? <span className="normal-case tracking-normal">optional</span></label>
            <input id="coach-stakes" value={coachStakes} maxLength={500} onChange={(event) => setCoachStakes(event.target.value)} placeholder="Example: I need to keep this professional, or I do not want further contact." className="mt-2 min-h-11 w-full rounded-sbt border border-sbt-linen bg-white px-3 text-sm text-sbt-ink outline-none focus:ring-2 focus:ring-sbt-gold/30" />
          </div>
        </details>
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
                onClick={() => loadSample(s)}
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
