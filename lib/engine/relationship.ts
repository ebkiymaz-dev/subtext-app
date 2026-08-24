// ═════════════════════════════════════════════════════════════
// THE RELATIONSHIP LAYER — context × familiarity.
//
// WHY THIS EXISTS
//
// v2 read moves instead of words, which fixed the biggest failure mode. It
// left a second one untouched: the engine had no idea WHO was talking. It
// scored "Dear Sam, thank you for your message. Best, Alex" identically
// whether Alex was a stranger on a marketplace listing or someone's sister of
// forty years. Those are not the same event. One is the register the
// situation prescribes; the other is a person putting a desk between
// themselves and their sibling.
//
// THE PRINCIPLE, stated once and applied everywhere below:
//
//     A SIGNAL IS A DEVIATION FROM AN EXPECTED BASELINE, NOT AN ABSOLUTE.
//
// Formality is only distance when it EXCEEDS what the pairing would produce
// on its own. Silence is only withdrawal when the pairing would normally
// produce a reply. An unreturned compliment is only information when the
// pairing is one where compliments are normally returned. So every context
// and every duration carries a baseline, the baseline is subtracted, and what
// is left over is the only thing scored.
//
// THE SECOND PRINCIPLE — diagnosticity rises with history:
//
// With someone you met on Tuesday there is no established norm to deviate
// from, so almost nothing in one exchange is diagnostic and the engine must
// say so rather than inventing a read. With someone you have known twenty
// years there IS a norm, the user knows it even if the engine does not, and
// a departure from the warm default is worth naming. Hence `deviation`: it
// scales how hard the engine is allowed to lean on any register or warmth
// finding, and it is deliberately below 1 for the short durations.
//
// WHAT THIS LAYER MUST NOT DO. It never adds certainty. Every weight below
// can move a score and can change which sentence is written about it; none of
// them can turn a confidence reading into a claim about intent, and none of
// them invent evidence. Law 2 still holds downstream: no citable line, no
// score.
// ═════════════════════════════════════════════════════════════

import type { CategoryId, ContextId, FamiliarityId } from "./types";

// ── contexts ─────────────────────────────────────────────────

interface ContextSpec {
  label: string;
  /** short line under the picker — what selecting this actually changes */
  hint: string;
  /**
   * Register the SITUATION prescribes on its own, 0–1, before any
   * relationship enters into it. A marketplace haggle is formal because it is
   * a transaction between strangers, not because anyone is being distant.
   */
  formality: number;
  /** how much an EXCESS of formality should read as distance */
  register: number;
  /** how much unreturned bids and one-way questions matter here */
  reciprocity: number;
  /** how much a sign-off should be read as anything other than efficiency */
  closure: number;
  /** how much the ABSENCE of warmth is informative */
  warmth: number;
  /** higher = a slow reply means less */
  latencyTolerance: number;
  /** the exchange has a job to do; relational readings are secondary */
  transactional: boolean;
  /** extra categories switched on for this context */
  pool: CategoryId[];
  /** the frame the user sees, and the frame the interpreter reasons in */
  frame: string;
}

