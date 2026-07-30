// ═════════════════════════════════════════════════════════════
// THE SIGNAL LAYER — Subtext engine v2.
//
// WHY THIS FILE EXISTS.
// v1 counted things: reply length, question marks, lexicon hits. Counting is
// cheap and it is also why v1 answered "about 49%" to almost every question.
// A conversation is not a bag of words; it is a sequence of MOVES. This layer
// reads the moves, and the category scores in `categories.ts` are computed
// from it rather than from raw counts.
//
// The canonical case, and the one that drove the rewrite:
//
//     You:  You looked amazing today
//     Them: thank you, good night!
//
// Every count-based metric reads that as neutral-to-warm. It contains a
// politeness token, an exclamation mark, no negativity, no hedging. v1 said
// 49%. What is actually happening is legible only as structure:
//
//   · turn 1 is a BID — a compliment, one of the most exposed kinds
//   · turn 2 ACKNOWLEDGES it and adds nothing (0 substantive words)
//   · turn 2 answers an intimate register in a FORMAL one
//     ("thank you" not "thanks"; "good night" not "night")
//   · turn 2 is a CLOSING MOVE and it is the last turn
//   · the compliment is not reciprocated and nothing is asked back
//   · the single enthusiasm marker sits on the sign-off, not on the content
//
// Six independent structural signals, all pointing the same way, in eleven
// words. That is what this file extracts.
//
// EVERYTHING HERE IS LOCAL. No network, no model, no key. This runs in the
// browser and always will — it is the free tier and it is also what makes
// "your conversation never touches our server" architecturally true.
// ═════════════════════════════════════════════════════════════

import type {
  BidEvent,
  BidKind,
  BidResponse,
  Message,
  SignalSummary,
  Speaker,
  Transcript,
  TurnSignal,
} from "./types";
import {
  AFFIRM, BID_AFFECTION, BID_COMPLIMENT, BID_HELP, BID_INVITATION, BID_NEWS, BID_SELF_DISCLOSURE,
  CLOSING_MOVES, COMMITMENT, CONTINUATION_BIDS, DEFLECTION, DISTANCE, ENTHUSIASM,
  FIXED_POLITE_PHRASES, FUNCTION_WORD_FAMILIES, HEDGES, INTENSIFIERS, IRRITATION, OTHER_REFERENCE,
  POLITENESS_CASUAL, POLITENESS_FULL, PROFESSIONAL, WARMTH, matchAll, type Pattern,
} from "./lexicons";

// ── small helpers ────────────────────────────────────────────

export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
export const isQuestion = (s: string) => /\?/.test(s);

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Remove every span matched by `patterns`, so the remainder can be measured. */
function strip(text: string, patterns: Pattern[]): string {
  let out = text;
  for (const hit of matchAll(text, patterns)) {
    out = out.split(hit.span).join(" ");
  }
  return out;
}

function stripPhrases(text: string, phrases: string[]): string {
  let out = text;
  for (const phrase of phrases) {
    out = out.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  return out;
}

const STOPWORDS = new Set([
  "this", "that", "with", "have", "will", "your", "yours", "from", "they", "them", "been",
  "were", "what", "when", "there", "about", "would", "could", "should", "just", "like",
  "really", "thing", "things", "know", "think", "going", "gonna", "still", "much",
]);

/** Content-word overlap — the cheapest honest test of "did they engage the topic". */
function topicOverlap(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOPWORDS.has(w))
    );
  const A = words(a);
  if (!A.size) return false;
  for (const w of words(b)) if (A.has(w)) return true;
  return false;
}

// ── register / formality ─────────────────────────────────────

const ABBREVIATIONS =
  /\b(u|ur|rn|tbh|imo|idk|lol|lmao|haha+|hehe|omg|yeah|yea|nah|yep|nope|gonna|wanna|gotta|kinda|sorta|cuz|coz|pls|plz|dm)\b/gi;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|:\)|:\(|:D|;\)|<3/gu;

/**
 * 0 = intimate register, 1 = formal register.
 *
 * The measurement that matters is not the absolute value, it is the GAP
 * between two people in the same exchange. Two friends who both write like
 * lawyers are in step; one writing "you looked amazing today" and the other
 * answering "thank you, good night!" are not.
 */
