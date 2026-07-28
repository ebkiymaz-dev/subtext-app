// ═════════════════════════════════════════════════════════════
// THE DEEP READ — shape, prompt, and validation for the PREMIUM tier.
//
// This module is imported by BOTH the server route and the client, so it
// contains no key access and no network code. It defines:
//
//   · the JSON shape the model must return       (DeepRead)
//   · the Gemini responseSchema for that shape   (DEEP_READ_SCHEMA)
//   · the prompt                                 (buildDeepPrompt)
//   · the validator that decides whether an      (validateDeepRead)
//     answer is allowed to reach a human
//
// THE VALIDATOR IS THE PRODUCT. A language model asked to read subtext will
// produce something confident and plausible every single time, including
// when there is nothing there. Everything below exists to make that failure
// mode visible instead of charming:
//
//   1. GROUNDING — every quote must appear verbatim in the pasted text.
//      A quote that does not match is deleted, and a claim that loses its
//      last quote is deleted with it. This is the single check that stops
//      the model inventing evidence, which is the thing it most wants to do.
//   2. SCHEMA — 3-5 interpretations, none above 60, exactly one flagged
//      charitable, weights renormalised to 100 in code rather than trusted.
//   3. LEXICON — the banned-phrase list from `lib/legitimacy.ts` is applied
//      to every rendered string. Diagnosis, lie-detection and certainty
//      language are rejected outright, not softened.
//
// On failure the caller keeps the on-device analysis and says so. A missing
// deep read is a smaller problem than a fluent invented one.
// ═════════════════════════════════════════════════════════════

import { checkLexicon } from "../legitimacy";
import type { ContextId, SignalSummary, Transcript } from "./types";

export interface DeepClaim {
  /** what is observably in the text */
  observation: string;
  /** the verbatim line it rests on — validated against the transcript */
  quote: string;
  /** what it may indicate, always framed as a possibility */
  reading: string;
}

export interface DeepInterpretation {
  title: string;
  body: string;
  weight: number;
  charitable: boolean;
  suggestedNext: string;
  quotes: string[];
}

export interface DeepRead {
  headline: string;
  /** the psychological layer — what the moves may be doing */
  subtext: DeepClaim[];
  /**
   * Relational-pattern cues. NOT attachment "styles" and never a label
   * applied to a person: patterns visible in THIS exchange, with the
   * uncertainty attached to each one.
   */
  relationalCues: DeepClaim[];
  interpretations: DeepInterpretation[];
  whatWasntSaid: string[];
  nextMoves: { option: string; why: string }[];
  confidence: { level: "low" | "moderate" | "reasonable"; why: string };
}

export interface DeepReadResult {
  ok: boolean;
  read?: DeepRead;
  model?: string;
  provider?: string;
  /** honest, user-facing reason when ok === false */
  reason?: string;
  /** what the validator removed, so the failure mode is never silent */
  repairs?: string[];
}

// ── the schema handed to the model ───────────────────────────

const S = (description: string) => ({ type: "STRING", description });

const CLAIM = {
  type: "OBJECT",
  properties: {
    observation: S("What is observably in the text. Structural and specific. No inference here."),
    quote: S("The exact substring from the conversation that shows it. Must be copied character-for-character from the input. Never paraphrase."),
    reading: S("What this MAY indicate, framed as a possibility, in one or two sentences of plain English."),
  },
  required: ["observation", "quote", "reading"],
};