export const CONTEXTS: Record<ContextId, ContextSpec> = {
  partner: {
    label: "Partner",
    hint: "girlfriend, boyfriend or spouse — connection, needs and repair",
    formality: 0.24,
    register: 1.12,
    reciprocity: 1.08,
    closure: 0.9,
    warmth: 1.12,
    latencyTolerance: 1.15,
    transactional: false,
    pool: ["boundary_pressure", "guilt"],
    frame:
      "Established partners have shared history and an informal baseline. The useful question is not who is right, but whether each person’s need, limit and request is made clear enough to answer without guessing.",
  },
  dating: {
    label: "Dating",
    hint: "early romantic — bids, fades and register carry the most weight here",
    formality: 0.38,
    register: 1.05,
    reciprocity: 1.1,
    closure: 1.1,
    warmth: 1.15,
    latencyTolerance: 0.9,
    transactional: false,
    pool: ["fade_markers"],
    frame:
      "Early romantic exchanges are the one context where almost everything is a signal, because there is no shared logistics to hide behind. That cuts both ways: it also makes over-reading easiest here.",
  },
  work: {
    label: "Work",
    hint: "colleague or manager — formality is the job, not a message",
    formality: 0.68,
    register: 0.75,
    reciprocity: 0.55,
    closure: 0.55,
    warmth: 0.45,
    latencyTolerance: 1.6,
    transactional: true,
    pool: ["professionalism", "deadline_pressure", "accountability_shift"],
    frame:
      "At work the formal register is prescribed, replies are queued behind other work, and nobody owes anybody a question back. Distance readings are heavily discounted; what is scored instead is who is made answerable for what.",
  },
  business: {
    label: "Business negotiation",
    hint: "a deal in progress — anchoring, leverage and deadline pressure",
    formality: 0.74,
    register: 0.7,
    reciprocity: 0.45,
    closure: 0.4,
    warmth: 0.3,
    latencyTolerance: 1.7,
    transactional: true,
    pool: ["professionalism", "deadline_pressure", "anchoring", "commitment_specificity"],
    frame:
      "In a negotiation, warmth is a tactic and coolness is a position. Reading either as a feeling is a category error, so this context scores structure instead: who anchored, who conceded, who is manufacturing a clock.",
  },
  marketplace: {
    label: "Online marketplace",
    hint: "buying or selling with a stranger — vagueness is the signal, not tone",
    formality: 0.7,
    register: 0.45,
    reciprocity: 0.3,
    closure: 0.25,
    warmth: 0.2,
    latencyTolerance: 1.8,
    transactional: true,
    pool: ["anchoring", "commitment_specificity", "evasion"],
    frame:
      "Two strangers arranging a sale owe each other nothing except specifics. Curtness here is not coldness and a sign-off is not withdrawal. The only thing worth reading is whether the message commits to a number, a time and a place, or avoids all three.",
  },
  neighbor: {
    label: "Neighbour",
    hint: "proximity without choice — politeness carrying a request",
    formality: 0.6,
    register: 0.7,
    reciprocity: 0.6,
    closure: 0.5,
    warmth: 0.55,
    latencyTolerance: 1.6,
    transactional: false,
    pool: ["boundary_pressure", "commitment_specificity", "guilt"],
    frame:
      "Neighbours are the one relationship nobody chose and nobody can exit, so almost everything difficult gets said through politeness. The register is elaborate on purpose; what matters is the request underneath it and whether a limit is being worked around.",
  },
  stranger: {
    label: "Stranger",
    hint: "someone you do not know — clarity, privacy and safety first",
    formality: 0.62,
    register: 0.55,
    reciprocity: 0.25,
    closure: 0.35,
    warmth: 0.2,
    latencyTolerance: 1.8,
    transactional: true,
    pool: ["boundary_pressure", "pressure", "evasion"],
    frame:
      "With a stranger there is no reliable relationship baseline to interpret. Warmth and response speed are weak evidence; clear limits, requested information and whether pressure continues after a no are what matter.",
  },
  roommate: {
    label: "Roommate",
    hint: "shared space — logistics, limits and the guilt around them",
    formality: 0.42,
    register: 0.95,
    reciprocity: 0.95,
    closure: 0.75,
    warmth: 0.85,
    latencyTolerance: 1.1,
    transactional: false,
    pool: ["boundary_pressure", "guilt", "commitment_specificity"],
    frame:
      "Living with someone compresses conflict into logistics: the argument is never about the dishes. This context watches for a stated limit being minimised and for commitments that stay deliberately unbounded.",
  },
  family: {
    label: "Family",
    hint: "long history, low formality baseline — obligation framing",
    formality: 0.3,
    register: 1.1,
    reciprocity: 0.85,
    closure: 0.7,
    warmth: 1.05,
    latencyTolerance: 1.2,
    transactional: false,
    pool: ["guilt", "boundary_pressure"],
    frame:
      "Family has the lowest formality baseline of any context, which makes any rise in register unusually visible. It also has the most established obligation language, so guilt framing is scored explicitly rather than folded into pressure.",
  },
  friendship: {
    label: "Friendship",
    hint: "chosen and unenforced — drift shows up before anyone names it",
    formality: 0.34,
    register: 1.05,
    reciprocity: 1.05,
    closure: 0.85,
    warmth: 1.05,
    latencyTolerance: 1.1,
    transactional: false,
    pool: ["fade_markers"],
    frame:
      "Friendship is the relationship with no structure holding it up — no contract, no lease, no blood. It ends by drift rather than decision, and drift is visible in unbounded deferrals long before anyone says anything.",
  },
  ex_partner: {
    label: "Ex-partner",
    hint: "shared history, renegotiated distance — expect managed register",
    formality: 0.52,
    register: 1.15,
    reciprocity: 0.95,
    closure: 1.05,
    warmth: 1.0,
    latencyTolerance: 1.0,
    transactional: false,
    pool: ["fade_markers", "boundary_pressure", "guilt"],
    frame:
      "An ex writes with a deliberately managed register: they know the intimate one and are choosing not to use it. That makes formality here a decision rather than a habit — and it makes an unexpected drop INTO the intimate register just as informative as a rise out of it.",
  },
  other: {
    label: "Other",
    hint: "no context tuning — universal core only",
    formality: 0.5,
    register: 1,
    reciprocity: 1,
    closure: 1,
    warmth: 1,
    latencyTolerance: 1,
    transactional: false,
    pool: [],
    frame:
      "No context tuning applied. Every reading below comes from the universal core, weighted only by how long you have known this person.",
  },
};

