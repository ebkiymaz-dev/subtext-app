// ═════════════════════════════════════════════════════════════
// SUBTEXT — analysis types.
//
// THE ONE HONESTY RULE that governs every type below: every percentage is
// a CONFIDENCE / EVIDENCE-WEIGHT — "how many markers associated with X are
// present" — never a probability that something is true. Nothing in this
// app models "did they lie" or "are they traumatised". It models
// "which markers are present in this text, and where".
// ═════════════════════════════════════════════════════════════

export type Speaker = "you" | "them";

export interface Message {
  id: string;
  index: number;
  speaker: Speaker;
  /** display name as written in the paste */
  name: string;
  text: string;
  timestamp?: string;
}

export interface Transcript {
  messages: Message[];
  names: string[];
  /** how the paste was recognised — shown to the user so parsing is auditable */
  format: "named" | "whatsapp" | "alternating" | "single";
}

export type ContextId = "dating" | "work" | "family" | "friendship" | "other";

export type CategoryId =
  // universal core — always on
  | "engagement"
  | "affect"
  | "sincerity"
  | "power"
  | "evasion"
  | "subtext_load"
  | "pressure"
  | "stress"
  | "attachment"
  // context pools
  | "reciprocity"
  | "fade_markers"
  | "professionalism"
  | "deadline_pressure"
  | "accountability_shift"
  | "guilt"
  | "boundary_pressure";

export interface Evidence {
  messageId: string;
  /** the exact substring that matched — highlighted coral inline */
  span: string;
  why: string;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  /** 0–100 CONFIDENCE that markers for this category are present */
  percent: number;
  /** one-line plain-English read */
  read: string;
  /** deterministic = computed in code here; inferred = an LLM read (mocked) */
  tier: "deterministic" | "inferred";
  tone: "neutral" | "warm" | "caution";
  evidence: Evidence[];
  caveat: string;
}

export interface Interpretation {
  id: string;
  /** weights across all interpretations sum to 100 */
  weight: number;
  title: string;
  body: string;
  /** exactly one interpretation is flagged as the most-charitable read */
  charitable: boolean;
  suggestedNext: string;
}

export interface CoachSuggestion {
  action: string;
  reasoning: string;
  evidenceMessageId?: string;
}

export interface Analysis {
  transcript: Transcript;
  context: ContextId;
  categories: CategoryScore[];
  interpretations: Interpretation[];
  whatWasntSaid: string[];
  coach: CoachSuggestion[];
  /** deterministic vs inferred split, for the honesty footer */
  engineVersion: string;
  mockNotes: string[];
}

/** The distress path is NOT a score. It is an override that replaces analysis. */
export interface DistressResult {
  triggered: boolean;
  /** the matched markers — never shown as a percentage, never gamified */
  markers: string[];
}
