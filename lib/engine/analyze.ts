// ═════════════════════════════════════════════════════════════
// THE ANALYSIS ORCHESTRATOR.
//
// ORDER IS LOAD-BEARING:
//   1. DISTRESS SCREEN  (local, BEFORE anything else — hard stop)
//   2. segment          (local)
//   3. SIGNAL EXTRACTION (local) — the psycholinguistic layer
//   4. category scores  (local, computed from the signals)
//   5. headline, interpretations, "what wasn't said", Coach (local)
//
// Steps 1–5 are the FREE TIER and they are complete: nothing here is a
// placeholder for a model, and nothing here leaves the device. That is what
// makes "your conversation never touches our server" literally true rather
// than a marketing line.
//
// PREMIUM adds ONE structured server-side model call on top of this output
// (`lib/deepRead.ts` → `app/api/deep-read/route.ts`). It never replaces the
// on-device layer; it is merged into it, and the distress screen pre-empts
// both tiers.
// ═════════════════════════════════════════════════════════════

import type { Analysis, ContextId, DistressResult, FamiliarityId, Transcript } from "./types";
import { screenForDistress } from "./distress";
import { scoreCategories } from "./categories";
import { extractSignals } from "./signals";
import { buildCoach, buildHeadline, buildInterpretations, whatWasntSaid } from "./interpretations";
import { segment, setYou } from "./segment";
import { resolveProfile } from "./relationship";

export const ENGINE_VERSION = "subtext-engine/2.1.0 (on-device)";

export const METHOD_NOTES = [
  "Everything on this screen is computed on your device, from your text, by rules you could read: speaker separation, the crisis screen, connection-attempt responses, tone differences, conversation endings, style matching, and every evidence line.",
  "The engine reads conversational moves, not word counts. A short reply is weak evidence; a sign-off, an unanswered attempt to connect, or a noticeably more formal reply is stronger evidence. That is why two exchanges of the same length can score very differently.",
  "Metrics that need more text than you pasted are not shown at all rather than shown with a shrug — style matching disappears below 25 words a side, and reply latency only appears when your paste carried timestamps.",
  "No raw text is saved automatically. A conversation is stored only if you explicitly save it to an optional local profile.",
];

export type AnalyzeResult =
  | { kind: "distress"; distress: DistressResult }
  | { kind: "analysis"; analysis: Analysis };

export function analyze(
  raw: string,
  context: ContextId,
  youName?: string,
  familiarity: FamiliarityId = "year"
): AnalyzeResult {
  // 1 — THE HARD RULE. Before parsing effort, before any spend, before
  // anything at all. This ordering is the whole safety guarantee.
  const distress = screenForDistress(raw);
  if (distress.triggered) return { kind: "distress", distress };

  // 2 — segment
  let transcript: Transcript = segment(raw);
  if (youName) transcript = setYou(transcript, youName);

  // 3 — the signal layer
  const signals = extractSignals(transcript);

  // 3b — the RELATIONSHIP layer. Resolved once and passed down, so every
  // score below is computed against the same baseline and the UI can show
  // the user exactly which baseline that was.
  const profile = resolveProfile(context, familiarity);

  // 4 — categories, computed from signals against the profile
  const categories = scoreCategories(transcript, context, signals, profile);

  // 5 — the depth layer
  const interpretations = buildInterpretations(categories, context, transcript, signals, profile);

  return {
    kind: "analysis",
    analysis: {
      transcript,
      context,
      familiarity,
      profile,
      headline: buildHeadline(signals, categories, transcript, context, profile),
      signals,
      categories,
      interpretations,
      whatWasntSaid: whatWasntSaid(categories, transcript, signals, profile),
      coach: buildCoach(categories, signals, profile, transcript),
      engineVersion: ENGINE_VERSION,
      tier: "on-device",
      methodNotes: [
        ...METHOD_NOTES,
        `Relationship weighting: ${profile.contextLabel.toLowerCase()}, known ${profile.familiarityLabel.toLowerCase()}. ${profile.frame}`,
        profile.familiarityNote,
      ],
    },
  };
}