export const CONTEXT_ORDER: ContextId[] = [
  "partner",
  "dating",
  "friendship",
  "family",
  "work",
  "roommate",
  "ex_partner",
  "business",
  "marketplace",
  "neighbor",
  "stranger",
  "other",
];

// ── familiarity ──────────────────────────────────────────────

interface FamiliaritySpec {
  label: string;
  /** shifts the expected register: strangers are formal by default */
  formalityOffset: number;
  /**
   * How hard the engine is allowed to lean on register / warmth / closure
   * findings. Below 1 for short histories — with no norm established, there
   * is nothing for a departure to be a departure FROM.
   */
  deviation: number;
  /** the sentence that explains the weighting, in the user's terms */
  note: string;
}

export const FAMILIARITIES: Record<FamiliarityId, FamiliaritySpec> = {
  days: {
    label: "A few days",
    formalityOffset: 0.2,
    deviation: 0.45,
    note: "You have known them a few days, so there is no established register to depart from. Formality is scored as the default between near-strangers rather than as distance, and every relational reading below is deliberately held back — one exchange with a new person is a sample of one.",
  },
  months: {
    label: "A few months",
    formalityOffset: 0.05,
    deviation: 0.8,
    note: "A few months is long enough for a habitual register to exist and short enough that it is still settling. Register findings are scored at reduced weight: a formal reply is worth noting, not worth concluding from.",
  },
  year: {
    label: "More than a year",
    formalityOffset: -0.06,
    deviation: 1,
    note: "Past a year the two of you have a normal way of writing to each other. Departures from it are scored at full weight, because a departure is now a real thing rather than an artefact of not knowing someone yet.",
  },
  five_years: {
    label: "More than 5 years",
    formalityOffset: -0.12,
    deviation: 1.18,
    note: "Five years of habit sets a low expected formality. Anything correct-but-cool is therefore scored as a rise ABOVE your own baseline, not as ordinary politeness — with this much history, choosing the formal form is a choice.",
  },
  lifetime: {
    label: "My whole life",
    formalityOffset: -0.16,
    deviation: 1.28,
    note: "A lifetime is the lowest expected formality there is. The engine reads any elevated register here as a deliberate step back, and reads absence of warmth as more informative than it would be anywhere else — because the default was never neutral, it was warm.",
  },
};

export const FAMILIARITY_ORDER: FamiliarityId[] = [
  "days",
  "months",
  "year",
  "five_years",
  "lifetime",
];

// ── the resolved profile ─────────────────────────────────────

