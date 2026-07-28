// ═════════════════════════════════════════════════════════════
// SUBTEXT — analysis types.
//
// THE ONE HONESTY RULE that governs every type below: every percentage is
// a CONFIDENCE / EVIDENCE-WEIGHT — "how many markers associated with X are
// present" — never a probability that something is true. Nothing in this
// app models "did they lie" or "are they traumatised". It models
// "which markers are present in this text, and where".
//
// v2 adds a psycholinguistic SIGNAL layer between segmentation and scoring.
// Categories no longer count words; they read moves — bids, closes,
// reciprocation, register asymmetry, style matching. See `signals.ts`.
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
  /** epoch ms, when the paste carried a parseable timestamp */
  at?: number;
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
  | "warmth_distance"
  | "closure"
  | "bid_response"
  | "reciprocity"
  | "mirroring"
  | "affect"
  | "sincerity"
  | "power"
  | "evasion"
  | "subtext_load"
  | "pressure"
  | "stress"
  | "attachment"
  // context pools
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

/**
 * Where a score came from.
 *   on-device — computed here, in the browser, from the text. Free tier.
 *   ai        — produced by ONE structured server-side model call. Premium.
 * There is no third state. Nothing is ever labelled as a model read when a
 * rule produced it, and nothing rule-based is ever dressed up as a model.
 */
export type Tier = "on-device" | "ai";

export interface CategoryScore {
  id: CategoryId;
  label: string;
  /** 0–100 CONFIDENCE that markers for this category are present */
  percent: number;
  /** one-line plain-English read */
  read: string;
  tier: Tier;
  /** short description of the method behind the number, shown under the bar */
  method: string;
  tone: "neutral" | "warm" | "caution";
  evidence: Evidence[];
  caveat: string;
  /** true when the sample is too thin for this metric to mean much */
  thin?: boolean;
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
  /** verbatim lines from the transcript this reading rests on */
  quotes?: string[];
}

export interface CoachSuggestion {
  action: string;
  reasoning: string;
  evidenceMessageId?: string;
}

// ── the v2 signal layer ──────────────────────────────────────

export type BidKind =
  | "compliment"
  | "affection"
  | "invitation"
  | "self_disclosure"
  | "question"
  | "news_share"
  | "help_request";

/** How a turn answered the bid that preceded it (Gottman's frame). */
export type BidResponse = "toward" | "minimal" | "away" | "against";

export interface TurnSignal {
  messageId: string;
  speaker: Speaker;
  words: number;
  isQuestion: boolean;
  /** 0–1 — how far this turn raises the formal register */
  formality: number;
  /** 0–1 — how strongly this turn moves to end the exchange */
  closing: number;
  /** 0–1 — how strongly this turn invites a next message */
  continuing: number;
  hedges: number;
  intensifiers: number;
  warm: number;
  distant: number;
  enthusiasm: number;
  /** does the turn refer to the other person at all, once fixed politeness phrases are stripped */
  refersToOther: boolean;
  /** propositional content beyond politeness + sign-off, in words */
  substantiveWords: number;
  bidKind: BidKind | null;
  /** minutes since the previous message, when timestamps exist */
  latencyMin: number | null;
}

export interface BidEvent {
  /** who made the bid */
  by: Speaker;
  messageId: string;
  kind: BidKind;
  span: string;
  /** null when nobody replied at all */
  response: BidResponse | null;
  responseMessageId: string | null;
  /** plain-English description of how it landed */
  note: string;
}

export interface SignalSummary {
  turns: TurnSignal[];
  bids: BidEvent[];
  /** them.formality − you.formality, −1…1. Positive = they are the formal one. */
  politenessAsymmetry: number;
  /** 0–1 Language Style Matching across function-word families */
  lsm: number | null;
  /** 0–1 — how much the exchange as a whole is being wound down */
  closingIndex: number;
  /** 0–1 — how much it is being kept open */
  continuationIndex: number;
  /** 0–1 — share of their turns that engage the previous turn AND add to it */
  uptakeRate: number;
  /** both sides sign off — the exchange ends by agreement, not by withdrawal */
  mutualClose: boolean;
  /** a compliment/affection bid answered with politeness + sign-off and nothing else */
  softClose: boolean;
  /** the only enthusiasm marker sits on the sign-off rather than on the content */
  enthusiasmOnClosingOnly: boolean;
  /** median reply latency in minutes, per side */
  latency: { you: number | null; them: number | null };
  /** unreciprocated bids, by kind */
  unreciprocated: BidKind[];
  /** who wrote the last message */
  lastSpeaker: Speaker | null;
  /**
   * Longest run of consecutive messages from each side without a reply.
   * The engine has to be able to see the user piling on, or it is a mirror
   * rather than an instrument.
   */
  longestRun: { you: number; them: number };
  themWords: number;
  youWords: number;
  /** 0–1 — how much weight the sample size can bear */
  sampleWeight: number;
}

export interface Analysis {
  transcript: Transcript;
  context: ContextId;
  /** one plain-English sentence: the dominant read, stated without hedging into mush */
  headline: string;
  signals: SignalSummary;
  categories: CategoryScore[];
  interpretations: Interpretation[];
  whatWasntSaid: string[];
  coach: CoachSuggestion[];
  engineVersion: string;
  /** "on-device" until a deep read is merged in */
  tier: Tier;
  /** model id when tier === "ai" */
  model?: string;
  methodNotes: string[];
}

/** The distress path is NOT a score. It is an override that replaces analysis. */
export interface DistressResult {
  triggered: boolean;
  /** the matched markers — never shown as a percentage, never gamified */
  markers: string[];
}
