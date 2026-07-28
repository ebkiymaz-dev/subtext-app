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

import type { Analysis, ContextId, DistressResult, Transcript } from "./types";
import { screenForDistress } from "./distress";
import { scoreCategories } from "./categories";
import { extractSignals } from "./signals";
import { buildCoach, buildHeadline, buildInterpretations, whatWasntSaid } from "./interpretations";
import { segment, setYou } from "./segment";

export const ENGINE_VERSION = "subtext-engine/2.0.0 (on-device)";

export const METHOD_NOTES = [
  "Everything on this screen is computed on your device, from your text, by rules you could read: segmentation, the crisis screen, bid-and-response classification, register asymmetry, closing-move detection, style matching, and every evidence line.",
  "The engine reads MOVES, not word counts. A short reply is weak evidence; a sign-off, an unreturned bid, or a reply in a more formal register than the message it answers are strong ones. That is why two exchanges of the same length can score very differently.",
  "Metrics that need more text than you pasted are not shown at all rather than shown with a shrug — style matching disappears below 25 words a side, and reply latency only appears when your paste carried timestamps.",
  "No raw text is persisted anywhere. Only a per-month analysis count lives in local storage.",
];

export type AnalyzeResult =
  | { kind: "distress"; distress: DistressResult }
  | { kind: "analysis"; analysis: Analysis };

export function analyze(raw: string, context: ContextId, youName?: string): AnalyzeResult {
  // 1 — THE HARD RULE. Before parsing effort, before any spend, before
  // anything at all. This ordering is the whole safety guarantee.
  const distress = screenForDistress(raw);
  if (distress.triggered) return { kind: "distress", distress };

  // 2 — segment
  let transcript: Transcript = segment(raw);
  if (youName) transcript = setYou(transcript, youName);

  // 3 — the signal layer
  const signals = extractSignals(transcript);

  // 4 — categories, computed from signals
  const categories = scoreCategories(transcript, context, signals);

  // 5 — the depth layer
  const interpretations = buildInterpretations(categories, context, transcript, signals);

  return {
    kind: "analysis",
    analysis: {
      transcript,
      context,
      headline: buildHeadline(signals, categories, transcript, context),
      signals,
      categories,
      interpretations,
      whatWasntSaid: whatWasntSaid(categories, transcript, signals),
      coach: buildCoach(categories, signals),
      engineVersion: ENGINE_VERSION,
      tier: "on-device",
      methodNotes: METHOD_NOTES,
    },
  };
}