export interface RelationshipProfile {
  context: ContextId;
  familiarity: FamiliarityId;
  contextLabel: string;
  familiarityLabel: string;
  /** 0–1 register this pairing produces with no relational content in it */
  expectedFormality: number;
  registerWeight: number;
  reciprocityWeight: number;
  closureWeight: number;
  warmthWeight: number;
  latencyTolerance: number;
  transactional: boolean;
  /** raw diagnosticity multiplier — exposed so the UI can be honest about it */
  deviation: number;
  pool: CategoryId[];
  frame: string;
  familiarityNote: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function resolveProfile(
  context: ContextId,
  familiarity: FamiliarityId
): RelationshipProfile {
  const c = CONTEXTS[context] ?? CONTEXTS.other;
  const f = FAMILIARITIES[familiarity] ?? FAMILIARITIES.year;

  return {
    context,
    familiarity,
    contextLabel: c.label,
    familiarityLabel: f.label,
    expectedFormality: clamp01(c.formality + f.formalityOffset),
    // Register and warmth are the two purely relational readings, so they take
    // the full diagnosticity multiplier.
    registerWeight: c.register * f.deviation,
    warmthWeight: c.warmth * f.deviation,
    // A sign-off is a sign-off at any duration — it is categorical, not
    // relational — so history only partially modulates it.
    closureWeight: c.closure * (0.6 + 0.4 * f.deviation),
    reciprocityWeight: c.reciprocity * (0.7 + 0.3 * f.deviation),
    // Long history means a slow reply is more unusual, not less.
    latencyTolerance: c.latencyTolerance / Math.max(f.deviation, 0.4),
    transactional: c.transactional,
    deviation: f.deviation,
    pool: c.pool,
    frame: c.frame,
    familiarityNote: f.note,
  };
}

// ── the register narrative ───────────────────────────────────
//
// The single most important sentence the app writes, and the one mert's brief
// is about: the SAME formality means opposite things at opposite ends of the
// familiarity scale, and the app has to say which one it is out loud.

/** How far their register sits ABOVE what this pairing prescribes, 0–1. */
export function formalityExcess(themFormality: number, p: RelationshipProfile): number {
  return clamp01((themFormality - p.expectedFormality) / 0.35);
}

export function registerNarrative(
  p: RelationshipProfile,
  excess: number,
  asymmetry: number,
  pairPhrases: string[]
): string | null {
  const pairs = pairPhrases.length ? ` — ${listOf(pairPhrases)}` : "";
  const high = excess >= 0.4;
  const gap = asymmetry >= 0.15;

  if (!high && !gap) return null;

  // ── the stranger end: formality is the prescription, not the message ──
  //
  // Note the careful wording. It says the REGISTER TERM is discounted, not
  // that the whole score is low — the score also contains structural terms
  // (a sign-off, an unreturned bid) that familiarity does not touch. Claiming
  // "this is scored near zero" next to a bar reading 60 would be a lie the
  // user can see, which is worse than no explanation at all.
  if (p.deviation <= 0.5) {
    if (!high) return null;
    return `Their register is formal${pairs}. You have known them ${p.familiarityLabel.toLowerCase()}, and between people who barely know each other the formal form IS the default — so the register part of this score is discounted almost to nothing. Anything left in the bar below is coming from the structure of the exchange, not from how politely it was written. The same message would read very differently after a year.`;
  }

  if (p.transactional && !gap) {
    return `Their register is formal${pairs}, which is what a ${p.contextLabel.toLowerCase()} exchange prescribes. Nothing is being read into it here; the informative part of this context is what gets committed to, not how warmly.`;
  }

  // ── the long-history end: the same behaviour, now a departure ──
  if (p.deviation >= 1.15 && high) {
    return `They answer in a register more formal than this relationship runs on${pairs}. You have known them ${p.familiarityLabel.toLowerCase()} — the familiar form was available and not taken. Over that much history, choosing the correct form over the close one is a choice, and it is one of the quieter ways people put distance in writing.`;
  }

  if (high && gap) {
    return `Their register sits above both yours and the baseline for this kind of relationship${pairs}. Answering warmth in a more formal key than it was offered in is one of the softest ways distance shows up in text.`;
  }
  if (gap) {
    return `Their register sits noticeably more formal than yours across the exchange${pairs}, though not above what a ${p.contextLabel.toLowerCase()} exchange would produce on its own.`;
  }
  return `Their register runs formal for this relationship${pairs}.`;
}

/** The caveat, which also has to change with the pairing to stay true. */
export function registerCaveat(p: RelationshipProfile): string {
  if (p.deviation <= 0.5) {
    return `Formality is a habit as often as it is a message, and with ${p.familiarityLabel.toLowerCase()} of history there is no way to tell which. That is why this reading is weighted down rather than presented confidently.`;
  }
  if (p.transactional) {
    return `A ${p.contextLabel.toLowerCase()} exchange is supposed to be businesslike. Register is only reported here when it exceeds what the situation already prescribes, and even then it is weak evidence.`;
  }
  return "Some people write to everyone the same way, including the people closest to them. What this measures is the gap between the register this relationship usually runs on and the one used here — and a gap has many causes, most of them dull.";
}

const listOf = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