export function formality(text: string): number {
  const t = text.trim();
  if (!t) return 0.5;

  const full = matchAll(t, POLITENESS_FULL).length;
  // full-form politeness is stripped before looking for casual forms, so
  // "good night" is not double-counted as the casual "night".
  const casualSource = strip(t, POLITENESS_FULL);
  const casual = matchAll(casualSource, POLITENESS_CASUAL).length;
  const professional = matchAll(t, PROFESSIONAL).length;
  const abbrevs = (casualSource.match(ABBREVIATIONS) ?? []).length;
  const emoji = (t.match(EMOJI) ?? []).length;

  let score = 0.5;
  score += Math.min(full, 3) * 0.22;
  score += Math.min(professional, 3) * 0.18;
  score -= Math.min(casual, 3) * 0.18;
  score -= Math.min(abbrevs, 4) * 0.06;
  score -= Math.min(emoji, 3) * 0.09;
  score += /^[A-Z]/.test(t) ? 0.06 : -0.06;
  score += /[.!?]$/.test(t) ? 0.05 : -0.05;
  // a bare lowercase "i" is one of the strongest informality tells in English
  score -= /\bi\b/.test(t) && !/\bI\b/.test(t) ? 0.07 : 0;

  return clamp01(score);
}

// ── closing vs continuing ────────────────────────────────────

/** 0–1: how hard this turn works to end the exchange. */
export function closingStrength(text: string): number {
  const hits = matchAll(text, CLOSING_MOVES).length;
  const terminalAck = matchAll(text, DISTANCE).some((h) => /acknowledgement/.test(h.why)) ? 1 : 0;
  if (!hits && !terminalAck) return 0;
  const substantive = substantiveWordCount(text);
  // a sign-off attached to real content is a soft close; a sign-off that IS
  // the whole message is a hard one.
  const bareness = substantive === 0 ? 1 : substantive <= 3 ? 0.75 : substantive <= 10 ? 0.5 : 0.3;
  return clamp01((hits * 0.55 + terminalAck * 0.35) * bareness + (hits ? 0.2 : 0));
}

/** 0–1: how hard this turn works to keep the exchange going. */
export function continuationStrength(text: string): number {
  const hits = matchAll(text, CONTINUATION_BIDS).length;
  const q = isQuestion(text) ? 1 : 0;
  const long = wordCount(text) >= 20 ? 1 : 0;
  return clamp01(hits * 0.28 + q * 0.45 + long * 0.15);
}

/**
 * Words that are neither politeness nor sign-off — i.e. what the turn actually
 * SAYS. "thank you, good night!" scores 0 here, and that single number is the
 * spine of the whole v2 read.
 */
