// ═════════════════════════════════════════════════════════════
// THE CATEGORY ENGINE — v2.
//
// Every score below is computed from the SIGNAL layer (`signals.ts`), not
// from raw counts. That is the whole difference between v1 and v2: v1 asked
// "how many warmth words are in this text", v2 asks "what did this turn DO
// to the one before it".
//
// CALIBRATION RULE. v1 multiplied every score by 0.86 and capped it at 92,
// which is why a two-line exchange and a ten-line one both came out near
// 49%. v2 removes the blanket softener and replaces it with something
// defensible:
//
//   · CATEGORICAL signals are not shrunk. A sign-off is a sign-off whether
//     the exchange is two lines or two hundred. Shrinking it would be false
//     modesty, not honesty.
//   · RATE signals (densities, style matching, latency) ARE shrunk by sample
//     weight, and are suppressed entirely below the threshold where they
//     mean anything. A metric we cannot support is not reported at all —
//     `build()` returns null and the category does not appear.
//
// Percentages do NOT sum to 100 and are not meant to. They are independent
// confidence readings on independent questions.
//
// Law 2: a score with no evidence is NOT RENDERED. Every branch attaches the
// verbatim spans that drove it.
// ═════════════════════════════════════════════════════════════

import type {
  CategoryId, CategoryScore, ContextId, Evidence, Message, SignalSummary, Transcript,
} from "./types";
import {
  ACCOUNTABILITY_SHIFT, BOUNDARY_PRESSURE, CLOSING_MOVES, CONTINUATION_BIDS, DEADLINE_PRESSURE,
  DEFLECTION, DISTANCE, DISTANCING, ENTHUSIASM, FADE, FUTURE_ANCHOR, GUILT, HEDGES, INTENSIFIERS,
  IRRITATION, PERFORMATIVE, POLITENESS_FULL, PRESSURE, PROFESSIONAL, SELF_REFERENCE, STRESS,
  WARMTH, matchAll, type Pattern,
} from "./lexicons";
import { BID_LABEL, bidsMetScore, isQuestion, wordCount } from "./signals";

// Law 1 consequence: this panel reports CONFIDENCE, and 100% confidence in a
// read of someone's text is never honest. 92 is the hard ceiling.
const CEILING = 92;
const pct = (n01: number) => Math.max(0, Math.min(CEILING, Math.round(n01 * 100)));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Register pairs: the same act performed at two different social distances.
 * Naming both halves out loud is what turns "they were formal" from an
 * assertion into something the user can check for themselves in one glance.
 */
export const REGISTER_PAIRS: Record<string, string> = {
  "thank you": "thanks",
  "good night": "night",
  "good morning": "morning",
  "good evening": "evening",
  "good afternoon": "afternoon",
  "you're welcome": "no worries",
  "youre welcome": "no worries",
  "i appreciate it": "thanks",
  "i appreciate that": "thanks",
  "much appreciated": "thanks",
};

interface Ctx {
  all: Message[];
  them: Message[];
  you: Message[];
  themText: string;
  youText: string;
  s: SignalSummary;
  context: ContextId;
}

function gather(msgs: Message[], patterns: Pattern[], why?: string): Evidence[] {
  const out: Evidence[] = [];
  for (const m of msgs) {
    for (const hit of matchAll(m.text, patterns)) {
      out.push({ messageId: m.id, span: hit.span, why: why ?? hit.why });
    }
  }
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.messageId) ? false : (seen.add(e.messageId), true)));
}

/** density = hits per 100 words, scaled into 0–1, shrunk by sample weight. */
function density(hits: number, totalWords: number, perHundred: number, s: SignalSummary): number {
  if (!totalWords) return 0;
  const raw = ((hits / totalWords) * 100) / perHundred;
  return clamp01(raw) * (0.55 + 0.45 * s.sampleWeight);
}

/** Questions asked by one side that the other never engaged with. */
export function unansweredQuestions(all: Message[]): Message[] {
  const out: Message[] = [];
  for (let i = 0; i < all.length; i++) {
    const m = all[i];
    if (!isQuestion(m.text)) continue;
    const reply = all[i + 1];
    if (!reply || reply.speaker === m.speaker) continue;
    const asked = new Set(
      m.text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 4)
    );
    const overlap = reply.text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .some((w) => asked.has(w));
    if (!overlap && wordCount(reply.text) < Math.max(6, wordCount(m.text) * 0.6)) out.push(m);
  }
  return out;
}

const CONTEXT_POOLS: Record<ContextId, CategoryId[]> = {
  dating: ["fade_markers"],
  work: ["professionalism", "deadline_pressure", "accountability_shift"],
  family: ["guilt", "boundary_pressure"],
  friendship: ["fade_markers"],
  other: [],
};

const CORE: CategoryId[] = [
  "engagement", "warmth_distance", "closure", "bid_response", "reciprocity", "mirroring",
  "affect", "sincerity", "power", "evasion", "subtext_load", "pressure", "stress", "attachment",
];

