// ═════════════════════════════════════════════════════════════
// THE ANALYSIS ORCHESTRATOR.
//
// ORDER IS LOAD-BEARING:
//   1. segment          (local)
//   2. DISTRESS SCREEN  (local, BEFORE any spend — hard stop)
//   3. deterministic metrics + category scores (local)
//   4. interpretations, "what wasn't said", Coach
//
// In a live build only step 4's prose and the `inferred` category scores
// come from ONE structured model call. Steps 1–3 stay on-device forever,
// which is what makes "your conversation never touches our server"
// literally true rather than a marketing line.
// ═════════════════════════════════════════════════════════════

import type { Analysis, ContextId, DistressResult, Transcript } from "./types";
import { screenForDistress } from "./distress";
import { scoreCategories } from "./categories";
import { buildCoach, buildInterpretations, whatWasntSaid } from "./interpretations";
import { segment, setYou } from "./segment";

export const ENGINE_VERSION = "subtext-engine/0.4.0 (local)";

export const MOCK_NOTES = [
  "REAL and local in this build: segmentation, the distress screen, every deterministic category, all evidence extraction, the interpretation schema (3–5 reads, none over 60%, summing to 100).",
  "The categories marked “inferred” and the interpretation prose are produced by on-device heuristics and templates in this build — not by a language model. They read your actual text, but they are rule-based, so treat them as a prompt for your own judgement rather than a verdict.",
  "No raw text is ever persisted — only a per-month analysis count lives in local storage.",
];

export type AnalyzeResult =
  | { kind: "distress"; distress: DistressResult }
  | { kind: "analysis"; analysis: Analysis };

export function analyze(raw: string, context: ContextId, youName?: string): AnalyzeResult {
  // 2 — THE HARD RULE. Before parsing effort, before any spend.
  const distress = screenForDistress(raw);
  if (distress.triggered) return { kind: "distress", distress };

  // 1 — segment
  let transcript: Transcript = segment(raw);
  if (youName) transcript = setYou(transcript, youName);

  // 3 — categories (deterministic + mock-inferred)
  const categories = scoreCategories(transcript, context);

  // 4 — the depth layer
  const interpretations = buildInterpretations(categories, context, transcript);

  return {
    kind: "analysis",
    analysis: {
      transcript,
      context,
      categories,
      interpretations,
      whatWasntSaid: whatWasntSaid(categories, transcript),
      coach: buildCoach(categories),
      engineVersion: ENGINE_VERSION,
      mockNotes: MOCK_NOTES,
    },
  };
}