export function substantiveWordCount(text: string): number {
  let t = stripPhrases(text, FIXED_POLITE_PHRASES);
  t = strip(t, POLITENESS_FULL);
  t = strip(t, POLITENESS_CASUAL);
  t = strip(t, CLOSING_MOVES);
  for (const hit of matchAll(text, DISTANCE)) {
    if (/acknowledgement/.test(hit.why)) t = t.split(hit.span).join(" ");
  }
  return t.replace(/[^a-zA-Z0-9\s']/g, " ").split(/\s+/).filter((w) => w.length > 1).length;
}

/** Does the turn refer to the other person once fixed politeness is removed? */
export function refersToOther(text: string): boolean {
  const stripped = stripPhrases(text, FIXED_POLITE_PHRASES);
  return matchAll(stripped, OTHER_REFERENCE).length > 0;
}

/**
 * Is every enthusiasm marker attached to the sign-off rather than to the
 * content? An exclamation mark on "good night!" is politeness; the same mark
 * on "you looked amazing!" is warmth. Same character, opposite meaning —
 * and position is the only thing that tells them apart.
 */
export function enthusiasmOnClosing(text: string): boolean {
  const closers = matchAll(text, CLOSING_MOVES);
  if (!closers.length) return false;
  const enth = matchAll(text, ENTHUSIASM);
  if (!enth.length) return false;

  const lower = text.toLowerCase();
  const firstCloser = Math.min(
    ...closers.map((c) => {
      const i = lower.indexOf(c.span.toLowerCase());
      return i < 0 ? text.length : i;
    })
  );
  return enth.every((e) => {
    const i = lower.indexOf(e.span.toLowerCase());
    return i < 0 || i >= firstCloser - 2;
  });
}

// ── bids ─────────────────────────────────────────────────────

const BID_DETECTORS: { kind: BidKind; patterns: Pattern[] }[] = [
  { kind: "compliment", patterns: BID_COMPLIMENT },
  { kind: "affection", patterns: BID_AFFECTION },
  { kind: "invitation", patterns: BID_INVITATION },
  { kind: "self_disclosure", patterns: BID_SELF_DISCLOSURE },
  { kind: "news_share", patterns: BID_NEWS },
  { kind: "help_request", patterns: BID_HELP },
];

/** The highest-stakes bid a turn makes, plus the span that shows it. */
export function detectBid(text: string): { kind: BidKind; span: string } | null {
  for (const d of BID_DETECTORS) {
    const hit = matchAll(text, d.patterns)[0];
    if (hit) return { kind: d.kind, span: hit.span };
  }
  if (isQuestion(text) && wordCount(text) >= 3) {
    const span = text.split(/(?<=\?)/)[0]?.trim() || text;
    return { kind: "question", span: span.slice(0, 70) };
  }
  return null;
}

const BID_WEIGHT: Record<BidKind, number> = {
  affection: 1,
  compliment: 0.95,
  self_disclosure: 0.9,
  invitation: 0.85,
  news_share: 0.7,
  help_request: 0.65,
  question: 0.5,
};

const RESPONSE_VALUE: Record<BidResponse, number> = {
  toward: 1,
  minimal: 0.3,
  away: 0.05,
  against: 0,
};

/**
 * Gottman's three-way classification, plus a fourth the original frame folds
 * into "toward" and text badly needs kept separate: MINIMAL.
 *
 *   toward   — acknowledged AND extended. The bid is met.
 *   minimal  — acknowledged and not extended. Polite, correct, and closed.
 *   away     — not engaged at all.
 *   against  — met with irritation or deflection.
 *
 * "minimal" is where almost all real-world hurt lives, because it looks
 * exactly like "toward" to anyone counting sentiment words.
 */
function classifyResponse(
  bidText: string,
  bidKind: BidKind | null,
  reply: Message
): { response: BidResponse; note: string } {
  const text = reply.text;
  const hostile = matchAll(text, IRRITATION).length + matchAll(text, DEFLECTION).length;
  const substantive = substantiveWordCount(text);
  const cont = continuationStrength(text);
  const close = closingStrength(text);
  const politeAck =
    matchAll(text, POLITENESS_FULL).length + matchAll(text, POLITENESS_CASUAL).length > 0;
  const affirms = matchAll(text, AFFIRM).length > 0;
  const commits = matchAll(text, COMMITMENT).length > 0;
  const reciprocated = bidKind !== null && detectBid(text)?.kind === bidKind;
  const overlap = topicOverlap(bidText, text);
  const acknowledged = politeAck || affirms || commits || overlap || reciprocated || refersToOther(text);
  const extended = reciprocated || cont >= 0.35 || substantive >= 6;

  if (hostile >= 1 && substantive <= 12) {
    return { response: "against", note: "met with a dismissal rather than an answer" };
  }
  if (!acknowledged) {
    return { response: "away", note: "the reply does not engage with it at all" };
  }
  if (extended) {
    return {
      response: "toward",
      note: reciprocated ? "met in kind — the same move came back" : "acknowledged and extended",
    };
  }
  if (close >= 0.5) {
    return {
      response: "minimal",
      note: `acknowledged with ${politeAck ? "a politeness token" : "a token reply"} and then closed — nothing was added`,
    };
  }
  return { response: "minimal", note: "acknowledged but not taken any further" };
}

// ── language style matching ──────────────────────────────────

function familyRate(words: string[], family: string[]): number {
  if (!words.length) return 0;
  const set = new Set(family);
  return words.filter((w) => set.has(w)).length / words.length;
}

/**
 * Language Style Matching (Ireland & Pennebaker's method): compare the two
 * speakers' rates of FUNCTION words, family by family. Content words say what
 * the conversation is about; function words say how in step the two people
 * are. High LSM tracks rapport and accommodation; a drop tracks divergence.
 *
 * Returns null under 25 words a side, because below that it is noise and
 * reporting it would be dishonest.
 */
export function languageStyleMatching(aText: string, bText: string): number | null {
  const tok = (s: string) => s.toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter(Boolean);
  const A = tok(aText);
  const B = tok(bText);
  if (A.length < 25 || B.length < 25) return null;

  const scores = Object.values(FUNCTION_WORD_FAMILIES).map((family) => {
    const a = familyRate(A, family);
    const b = familyRate(B, family);
    return 1 - Math.abs(a - b) / (a + b + 0.0001);
  });
  return clamp01(scores.reduce((x, y) => x + y, 0) / scores.length);
}

// ── the extractor ────────────────────────────────────────────

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function extractSignals(t: Transcript): SignalSummary {
  const all = t.messages;
  const them = all.filter((m) => m.speaker === "them");
  const you = all.filter((m) => m.speaker === "you");

  const turns: TurnSignal[] = all.map((m, i) => {
    const prev = i > 0 ? all[i - 1] : null;
    const latencyMin =
      prev && typeof prev.at === "number" && typeof m.at === "number" && m.at >= prev.at
        ? Math.round((m.at - prev.at) / 60000)
        : null;
    const bid = detectBid(m.text);
    return {
      messageId: m.id,
      speaker: m.speaker,
      words: wordCount(m.text),
      isQuestion: isQuestion(m.text),
      formality: formality(m.text),
      closing: closingStrength(m.text),
      continuing: continuationStrength(m.text),
      hedges: matchAll(m.text, HEDGES).length,
      intensifiers: matchAll(m.text, INTENSIFIERS).length,
      warm: matchAll(m.text, WARMTH).length,
      distant: matchAll(m.text, DISTANCE).length,
      enthusiasm: matchAll(m.text, ENTHUSIASM).length,
      refersToOther: refersToOther(m.text),
      substantiveWords: substantiveWordCount(m.text),
      bidKind: bid?.kind ?? null,
      latencyMin,
    };
  });

  // ── bids and how each one landed ──
  const bids: BidEvent[] = [];
  for (let i = 0; i < all.length; i++) {
    const m = all[i];
    const bid = detectBid(m.text);
    if (!bid) continue;
    const reply = all.slice(i + 1).find((r) => r.speaker !== m.speaker) ?? null;
    if (!reply) {
      bids.push({
        by: m.speaker,
        messageId: m.id,
        kind: bid.kind,
        span: bid.span,
        response: null,
        responseMessageId: null,
        note: "nothing came back after it",
      });
      continue;
    }
    const { response, note } = classifyResponse(m.text, bid.kind, reply);
    bids.push({
      by: m.speaker,
      messageId: m.id,
      kind: bid.kind,
      span: bid.span,
      response,
      responseMessageId: reply.id,
      note,
    });
  }

  // ── register asymmetry ──
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5);
  const themFormality = avg(turns.filter((x) => x.speaker === "them").map((x) => x.formality));
  const youFormality = avg(turns.filter((x) => x.speaker === "you").map((x) => x.formality));

  // ── closing / continuing over the whole exchange ──
  const n = turns.length;
  const positional = turns.map((x, i) => x.closing * (n > 1 ? 0.45 + 0.55 * (i / (n - 1)) : 1));
  const last = turns[n - 1];
  const closingIndex = clamp01(
    Math.max(...positional, 0) * 0.75 + (last && last.closing >= 0.5 ? 0.35 : 0)
  );
  const continuationIndex = clamp01(
    (last ? last.continuing * 0.6 : 0) + avg(turns.map((x) => x.continuing)) * 0.5
  );

  // ── the soft close: the pattern that made this rewrite necessary ──
  const softClose = bids.some((b) => {
    if (b.by !== "you") return false;
    if (b.kind !== "compliment" && b.kind !== "affection" && b.kind !== "self_disclosure") return false;
    if (b.response !== "minimal") return false;
    const reply = turns.find((x) => x.messageId === b.responseMessageId);
    return Boolean(reply && reply.closing >= 0.45 && reply.substantiveWords <= 3);
  });

  const closerTurn = all.find((m) => bids.some((b) => b.responseMessageId === m.id));
  const enthusiasmOnClosingOnly = Boolean(closerTurn && enthusiasmOnClosing(closerTurn.text));

  // ── uptake: the same toward/away test applied to EVERY turn, not just bids ──
  // A conversation can be entirely healthy and contain no bids at all — two
  // people sorting out a time is the commonest exchange there is. Without
  // this, the engine scored ordinary logistics as disengagement, which is the
  // exact false-positive a "read the subtext" product must not have.
  const themIdx = all.map((m, i) => ({ m, i })).filter(({ m }) => m.speaker === "them" && m.index > 0);
  const uptakeRate = themIdx.length
    ? themIdx.filter(({ m, i }) => {
        const prev = all[i - 1];
        if (!prev || prev.speaker === m.speaker) return false;
        return classifyResponse(prev.text, detectBid(prev.text)?.kind ?? null, m).response === "toward";
      }).length / themIdx.length
    : 0;

  // ── mutual close: both sides sign off ──
  // "see you then" / "see you then" is an exchange ending by agreement. Read
  // as a one-sided close it looks like withdrawal, which it plainly is not.
  const tail = turns.slice(-4);
  const mutualClose =
    tail.some((x) => x.speaker === "you" && x.closing >= 0.4) &&
    tail.some((x) => x.speaker === "them" && x.closing >= 0.4);

  const unreciprocated = bids
    .filter((b) => b.by === "you" && (b.response === "minimal" || b.response === "away" || b.response === null))
    .map((b) => b.kind);

  const latencyOf = (sp: Speaker) =>
    median(turns.filter((x) => x.speaker === sp && x.latencyMin !== null).map((x) => x.latencyMin as number));

  const themWords = them.reduce((a, m) => a + wordCount(m.text), 0);
  const youWords = you.reduce((a, m) => a + wordCount(m.text), 0);

  // Longest unanswered run, per side.
  const longestRun = { you: 0, them: 0 };
  let run = 0;
  for (let i = 0; i < all.length; i++) {
    run = i > 0 && all[i - 1].speaker === all[i].speaker ? run + 1 : 1;
    const sp = all[i].speaker;
    if (run > longestRun[sp]) longestRun[sp] = run;
  }

  return {
    turns,
    bids,
    politenessAsymmetry: Number((themFormality - youFormality).toFixed(3)),
    // The absolute levels, exposed so the relationship layer can subtract the
    // baseline this pairing prescribes. Asymmetry alone cannot distinguish
    // "they are formal with everyone" from "they are formal with you".
    themFormality: Number(themFormality.toFixed(3)),
    youFormality: Number(youFormality.toFixed(3)),
    lsm: languageStyleMatching(you.map((m) => m.text).join(" "), them.map((m) => m.text).join(" ")),
    closingIndex,
    continuationIndex,
    uptakeRate,
    mutualClose,
    softClose,
    enthusiasmOnClosingOnly,
    latency: { you: latencyOf("you"), them: latencyOf("them") },
    unreciprocated,
    lastSpeaker: all.length ? all[all.length - 1].speaker : null,
    longestRun,
    themWords,
    youWords,
    // 4 messages is enough for structure, 20 is enough for rates. Density-based
    // metrics are shrunk by this; categorical ones (a close is a close) are not.
    sampleWeight: clamp01(Math.min(all.length / 8, 1) * 0.5 + Math.min((themWords + youWords) / 120, 1) * 0.5),
  };
}

/** How well the bids in this exchange were met, 0–1. Null when there were none. */
export function bidsMetScore(bids: BidEvent[]): number | null {
  if (!bids.length) return null;
  let num = 0;
  let den = 0;
  for (const b of bids) {
    const w = BID_WEIGHT[b.kind];
    den += w;
    num += w * (b.response ? RESPONSE_VALUE[b.response] : 0);
  }
  return den ? num / den : null;
}

export const BID_LABEL: Record<BidKind, string> = {
  compliment: "a compliment",
  affection: "an expression of affection",
  invitation: "an invitation",
  self_disclosure: "something personal",
  question: "a direct question",
  news_share: "news they wanted to share",
  help_request: "a request for help",
};