export function scoreCategories(t: Transcript, context: ContextId, s: SignalSummary): CategoryScore[] {
  const all = t.messages;
  const them = all.filter((m) => m.speaker === "them");
  const you = all.filter((m) => m.speaker === "you");
  const ctx: Ctx = {
    all,
    them,
    you,
    themText: them.map((m) => m.text).join(" "),
    youText: you.map((m) => m.text).join(" "),
    s,
    context,
  };

  const selected = new Set<CategoryId>([...CORE, ...CONTEXT_POOLS[context]]);
  return (
    ALL_BUILDERS.filter((b) => selected.has(b.id))
      .map((b) => b.build(ctx))
      .filter((c): c is CategoryScore => c !== null)
      // ── LAW 2, ENFORCED BY CONSTRUCTION ──
      // A score the user cannot click through to a line is not shown. Every
      // builder attaches a fallback for the structural case, so reaching this
      // filter means something genuinely has nothing behind it — and the
      // correct response to that is silence, not a bar.
      .filter((c) => c.percent < 12 || c.evidence.length > 0)
      .sort((a, b) => b.percent - a.percent)
  );
}

interface Builder {
  id: CategoryId;
  /** null = this metric cannot be supported by this sample; do not report it. */
  build: (c: Ctx) => CategoryScore | null;
}

// ── helpers shared across builders ───────────────────────────

const themTurns = (c: Ctx) => c.s.turns.filter((x) => x.speaker === "them");
const yourBids = (c: Ctx) => c.s.bids.filter((b) => b.by === "you");

function closingEvidence(c: Ctx): Evidence[] {
  const out: Evidence[] = [];
  for (const m of c.all) {
    const hit = matchAll(m.text, CLOSING_MOVES)[0];
    if (hit) out.push({ messageId: m.id, span: hit.span, why: hit.why });
  }
  const cont: Evidence[] = [];
  for (const m of c.all) {
    const hit = matchAll(m.text, CONTINUATION_BIDS)[0];
    if (hit) cont.push({ messageId: m.id, span: hit.span, why: hit.why });
  }
  return [...out, ...cont].slice(0, 4);
}

/** "“thank you” rather than “thanks”" — the register choice, named in full. */
function registerPairPhrases(text: string): string[] {
  const out: string[] = [];
  for (const hit of matchAll(text, POLITENESS_FULL)) {
    const key = hit.span.toLowerCase().replace(/[’]/g, "'");
    const casual = REGISTER_PAIRS[key];
    if (casual && !out.some((o) => o.includes(`“${key}”`))) {
      out.push(`“${key}” rather than “${casual}”`);
    }
  }
  return out.slice(0, 3);
}

const listOf = (xs: string[]) =>
  xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/**
 * Law 2's escape hatch, and the only one there is.
 *
 * Several v2 categories score from STRUCTURE — a register gap, a bid outcome,
 * a closing position — and structure has no lexicon span to highlight. Rather
 * than render an uncitable number, each of those categories names the turn the
 * structure was computed from. The user can still click through to a line and
 * see what the engine was looking at, which is the whole point of the law.
 */
function orFallback(ev: Evidence[], msgs: Message[], why: string, n = 2): Evidence[] {
  if (ev.length) return ev;
  return msgs.slice(0, n).map((m) => ({ messageId: m.id, span: m.text.slice(0, 60), why }));
}

/** The turn with the highest formality — what a register-gap score is pointing at. */
function mostFormal(c: Ctx): Message[] {
  const ranked = c.s.turns
    .filter((x) => x.speaker === "them")
    .slice()
    .sort((a, b) => b.formality - a.formality);
  const top = ranked[0];
  const msg = top ? c.them.find((m) => m.id === top.messageId) : undefined;
  return msg ? [msg] : c.them.slice(0, 1);
}

// ─────────────────────────────────────────────────────────────