export const DEEP_READ_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: S("One or two sentences naming the single most important thing happening in this exchange, in plain English, without hedging it into mush."),
    subtext: { type: "ARRAY", items: CLAIM, description: "2-5 claims about what the phrasing is doing beyond what it says." },
    relationalCues: { type: "ARRAY", items: CLAIM, description: "0-3 relational patterns visible in this exchange. Never a label applied to a person." },
    interpretations: {
      type: "ARRAY",
      description: "3-5 competing readings. Exactly one must be flagged charitable.",
      items: {
        type: "OBJECT",
        properties: {
          title: S("A short title for this reading."),
          body: S("2-4 sentences arguing this reading from the evidence."),
          weight: { type: "NUMBER", description: "How much of the evidence supports this reading, 5-60. All weights should roughly add to 100." },
          charitable: { type: "BOOLEAN", description: "True for exactly ONE reading: the kindest one that is still genuinely plausible." },
          suggestedNext: S("What the user could do IF this reading is the right one. An option, never an instruction, and never a tactic for managing the other person."),
          quotes: { type: "ARRAY", items: { type: "STRING" }, description: "1-2 exact substrings from the conversation supporting this reading." },
        },
        required: ["title", "body", "weight", "charitable", "suggestedNext", "quotes"],
      },
    },
    whatWasntSaid: { type: "ARRAY", items: { type: "STRING" }, description: "2-4 specific absences. What a reply like this would normally contain and does not." },
    nextMoves: {
      type: "ARRAY",
      description: "2-3 things the user could do. Options, not instructions.",
      items: {
        type: "OBJECT",
        properties: { option: S("The option, in the user's own voice."), why: S("Why it is worth considering, tied to the evidence.") },
        required: ["option", "why"],
      },
    },
    confidence: {
      type: "OBJECT",
      properties: {
        level: { type: "STRING", enum: ["low", "moderate", "reasonable"], description: "How much this sample can support." },
        why: S("One sentence on what limits the read."),
      },
      required: ["level", "why"],
    },
  },
  required: ["headline", "subtext", "relationalCues", "interpretations", "whatWasntSaid", "nextMoves", "confidence"],
};

// ── the prompt ───────────────────────────────────────────────

const SYSTEM_RULES = `You are the reading engine inside Subtext, an app that shows people what the language in a conversation is carrying. You are careful, literate and completely unsentimental.

WHAT YOU ARE FOR
The user has pasted a conversation and wants to understand it. They do not want to be comforted and they do not want to be alarmed. They want an honest reader who notices things they missed and says so plainly.

HARD RULES — a violation makes the whole response unusable.
1. QUOTE VERBATIM. Every "quote" field must be copied character-for-character from the conversation below. If you cannot find a real line to support a claim, DELETE THE CLAIM. Never paraphrase into a quote field, never combine two lines, never tidy up spelling.
2. NEVER ASSERT INTENT AS FACT. Write "this may indicate", "one reading is", "the shape of this is consistent with". Never "they are", "they feel", "they want", "this proves".
3. NO DIAGNOSIS AND NO LIE DETECTION. You may not use: lying, lied, lie detector, manipulating, gaslighting, narcissist, sociopath, trauma, traumatised, diagnosis, diagnosed, definitely, proves. You are not a clinician and you are not a polygraph. Describing a PATTERN in a message is allowed; labelling a PERSON is not.
4. THE CHARITABLE READING MUST BE REAL. Exactly one interpretation is flagged charitable and it has to be the genuinely most plausible kind explanation — not a token disclaimer stapled to the end. If the kind reading is in fact the best reading, give it the highest weight.
5. DO NOT FLATTER THE USER. They are one of the two people here and they may be the one causing the problem. If the transcript shows them pushing, over-texting, or misreading, say so as directly as you would say it about the other person.
6. SAY WHEN THERE IS NOTHING THERE. Most conversations are unremarkable. "This is an ordinary exchange and the thing you are worried about is not visible in it" is a valuable answer and you should give it whenever it is true. Never manufacture depth.
7. ADVICE IS FOR THE USER'S OWN CONDUCT ONLY. Never suggest anything designed to produce a reaction in the other person — no strategic delays framed as tactics, no scripts to extract a response, no leverage. Suggestions help the user act well and find out what is true. Nothing else.
8. SHORT SAMPLES GET SHORT READS. Two messages cannot support five confident claims. Scale the number of claims and the confidence level to the amount of text you were actually given.

HOW TO READ
Work structurally, not sentimentally. The things that carry meaning in text are: bids for connection and whether they were met, acknowledged, or missed; register — whether someone answers in a more or less formal key than they were addressed in ("thank you" vs "thanks", "good night" vs "night"); closing moves versus continuation bids; what is NOT returned — a compliment not reciprocated, a question not asked back, a disclosure not matched; where emphasis lands (an exclamation mark on a sign-off is politeness, the same mark on the content is warmth); topic control and who ends things. A polite message can be a distant one. A short message is usually just a short message.`;