const ALL_BUILDERS: Builder[] = [
  // ── CLOSING VS CONTINUING ──────────────────────────────────
  // New in v2, and for short exchanges it is usually the loudest signal in
  // the room. Brevity is weak evidence; a sign-off is strong evidence.
  {
    id: "closure",
    build: (c) => {
      const { closingIndex, continuationIndex, lastSpeaker } = c.s;
      const value = clamp01(closingIndex - continuationIndex * 0.45);
      const lastTurn = c.s.turns[c.s.turns.length - 1];
      const lastMsg = c.all[c.all.length - 1];
      const closerSpan = lastMsg ? matchAll(lastMsg.text, CLOSING_MOVES)[0]?.span : undefined;

      let read: string;
      if (c.s.mutualClose) {
        // Both sides signed off. Reading this as withdrawal is the single
        // easiest way for an engine like this to manufacture a problem.
        read = `Both of you sign off${closerSpan ? ` — “${closerSpan}” answers a goodbye rather than cutting one short` : ""}. The exchange ends by agreement, which is what a finished conversation looks like.`;
      } else if (value >= 0.55 && lastSpeaker === "them") {
        read = closerSpan
          ? `Their last message ends the exchange${lastTurn && lastTurn.substantiveWords === 0 ? " and contains nothing else" : ""} — “${closerSpan}” is a sign-off, not a reply that expects one back.`
          : "Their last message winds the exchange down rather than handing it back.";
      } else if (value >= 0.55) {
        read = "The exchange is being closed down, and you are the one closing it.";
      } else if (continuationIndex >= 0.45) {
        read = "The thread is being kept open — the last turns hand the floor back rather than retiring it.";
      } else {
        read = "Neither side is closing the exchange or actively extending it; it is simply running.";
      }

      const ev = closingEvidence(c);
      if (!ev.length && value < 0.2) return null;

      return {
        id: "closure",
        label: "Closing vs continuing",
        percent: pct(value),
        read,
        tier: "on-device",
        method: "sign-off and continuation-bid detection, weighted toward the final turns",
        tone: !c.s.mutualClose && value >= 0.55 && lastSpeaker === "them" ? "caution" : "neutral",
        evidence: ev,
        caveat:
          "Closing a conversation is not rejecting a person. People go to bed, get called away, and run out of battery. This measures the shape of the last turns, not a decision.",
      };
    },
  },

  // ── WARMTH VS DISTANCE ─────────────────────────────────────
  // The register-asymmetry category. Reading the GAP between two people's
  // formality is what lets the engine see a polite reply as distant without
  // ever calling it cold.
  {
    id: "warmth_distance",
    build: (c) => {
      const s = c.s;
      const tt = themTurns(c);
      const themWarm = tt.reduce((a, x) => a + x.warm, 0);
      const themDistant = tt.reduce((a, x) => a + x.distant, 0);
      const refRate = tt.length ? tt.filter((x) => x.refersToOther).length / tt.length : 0.5;

      let d = 0;
      d += clamp01(Math.max(0, s.politenessAsymmetry) / 0.45) * 0.3;
      d += s.softClose ? 0.22 : 0;
      d += themDistant > themWarm ? 0.12 : themWarm > themDistant ? -0.14 : 0.04;
      d += (1 - refRate) * 0.16;
      d += s.enthusiasmOnClosingOnly ? 0.08 : 0;
      const value = clamp01(d);

      const pairs = registerPairPhrases(c.themText);
      const parts: string[] = [];
      if (s.politenessAsymmetry >= 0.15 && pairs.length) {
        parts.push(
          `They answer in a more formal register than the one you used — ${listOf(pairs)}. Choosing the polite form over the familiar one is one of the quieter ways distance shows up in text.`
        );
      } else if (s.politenessAsymmetry >= 0.15) {
        parts.push("Their register sits noticeably more formal than yours across the exchange.");
      }
      if (refRate === 0 && tt.length) {
        parts.push("Once the fixed politeness phrases are set aside, their messages never refer to you.");
      }
      if (s.enthusiasmOnClosingOnly) {
        parts.push("The one exclamation mark lands on the sign-off, not on anything they said about you.");
      }
      if (themWarm > themDistant) {
        parts.push("Explicit warmth markers are present on their side.");
      }
      if (!parts.length) {
        parts.push(
          value >= 0.5
            ? "Their side leans toward the agreeable-but-uninviting register: correct, and carrying no opening."
            : "Register is broadly matched between you; neither side is holding the other at arm's length."
        );
      }

      const evidence: Evidence[] = orFallback(
        [
          ...gather(c.them, POLITENESS_FULL, "full-form politeness where the familiar form was available"),
          ...gather(c.them, DISTANCE),
          ...gather(c.them, WARMTH),
        ].slice(0, 4),
        mostFormal(c),
        "their most formal turn — the register gap is measured from this",
        1
      );

      return {
        id: "warmth_distance",
        label: "Warmth vs distance",
        percent: pct(value),
        read: parts.join(" "),
        tier: "on-device",
        method: "register asymmetry between the two speakers, plus warmth/distance markers",
        tone: value >= 0.55 ? "caution" : themWarm > themDistant ? "warm" : "neutral",
        evidence,
        caveat:
          "Formality is a habit as often as it is a message. Some people write to everyone the same way. What this measures is the GAP between how you wrote and how they answered — and a gap has many causes.",
      };
    },
  },

  // ── BIDS AND HOW THEY LANDED ───────────────────────────────
  // Gottman's frame, adapted for text: a bid is any turn that invites
  // connection, and the only things that can happen to it are being met,
  // being received without being met, being missed, or being rebuffed.
  {
    id: "bid_response",
    build: (c) => {
      const bids = c.s.bids;
      if (!bids.length) return null;
      const mine = yourBids(c);
      // Score the side the read is about. Averaging your unmet bids together
      // with their met ones produces a number that describes nobody.
      const focus = mine.length ? mine : bids;
      const met = bidsMetScore(focus);
      if (met === null) return null;

      const first = focus[0];
      const toward = focus.filter((b) => b.response === "toward").length;
      const whose = first.by === "you" ? "You made" : "They made";

      let read: string;
      if (focus.length === 1) {
        read = `${whose} one bid for connection — ${BID_LABEL[first.kind]}. It was ${first.response ? first.note : "left without a reply"}.`;
      } else {
        read = `${whose} ${focus.length} bids for connection; ${toward} ${toward === 1 ? "was" : "were"} met and extended. The first was ${BID_LABEL[first.kind]} — ${first.note}.`;
      }

      const evidence: Evidence[] = focus.slice(0, 4).map((b) => ({
        messageId: b.messageId,
        span: b.span,
        why: `${BID_LABEL[b.kind]} — ${b.note}`,
      }));

      return {
        id: "bid_response",
        label: "Bids met",
        percent: pct(met),
        read,
        tier: "on-device",
        method: "bid detection, then turn-toward / minimal / turn-away classification of each reply",
        tone: met >= 0.6 ? "warm" : met <= 0.35 ? "caution" : "neutral",
        evidence,
        caveat:
          "This percentage is a proportion, not a confidence: the share of connection-bids in this exchange that were both acknowledged AND extended. A bid can be missed by someone who cares a great deal and is looking at their phone in a queue.",
      };
    },
  },

  // ── ENGAGEMENT ─────────────────────────────────────────────
  {
    id: "engagement",
    build: (c) => {
      const s = c.s;
      const tt = themTurns(c);
      const met = bidsMetScore(s.bids.filter((b) => b.by === "you"));
      const ratio = s.youWords ? Math.min(s.themWords / s.youWords, 1.2) / 1.2 : 0.5;
      const refRate = tt.length ? tt.filter((x) => x.refersToOther).length / tt.length : 0.5;
      const themQ = tt.filter((x) => x.isQuestion).length;
      const askBack = tt.length ? Math.min(themQ / Math.max(tt.length * 0.4, 1), 1) : 0;

      // TWO TIERS, and the split matters.
      //
      // The BASE is what engagement actually is: bids met, turns taken up,
      // words invested. The BONUS is behaviour that indicates engagement when
      // present but whose absence proves nothing — nobody asks a question
      // back or says "you" while agreeing a time, and an earlier version of
      // this formula scored a completely healthy logistics exchange as
      // disengaged because it treated those absences as evidence.
      const base = (met ?? s.uptakeRate) * 0.42 + s.uptakeRate * 0.28 + ratio * 0.15;
      const bonus = s.continuationIndex * 0.08 + refRate * 0.04 + askBack * 0.08;
      let value = base + bonus;

      // Latency, only when the paste actually carried timestamps on both sides.
      if (s.latency.them !== null && s.latency.you !== null && s.latency.you > 0) {
        value -= clamp01(s.latency.them / (s.latency.you * 4)) * 0.08;
      }
      value = clamp01(value);

      const notable = c.them.filter((m) => isQuestion(m.text) || wordCount(m.text) > 18);
      const basis = notable.length
        ? notable
        : c.them.slice().sort((a, b) => wordCount(a.text) - wordCount(b.text));
      const evidence: Evidence[] = basis.slice(0, 3).map((m) => ({
        messageId: m.id,
        span: m.text.slice(0, 60),
        why: isQuestion(m.text)
          ? "asks a question back"
          : wordCount(m.text) > 18
            ? "invests length in the reply"
            : "one of their shortest replies — this is what the low score is counting",
      }));

      let read: string;
      if (s.softClose) {
        read =
          "A bid was answered politely and the conversation was ended in the same message. Politeness and engagement are different things, and this reply has the first without the second.";
      } else if (value >= 0.6) {
        read = "They meet what you open and add to it — questions come back and the thread is carried from both ends.";
      } else if (value >= 0.35) {
        read = "They answer, but they mostly receive rather than extend: the momentum is coming from your side.";
      } else {
        read = "Very little on their side extends anything you opened — no questions back, and nothing added to what you raised.";
      }

      return {
        id: "engagement",
        label: "Engagement / interest",
        percent: pct(value),
        read,
        tier: "on-device",
        method:
          "bid-response rate, continuation bids, reciprocal asking, investment ratio" +
          (s.latency.them !== null ? ", reply latency" : ""),
        tone: value >= 0.6 ? "warm" : value <= 0.3 ? "caution" : "neutral",
        evidence,
        caveat:
          "Behaviour is not feeling. Low engagement can be circumstance — busy, tired, distracted, or asleep. This measures the observable exchange, never their interest.",
      };
    },
  },

  // ── RECIPROCITY ────────────────────────────────────────────
  {
    id: "reciprocity",
    build: (c) => {
      const mine = yourBids(c);
      const returned = mine.filter((b) => b.response === "toward").length;
      const recip = mine.length ? returned / mine.length : null;
      const themQ = themTurns(c).filter((x) => x.isQuestion).length;
      const youQ = c.s.turns.filter((x) => x.speaker === "you" && x.isQuestion).length;
      // BALANCE, not share. Reciprocity asks "does this travel both ways", so
      // one side asking every question scores 0 whichever side that is.
      const qBalance = themQ + youQ ? 1 - Math.abs(themQ - youQ) / (themQ + youQ) : 0.5;
      const value = clamp01((recip ?? qBalance) * 0.7 + qBalance * 0.3);

      const missed = c.s.unreciprocated;
      let read: string;
      if (missed.length) {
        const kinds = [...new Set(missed)].map((k) => BID_LABEL[k].replace(/^(a|an) /, ""));
        read = `The ${listOf(kinds)} went out and did not come back${themQ === 0 ? ", and nothing was asked in return" : ""}.`;
      } else if (value >= 0.55) {
        read = "What each of you puts in comes back — questions, disclosures and warmth all travel in both directions.";
      } else {
        read = `You asked ${youQ} question${youQ === 1 ? "" : "s"}; they asked ${themQ}.`;
      }

      const evidence: Evidence[] = orFallback(
        mine.slice(0, 3).map((b) => ({
          messageId: b.messageId,
          span: b.span,
          why: b.response === "toward" ? "this one came back" : b.note,
        })),
        [
          ...c.them.filter((m) => isQuestion(m.text)),
          ...c.you.filter((m) => isQuestion(m.text)),
          ...c.them,
        ],
        "counts toward the question balance between the two of you",
        2
      );

      return {
        id: "reciprocity",
        label: "Reciprocity",
        percent: pct(value),
        read,
        tier: "on-device",
        method: "whether each bid was returned in kind, plus question balance",
        tone: value >= 0.55 ? "warm" : value <= 0.25 ? "caution" : "neutral",
        evidence,
        caveat: "Counts moves, not care. Reciprocity is a rhythm, and rhythms have off-beats.",
      };
    },
  },

  // ── MIRRORING / STYLE MATCHING ─────────────────────────────
  // Reported ONLY when there is enough text to support it. Below the
  // threshold this returns null and the category simply does not appear —
  // which is the honest behaviour, and the one v1 did not have.
  {
    id: "mirroring",
    build: (c) => {
      const lsm = c.s.lsm;
      if (lsm === null) return null;
      const value = clamp01(lsm);
      return {
        id: "mirroring",
        label: "Style matching",
        percent: pct(value),
        read:
          value >= 0.85
            ? "The two of you are writing in step — sentence shape, pronoun use and rhythm track each other closely, which is what accommodation looks like from the outside."
            : value >= 0.7
              ? "Moderate style matching: you are in the same conversation but not writing in the same key."
              : "Your writing styles are diverging — different rhythm, different pronoun habits, different amount of scaffolding around each point.",
        tier: "on-device",
        method: "Language Style Matching across nine function-word families (Ireland & Pennebaker's method)",
        tone: value >= 0.85 ? "warm" : value <= 0.6 ? "caution" : "neutral",
        evidence: c.them.slice(0, 2).map((m) => ({
          messageId: m.id,
          span: m.text.slice(0, 60),
          why: "sampled for function-word rate",
        })),
        caveat:
          "Style matching happens below conscious control, which is what makes it interesting and also what makes it easy to over-read. It tracks accommodation, not affection.",
      };
    },
  },

  // ── AFFECT ─────────────────────────────────────────────────
  {
    id: "affect",
    build: (c) => {
      const tt = themTurns(c);
      const warm = tt.reduce((a, x) => a + x.warm, 0);
      const irr = matchAll(c.themText, IRRITATION).length;
      const enth = tt.reduce((a, x) => a + x.enthusiasm, 0);
      const intens = tt.reduce((a, x) => a + x.intensifiers, 0);
      const value = clamp01(
        density(warm * 2 + irr * 2 + enth + intens, wordCount(c.themText), 3, c.s) * 0.8 +
          (warm + irr ? 0.15 : 0)
      );
      const leaning =
        warm > irr ? "warmth" : irr > warm ? "irritation" : enth ? "surface brightness" : "flat tone";

      let read = `The language carries markers of ${leaning}${warm && irr ? " — both are present in the same thread" : ""}.`;
      if (c.s.enthusiasmOnClosingOnly) {
        read +=
          " The brightness sits on the sign-off rather than on anything they said to you, which is a different thing from being pleased.";
      }

      return {
        id: "affect",
        label: "Emotional tone",
        percent: pct(value),
        read,
        tier: "on-device",
        method: "valence and intensifier density, plus where the enthusiasm markers land",
        tone: warm > irr ? "warm" : irr > warm ? "caution" : "neutral",
        evidence: [
          ...gather(c.them, warm >= irr ? WARMTH : IRRITATION),
          ...gather(c.them, ENTHUSIASM).slice(0, 2),
          ...gather(c.them, INTENSIFIERS).slice(0, 1),
        ].slice(0, 4),
        caveat:
          "This reads tone in text, not the person's internal state. Text hides a great deal — flat writing is not a flat mood.",
      };
    },
  },

  // ── PERFORMATIVITY ─────────────────────────────────────────
  {
    id: "sincerity",
    build: (c) => {
      const tt = themTurns(c);
      const perf = matchAll(c.themText, PERFORMATIVE).length;
      // A message made entirely of courtesy formula with zero propositional
      // content is the purest case of register doing the work of content.
      const bareCourtesy = tt.filter((x) => {
        if (x.substantiveWords > 0) return false;
        const msg = c.them.find((m) => m.id === x.messageId);
        return Boolean(msg && (matchAll(msg.text, POLITENESS_FULL).length > 0 || x.closing > 0));
      }).length;
      const bareShare = tt.length ? bareCourtesy / tt.length : 0;
      const value = clamp01(density(perf, wordCount(c.themText), 1.4, c.s) * 0.5 + bareShare * 0.55);

      return {
        id: "sincerity",
        label: "Formula over content",
        percent: pct(value),
        read:
          bareShare >= 0.5
            ? `${bareCourtesy === tt.length && tt.length === 1 ? "Their whole reply is" : `${bareCourtesy} of their messages are`} courtesy formula with no content of their own — the phrasing is doing the work that specifics usually do.`
            : value >= 0.4
              ? "The register leans formulaic — stock phrases where specifics would normally sit."
              : "Mostly specific, unscripted phrasing.",
        tier: "on-device",
        method: "share of turns that are pure courtesy formula, plus scripted-phrase density",
        tone: value >= 0.45 ? "caution" : "neutral",
        evidence: orFallback(
          [
            ...gather(c.them, PERFORMATIVE),
            ...gather(c.them, POLITENESS_FULL, "courtesy formula standing in place of content"),
          ].slice(0, 3),
          c.them.filter((m) => {
            const turn = tt.find((x) => x.messageId === m.id);
            return Boolean(turn && turn.substantiveWords === 0);
          }),
          "a turn carrying no propositional content — form without content is what this counts",
          2
        ),
        caveat:
          "Fluent politeness can read as performed and be entirely sincere. This is a register signal, and it is never a verdict on whether someone means what they wrote.",
      };
    },
  },

  // ── POWER / BALANCE ────────────────────────────────────────
  {
    id: "power",
    build: (c) => {
      const s = c.s;
      const lengthLead = s.themWords + s.youWords ? s.themWords / (s.themWords + s.youWords) : 0.5;
      const themQ = themTurns(c).filter((x) => x.isQuestion).length;
      const youQ = s.turns.filter((x) => x.speaker === "you" && x.isQuestion).length;
      const questionLead = themQ + youQ ? themQ / (themQ + youQ) : 0.5;
      const lastTurn = s.turns[s.turns.length - 1];
      // Closing control counts only when the close is one-sided. When both
      // people sign off, nobody took the decision away from anybody.
      const closeControl = s.mutualClose
        ? 0.5
        : lastTurn && lastTurn.speaker === "them" && lastTurn.closing >= 0.45
          ? 1
          : s.lastSpeaker === "them"
            ? 0.5
            : 0;
      const themBids = s.bids.filter((b) => b.by === "them").length;
      const initiation = s.bids.length ? themBids / s.bids.length : 0.5;

      const value = clamp01(
        lengthLead * 0.25 + questionLead * 0.2 + closeControl * 0.35 + initiation * 0.2
      );

      let read: string;
      if (closeControl === 1 && !s.mutualClose) {
        read =
          "They decided when the exchange stopped. Whoever ends a conversation is setting its terms, whatever the wording is.";
      } else if (value >= 0.6) {
        read = "They are driving: setting topics, asking more, and choosing when threads end.";
      } else if (value >= 0.4) {
        read = "The exchange is broadly balanced — neither side is steering it.";
      } else {
        read = "You are driving the exchange; they are accommodating rather than directing.";
      }

      return {
        id: "power",
        label: "Who is steering",
        percent: pct(value),
        read,
        tier: "on-device",
        method: "topic initiation, question lead, length share, and who closes",
        tone: "neutral",
        evidence: (c.them.length ? c.them : c.all).slice(0, 2).map((m) => ({
          messageId: m.id,
          span: m.text.slice(0, 60),
          why: "counts toward initiation, length share and closing control",
        })),
        caveat:
          "This describes conversational structure only. It says nothing about real-world power between you.",
      };
    },
  },

  // ── EVASION ────────────────────────────────────────────────
  {
    id: "evasion",
    build: (c) => {
      const hedges = matchAll(c.themText, HEDGES).length;
      const dist = matchAll(c.themText, DISTANCING).length;
      const defl = matchAll(c.themText, DEFLECTION).length;
      const unanswered = unansweredQuestions(c.all).filter((m) => m.speaker === "you");
      const selfRef = matchAll(c.themText, SELF_REFERENCE).length;
      const total = wordCount(c.themText) || 1;
      const lowFirstPerson = total >= 30 && selfRef / total < 0.03 ? 0.15 : 0;
      const value = clamp01(
        density(hedges + dist * 2 + defl * 2, total, 2.4, c.s) * 0.6 +
          Math.min(unanswered.length * 0.16, 0.5) +
          lowFirstPerson
      );
      const evidence = [
        ...gather(c.them, [...DISTANCING, ...DEFLECTION]),
        ...unanswered.map((m) => ({
          messageId: m.id,
          span: m.text.slice(0, 60),
          why: "you asked this and the next message did not engage with it",
        })),
        ...gather(c.them, HEDGES).slice(0, 2),
      ].slice(0, 4);
      const evidenceOrFallback = orFallback(
        evidence,
        c.them,
        "sampled for first-person rate — this score partly counts how rarely they speak for themselves",
        1
      );

      return {
        id: "evasion",
        label: "Evasion markers",
        percent: pct(value),
        read:
          value >= 0.45
            ? `Several evasion-associated patterns are present${unanswered.length ? `, including ${unanswered.length} question${unanswered.length > 1 ? "s" : ""} that went unanswered` : ""}.`
            : "Few evasion-associated patterns in this exchange.",
        tier: "on-device",
        method: "hedging and distancing density, plus questions raised and dropped",
        tone: value >= 0.45 ? "caution" : "neutral",
        evidence: evidenceOrFallback,
        caveat:
          "This is not a deception detector and cannot be one. These markers correlate weakly with evasion and are heavily context-dependent. The percentage means “markers of this kind are present in the text” — it is never a claim about anyone's truthfulness.",
      };
    },
  },

  // ── SUBTEXT LOAD ───────────────────────────────────────────
  {
    id: "subtext_load",
    build: (c) => {
      const s = c.s;
      const unanswered = unansweredQuestions(c.all);
      const fade = matchAll(c.themText, FADE).length;
      const value = clamp01(
        Math.min(unanswered.length * 0.16, 0.4) +
          density(fade, wordCount(c.themText), 2, s) * 0.3 +
          (s.softClose ? 0.4 : 0) +
          // a one-sided close leaves things unsaid; a mutual one does not
          (!s.mutualClose && s.closingIndex >= 0.6 && s.continuationIndex <= 0.2 ? 0.25 : 0)
      );

      let read: string;
      if (s.softClose) {
        read =
          "The reply is polite and almost entirely empty of propositional content. When a message says nothing, whatever it is communicating is being carried by its shape rather than its words — and that is what subtext means.";
      } else if (value >= 0.45) {
        read = "A noticeable amount is being left unsaid — dropped topics and deferrals without specifics.";
      } else {
        read = "Most of what is meant appears to be stated directly.";
      }

      return {
        id: "subtext_load",
        label: "How much is unsaid",
        percent: pct(value),
        read,
        tier: "on-device",
        method: "dropped topics, unbounded deferrals, and content-free turns",
        tone: "neutral",
        evidence: orFallback(
          [
            ...unanswered.map((m) => ({
              messageId: m.id,
              span: m.text.slice(0, 60),
              why: "raised and then dropped",
            })),
            ...gather(c.them, FADE),
            ...(s.softClose
              ? c.them.slice(-1).map((m) => ({
                  messageId: m.id,
                  span: m.text.slice(0, 60),
                  why: "a reply with no content of its own",
                }))
              : []),
          ].slice(0, 4),
          c.them.slice(-1),
          "the turn the exchange ends on — this is where the unsaid weight sits",
          1
        ),
        caveat: "A high subtext load is not evidence of bad intent. Some people are simply indirect.",
      };
    },
  },

  // ── PRESSURE ───────────────────────────────────────────────
  {
    id: "pressure",
    build: (c) => {
      const hits = matchAll(c.themText, PRESSURE);
      const value = clamp01(hits.length * 0.24);
      return {
        id: "pressure",
        label: "Pressure / obligation markers",
        percent: pct(value),
        read: hits.length
          ? "Language associated with obligation or urgency pressure is present in this exchange."
          : "No obligation-pressure patterns detected.",
        tier: "on-device",
        method: "obligation, urgency, consensus and reality-contest phrasings",
        tone: hits.length ? "caution" : "neutral",
        evidence: gather(c.them, PRESSURE),
        caveat:
          "Pattern-matching, not intent-reading. This flags language for your awareness; it does not accuse the other person of anything.",
      };
    },
  },

  // ── STRAIN ─────────────────────────────────────────────────
  {
    id: "stress",
    build: (c) => {
      const hits = matchAll(c.themText, STRESS);
      const frag = c.them.filter((m) => wordCount(m.text) <= 3).length;
      const value = clamp01(
        density(hits.length, wordCount(c.themText), 2, c.s) * 0.7 + Math.min(frag * 0.07, 0.25)
      );
      return {
        id: "stress",
        label: "Strain markers",
        percent: pct(value),
        read:
          value >= 0.4
            ? "Absolutist and strain-associated language appears more than once."
            : "Little strain-associated language.",
        tier: "on-device",
        method: "explicit strain vocabulary and absolutist phrasing",
        tone: value >= 0.4 ? "caution" : "neutral",
        evidence: orFallback(
          gather(c.them, STRESS),
          c.them.filter((m) => wordCount(m.text) <= 3),
          "a turn of three words or fewer — clipped replies are what the rest of this score is counting",
          2
        ),
        caveat:
          "Markers only — this is not a mental-health assessment and cannot be one. If you are worried about someone, ask them.",
      };
    },
  },

  // ── INVESTMENT ─────────────────────────────────────────────
  {
    id: "attachment",
    build: (c) => {
      const tt = themTurns(c);
      const warm = tt.reduce((a, x) => a + x.warm, 0);
      // FUTURE_ANCHOR, not the looser continuation list: "Thursday" is
      // investment, "this week is insane" is not, and counting the second as
      // the first is how the engine briefly read a slow fade as commitment.
      const future = matchAll(c.themText, FUTURE_ANCHOR).length;
      // A future reference inside a wind-down is a deferral, not a plan.
      // "Monday is fine" points at a date and away from the conversation.
      const damped = 1 - c.s.closingIndex * 0.7;
      const value = clamp01(
        (density(future * 2 + warm * 2, wordCount(c.themText), 3, c.s) * 0.7 +
          (future && warm ? 0.15 : 0)) *
          damped
      );
      return {
        id: "attachment",
        label: "Investment signals",
        percent: pct(value),
        read:
          value >= 0.45
            ? "Shared-frame language and concrete future references are present on their side."
            : "Little future-tense or shared-frame language on their side — nothing points past this conversation.",
        tier: "on-device",
        method: "concrete future anchoring and warmth markers on their side",
        tone: value >= 0.45 ? "warm" : "neutral",
        evidence: gather(c.them, [...FUTURE_ANCHOR, ...WARMTH]).slice(0, 3),
        caveat: "Presence of signals, not a measure of the relationship's health.",
      };
    },
  },

  // ── CONTEXT POOLS ──────────────────────────────────────────
  {
    id: "fade_markers",
    build: (c) => {
      const hits = matchAll(c.themText, FADE);
      const value = clamp01(hits.length * 0.28);
      return {
        id: "fade_markers",
        label: "Fade markers",
        percent: pct(value),
        read: hits.length
          ? "Unbounded deferrals — plans referenced without a date attached."
          : "No unbounded deferrals detected.",
        tier: "on-device",
        method: "deferral phrasings with no specific time attached",
        tone: hits.length ? "caution" : "neutral",
        evidence: gather(c.them, FADE),
        caveat: "People are genuinely busy. This counts the shape of the phrasing, nothing more.",
      };
    },
  },
  {
    id: "professionalism",
    build: (c) => {
      const hits = matchAll(c.themText, PROFESSIONAL);
      return {
        id: "professionalism",
        label: "Formal register",
        percent: pct(density(hits.length, wordCount(c.themText), 1.6, c.s)),
        read: hits.length
          ? "The register is formal — a shift toward formality can mark distance as easily as respect."
          : "Informal register throughout.",
        tier: "on-device",
        method: "professional-register vocabulary density",
        tone: "neutral",
        evidence: gather(c.them, PROFESSIONAL),
        caveat: "Formality is a register choice, not a verdict on the relationship.",
      };
    },
  },
  {
    id: "deadline_pressure",
    build: (c) => {
      const hits = matchAll(c.themText, DEADLINE_PRESSURE);
      return {
        id: "deadline_pressure",
        label: "Deadline pressure",
        percent: pct(clamp01(hits.length * 0.26)),
        read: hits.length ? "Schedule-pressure language is present." : "No schedule-pressure language.",
        tier: "on-device",
        method: "schedule and escalation vocabulary",
        tone: hits.length ? "caution" : "neutral",
        evidence: gather(c.them, DEADLINE_PRESSURE),
        caveat: "Urgency in wording is not the same as urgency in fact.",
      };
    },
  },
  {
    id: "accountability_shift",
    build: (c) => {
      const hits = matchAll(c.themText, ACCOUNTABILITY_SHIFT);
      return {
        id: "accountability_shift",
        label: "Accountability shift",
        percent: pct(clamp01(hits.length * 0.3)),
        read: hits.length
          ? "Agentless phrasing around a failure — the thing went wrong, but nobody did it."
          : "Responsibility is stated with an actor attached.",
        tier: "on-device",
        method: "agentless and responsibility-relocating constructions",
        tone: hits.length ? "caution" : "neutral",
        evidence: gather(c.them, ACCOUNTABILITY_SHIFT),
        caveat: "Passive phrasing is a common professional habit, not proof of avoidance.",
      };
    },
  },
  {
    id: "guilt",
    build: (c) => {
      const hits = matchAll(c.themText, GUILT);
      return {
        id: "guilt",
        label: "Guilt / obligation framing",
        percent: pct(clamp01(hits.length * 0.29)),
        read: hits.length
          ? "Self-effacing or debt-claiming phrasing that invites reassurance."
          : "No guilt-framing patterns detected.",
        tier: "on-device",
        method: "martyr framing and explicit debt claims",
        tone: hits.length ? "caution" : "neutral",
        evidence: gather(c.them, GUILT),
        caveat: "Some people simply talk this way. Flagged for your awareness, not as an accusation.",
      };
    },
  },
  {
    id: "boundary_pressure",
    build: (c) => {
      const hits = matchAll(c.themText, BOUNDARY_PRESSURE);
      return {
        id: "boundary_pressure",
        label: "Boundary pressure",
        percent: pct(clamp01(hits.length * 0.32)),
        read: hits.length
          ? "A stated limit is being minimised or worked around."
          : "No boundary-minimising language detected.",
        tier: "on-device",
        method: "limit-minimising and consent-assuming phrasings",
        tone: hits.length ? "caution" : "neutral",
        evidence: gather(c.them, BOUNDARY_PRESSURE),
        caveat: "Language only. Whether a limit was actually crossed is yours to judge.",
      };
    },
  },
];