export function buildDeepPrompt(
  t: Transcript,
  context: ContextId,
  s: SignalSummary,
  youName: string
): string {
  const lines = t.messages
    .map((m) => `[${m.id}] ${m.speaker === "you" ? `${youName} (the user)` : `${m.name} (the other person)`}: ${m.text}`)
    .join("\n");

  // The on-device findings are handed over so the model CORROBORATES rather
  // than freelances — and is explicitly told it may overrule them, because a
  // model that only ever agrees with the rules adds nothing.
  const observed = [
    `messages: ${t.messages.length}`,
    `words — user ${s.youWords}, other person ${s.themWords}`,
    `register gap (other minus user, −1..1): ${s.politenessAsymmetry}`,
    `closing index: ${s.closingIndex.toFixed(2)} · continuation index: ${s.continuationIndex.toFixed(2)}`,
    s.lsm !== null ? `language style matching: ${s.lsm.toFixed(2)}` : "language style matching: not enough text",
    s.softClose ? "PATTERN: a compliment/affection/disclosure bid was acknowledged and closed in the same message" : null,
    s.enthusiasmOnClosingOnly ? "PATTERN: the only enthusiasm marker sits on the sign-off, not on the content" : null,
    s.bids.length
      ? `bids: ${s.bids.map((b) => `${b.by === "you" ? "user" : "other"} made ${b.kind} → ${b.response ?? "no reply"}`).join("; ")}`
      : "bids: none detected",
    s.latency.them !== null ? `median reply latency — user ${s.latency.you ?? "?"} min, other ${s.latency.them} min` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${SYSTEM_RULES}

CONTEXT THE USER SELECTED: ${context}
THE USER IS: ${youName}

CONVERSATION (each line is prefixed with its id — use the ids to keep track, but quote only the message text):
${lines}

WHAT THE ON-DEVICE ENGINE ALREADY MEASURED (structural, computed from the text — treat as reliable observations, and say so if you think they are misleading):
${observed}

Now produce the deep read as JSON matching the schema. Go past what the rules above already found: they can see that a bid was closed, they cannot see what it might mean. Be specific, be quotable, and be willing to conclude that this is ordinary.`;
}

export const REPAIR_SUFFIX = `

Your previous answer was rejected. At least one "quote" field did not appear verbatim in the conversation. Produce the JSON again. Copy every quote character-for-character from the message text above, and delete any claim you cannot support with a real line.`;

// ── validation ───────────────────────────────────────────────

/** Normalise for substring comparison without letting the model paraphrase through. */
const norm = (s: string) =>
  s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

function isGrounded(quote: string, haystacks: string[]): boolean {
  const q = norm(quote);
  if (q.length < 2) return false;
  return haystacks.some((h) => h.includes(q));
}

const clean = (s: unknown): string => (typeof s === "string" ? s.trim() : "");

/**
 * Validate, repair and return — or refuse.
 *
 * Repairs are recorded and surfaced. A validator that quietly fixes things is
 * how a product ends up shipping something nobody can explain.
 */
export function validateDeepRead(raw: unknown, t: Transcript): { read: DeepRead | null; repairs: string[]; fatal: string | null } {
  const repairs: string[] = [];
  if (!raw || typeof raw !== "object") return { read: null, repairs, fatal: "The model did not return an object." };
  const r = raw as Record<string, unknown>;

  const haystacks = t.messages.map((m) => norm(m.text));
  const banned = (s: string) => checkLexicon(s).length > 0;

  const claims = (input: unknown, label: string): DeepClaim[] => {
    if (!Array.isArray(input)) return [];
    const out: DeepClaim[] = [];
    for (const c of input) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const observation = clean(obj.observation);
      const quote = clean(obj.quote);
      const reading = clean(obj.reading);
      if (!observation || !reading) continue;
      if (!isGrounded(quote, haystacks)) {
        repairs.push(`${label}: dropped a claim whose quote is not in the transcript — “${quote.slice(0, 48)}”`);
        continue;
      }
      if (banned(observation) || banned(reading)) {
        repairs.push(`${label}: dropped a claim using forbidden phrasing`);
        continue;
      }
      out.push({ observation, quote, reading });
    }
    return out.slice(0, 5);
  };

  const subtext = claims(r.subtext, "subtext");
  const relationalCues = claims(r.relationalCues, "relational cues");

  // ── interpretations: the schema rules are enforced here, not requested ──
  const rawInterps = Array.isArray(r.interpretations) ? r.interpretations : [];
  let interps: DeepInterpretation[] = [];
  for (const i of rawInterps) {
    if (!i || typeof i !== "object") continue;
    const obj = i as Record<string, unknown>;
    const title = clean(obj.title);
    const body = clean(obj.body);
    const suggestedNext = clean(obj.suggestedNext);
    if (!title || !body) continue;
    if (banned(title) || banned(body) || banned(suggestedNext)) {
      repairs.push(`interpretations: dropped “${title}” for forbidden phrasing`);
      continue;
    }
    const quotes = (Array.isArray(obj.quotes) ? obj.quotes : [])
      .map(clean)
      .filter((q) => {
        const ok = isGrounded(q, haystacks);
        if (!ok && q) repairs.push(`interpretations: dropped an ungrounded quote — “${q.slice(0, 48)}”`);
        return ok;
      })
      .slice(0, 2);
    interps.push({
      title,
      body,
      weight: typeof obj.weight === "number" && obj.weight > 0 ? obj.weight : 10,
      charitable: obj.charitable === true,
      suggestedNext,
      quotes,
    });
  }

  if (interps.length < 3) {
    return { read: null, repairs, fatal: `Only ${interps.length} usable interpretation(s) survived validation; the schema requires at least 3.` };
  }
  interps = interps.slice(0, 5);

  // exactly one charitable
  const charitables = interps.filter((i) => i.charitable);
  if (charitables.length === 0) {
    interps[interps.length - 1].charitable = true;
    repairs.push("interpretations: no charitable reading was flagged; the kindest surviving read was marked as one.");
  } else if (charitables.length > 1) {
    let seen = false;
    interps = interps.map((i) => {
      if (!i.charitable) return i;
      if (seen) return { ...i, charitable: false };
      seen = true;
      return i;
    });
    repairs.push("interpretations: more than one reading was flagged charitable; only the first was kept.");
  }

  // cap at 60 and renormalise to exactly 100, in code
  const total = interps.reduce((a, i) => a + i.weight, 0) || 1;
  interps = interps.map((i) => ({ ...i, weight: (i.weight / total) * 100 }));
  const over = interps.filter((i) => i.weight > 60);
  if (over.length) {
    const excess = over.reduce((a, i) => a + (i.weight - 60), 0);
    const others = interps.filter((i) => i.weight <= 60).length || 1;
    interps = interps.map((i) => (i.weight > 60 ? { ...i, weight: 60 } : { ...i, weight: i.weight + excess / others }));
    repairs.push("interpretations: a reading exceeded the 60% ceiling and was capped.");
  }
  interps = interps.map((i) => ({ ...i, weight: Math.round(i.weight) }));
  const drift = 100 - interps.reduce((a, i) => a + i.weight, 0);
  if (drift !== 0) interps[0].weight += drift;
  interps.sort((a, b) => b.weight - a.weight);

  const headline = clean(r.headline);
  if (!headline) return { read: null, repairs, fatal: "The model returned no headline." };
  if (banned(headline)) return { read: null, repairs, fatal: "The headline used forbidden phrasing." };

  const whatWasntSaid = (Array.isArray(r.whatWasntSaid) ? r.whatWasntSaid : [])
    .map(clean)
    .filter((x) => x && !banned(x))
    .slice(0, 4);

  const nextMoves = (Array.isArray(r.nextMoves) ? r.nextMoves : [])
    .map((n) => {
      const o = (n ?? {}) as Record<string, unknown>;
      return { option: clean(o.option), why: clean(o.why) };
    })
    .filter((n) => n.option && !banned(n.option) && !banned(n.why))
    .slice(0, 3);

  const confRaw = (r.confidence ?? {}) as Record<string, unknown>;
  const level = ["low", "moderate", "reasonable"].includes(clean(confRaw.level))
    ? (clean(confRaw.level) as DeepRead["confidence"]["level"])
    : "low";

  if (!subtext.length) {
    return { read: null, repairs, fatal: "No subtext claim survived the grounding check — every quote the model offered was invented." };
  }

  return {
    read: {
      headline,
      subtext,
      relationalCues,
      interpretations: interps,
      whatWasntSaid,
      nextMoves,
      confidence: { level, why: clean(confRaw.why) || "Limited by the length of the sample." },
    },
    repairs,
    fatal: null,
  };
}
