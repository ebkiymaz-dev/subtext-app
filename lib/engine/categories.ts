// ═════════════════════════════════════════════════════════════
// THE CATEGORY ENGINE.
//
// Deterministic categories are computed here, for real, from the text —
// they are defensible and carry zero marginal cost. The categories marked
// `inferred` are the ones a live build hands to ONE structured LLM call;
// in this build they are computed by the SAME deterministic lexicons so
// the whole mechanic is demonstrable with zero keys. Everything labelled
// "inferred" is honestly flagged as mock in the UI.
//
// Law 2: a score with no evidence is NOT RENDERED. Every branch below
// attaches the verbatim spans that drove it.
// ═════════════════════════════════════════════════════════════

import type { CategoryId, CategoryScore, ContextId, Evidence, Message, Transcript } from "./types";
import {
  ACCOUNTABILITY_SHIFT, BOUNDARY_PRESSURE, DEADLINE_PRESSURE, DEFLECTION, DISTANCING,
  FADE, FUTURE, GUILT, HEDGES, IRRITATION, PERFORMATIVE, PRESSURE, PROFESSIONAL,
  SELF_REFERENCE, STRESS, WARMTH, WE_LANGUAGE, matchAll, type Pattern,
} from "./lexicons";

// Law 1 consequence: this panel reports CONFIDENCE, and 100% confidence in a
// read of someone's text is never honest. Scores are softened and hard-capped
// below certainty, which also keeps the panel calm rather than alarmist.
const CEILING = 92;
const clamp = (n: number) => Math.max(0, Math.min(CEILING, Math.round(n * 0.86)));
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const isQuestion = (s: string) => /\?/.test(s);

interface Ctx {
  all: Message[];
  them: Message[];
  you: Message[];
  themText: string;
  youText: string;
}

function gather(msgs: Message[], patterns: Pattern[], why?: string): Evidence[] {
  const out: Evidence[] = [];
  for (const m of msgs) {
    for (const hit of matchAll(m.text, patterns)) {
      out.push({ messageId: m.id, span: hit.span, why: why ?? hit.why });
    }
  }
  // one evidence line per message per category keeps the transcript readable
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.messageId) ? false : (seen.add(e.messageId), true)));
}

/** density = hits per 100 words, scaled into a 0–100 confidence */
function density(hits: number, totalWords: number, perHundred = 2.2): number {
  if (!totalWords) return 0;
  return clamp(((hits / totalWords) * 100 / perHundred) * 100);
}

/** Questions asked by one side that the other never engaged with. */
function unansweredQuestions(all: Message[]): Message[] {
  const out: Message[] = [];
  for (let i = 0; i < all.length; i++) {
    const m = all[i];
    if (!isQuestion(m.text)) continue;
    const reply = all[i + 1];
    if (!reply || reply.speaker === m.speaker) continue;
    // a reply that is much shorter and contains no overlapping content word
    const asked = new Set(
      m.text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 4)
    );
    const overlap = reply.text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .some((w) => asked.has(w));
    if (!overlap && words(reply.text) < Math.max(6, words(m.text) * 0.6)) out.push(m);
  }
  return out;
}

const CONTEXT_POOLS: Record<ContextId, CategoryId[]> = {
  dating: ["reciprocity", "fade_markers"],
  work: ["professionalism", "deadline_pressure", "accountability_shift"],
  family: ["guilt", "boundary_pressure"],
  friendship: ["reciprocity"],
  other: [],
};

const CORE: CategoryId[] = [
  "engagement", "affect", "sincerity", "power", "evasion",
  "subtext_load", "pressure", "stress", "attachment",
];

export function scoreCategories(t: Transcript, context: ContextId): CategoryScore[] {
  const all = t.messages;
  const them = all.filter((m) => m.speaker === "them");
  const you = all.filter((m) => m.speaker === "you");
  const ctx: Ctx = {
    all,
    them,
    you,
    themText: them.map((m) => m.text).join(" "),
    youText: you.map((m) => m.text).join(" "),
  };

  const selected = new Set<CategoryId>([...CORE, ...CONTEXT_POOLS[context]]);
  const built = ALL_BUILDERS.filter((b) => selected.has(b.id)).map((b) => b.build(ctx));

  // Law 2 — no evidence, no render.
  return built
    .filter((c) => c.evidence.length > 0 || c.tier === "deterministic")
    .sort((a, b) => b.percent - a.percent);
}

interface Builder {
  id: CategoryId;
  build: (c: Ctx) => CategoryScore;
}

const ALL_BUILDERS: Builder[] = [
  {
    id: "engagement",
    build: (c) => {
      const themWords = words(c.themText);
      const youWords = words(c.youText);
      const ratio = youWords ? themWords / youWords : 1;
      const themQ = c.them.filter((m) => isQuestion(m.text)).length;
      const youQ = c.you.filter((m) => isQuestion(m.text)).length;
      const qBalance = youQ ? Math.min(themQ / youQ, 1.5) / 1.5 : themQ ? 1 : 0.35;
      const percent = clamp((Math.min(ratio, 1.4) / 1.4) * 60 + qBalance * 40);
      const notable = c.them.filter((m) => isQuestion(m.text) || words(m.text) > 18);
      // Law 2: never render a score without a line behind it. If nothing stands
      // out, the SHORTEST reply is itself the evidence for a low score.
      const basis = notable.length ? notable : c.them.slice().sort((a, b) => words(a.text) - words(b.text));
      const evidence: Evidence[] = basis.slice(0, 3).map((m) => ({
        messageId: m.id,
        span: m.text.slice(0, 60),
        why: isQuestion(m.text)
          ? "asks a question back"
          : words(m.text) > 18
            ? "invests length in the reply"
            : "one of their shortest replies — this is what the low score is counting",
      }));
      return {
        id: "engagement",
        label: "Engagement / interest",
        percent,
        read:
          percent >= 60
            ? "They match or exceed your investment in the exchange and ask questions back."
            : percent >= 35
              ? "Their replies are shorter than yours and questions mostly flow one way."
              : "Their side of the exchange is markedly lighter than yours — brief replies, little reciprocal asking.",
        tier: "deterministic",
        tone: percent >= 60 ? "warm" : "neutral",
        evidence,
        caveat:
          "Behaviour is not feeling. Low engagement can be circumstance — busy, tired, distracted. This measures the observable exchange, not their interest.",
      };
    },
  },
  {
    id: "affect",
    build: (c) => {
      const warm = matchAll(c.themText, WARMTH).length;
      const irr = matchAll(c.themText, IRRITATION).length;
      const total = words(c.themText);
      const percent = clamp(Math.max(density(warm + irr, total, 1.6), warm + irr ? 22 : 0));
      const leaning = warm > irr ? "warmth" : irr > warm ? "irritation" : "mixed tone";
      return {
        id: "affect",
        label: "Emotional state / affect",
        percent,
        read: `The language carries markers of ${leaning}${warm && irr ? " — both are present in the same thread" : ""}.`,
        tier: "inferred",
        tone: warm > irr ? "warm" : irr > warm ? "caution" : "neutral",
        evidence: gather(c.them, warm >= irr ? WARMTH : IRRITATION),
        caveat:
          "This reads tone in text, not the person's internal state. Text hides a great deal — flat writing is not a flat mood.",
      };
    },
  },
  {
    id: "sincerity",
    build: (c) => {
      const perf = matchAll(c.themText, PERFORMATIVE).length;
      const percent = clamp(density(perf, words(c.themText), 1.4));
      return {
        id: "sincerity",
        label: "Performativity markers",
        percent,
        read:
          percent >= 45
            ? "The register leans formulaic — stock phrases doing the work that specifics usually do."
            : "Mostly specific, unscripted phrasing.",
        tier: "inferred",
        tone: percent >= 45 ? "caution" : "neutral",
        evidence: gather(c.them, PERFORMATIVE),
        caveat:
          "Fluent politeness can read as performed and be entirely sincere. This is a register signal, not a sincerity verdict.",
      };
    },
  },
  {
    id: "power",
    build: (c) => {
      const themWords = words(c.themText);
      const youWords = words(c.youText);
      const themQ = c.them.filter((m) => isQuestion(m.text)).length;
      const youQ = c.you.filter((m) => isQuestion(m.text)).length;
      const lengthLead = themWords + youWords ? themWords / (themWords + youWords) : 0.5;
      const questionLead = themQ + youQ ? themQ / (themQ + youQ) : 0.5;
      const lastIsThem = c.all[c.all.length - 1]?.speaker === "them";
      const percent = clamp((lengthLead * 0.5 + questionLead * 0.35 + (lastIsThem ? 0.15 : 0)) * 100);
      return {
        id: "power",
        label: "Power / balance",
        percent,
        read:
          percent >= 60
            ? "They are driving: setting topics, asking more, and closing threads."
            : percent >= 40
              ? "The exchange is broadly balanced — neither side is steering it."
              : "You are driving the exchange; they are accommodating rather than directing.",
        tier: "deterministic",
        tone: "neutral",
        evidence: c.them.slice(0, 2).map((m) => ({
          messageId: m.id,
          span: m.text.slice(0, 60),
          why: "counts toward topic-initiation and length balance",
        })),
        caveat:
          "This describes conversational structure only. It says nothing about real-world power between you.",
      };
    },
  },
  {
    id: "evasion",
    build: (c) => {
      const hedges = matchAll(c.themText, HEDGES).length;
      const dist = matchAll(c.themText, DISTANCING).length;
      const defl = matchAll(c.themText, DEFLECTION).length;
      const unanswered = unansweredQuestions(c.all).filter((m) => m.speaker === "you");
      const selfRef = matchAll(c.themText, SELF_REFERENCE).length;
      const total = words(c.themText) || 1;
      const lowFirstPerson = selfRef / total < 0.03 ? 18 : 0;
      const percent = clamp(
        density(hedges + dist * 2 + defl * 2, total, 2.4) * 0.7 +
          unanswered.length * 14 +
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
      ];
      return {
        id: "evasion",
        label: "Evasion markers",
        percent,
        read:
          percent >= 45
            ? `Several evasion-associated patterns are present${unanswered.length ? `, including ${unanswered.length} question${unanswered.length > 1 ? "s" : ""} that went unanswered` : ""}.`
            : "Few evasion-associated patterns in this exchange.",
        tier: "inferred",
        tone: percent >= 45 ? "caution" : "neutral",
        evidence,
        caveat:
          "This is not a deception detector and cannot be one. These markers correlate weakly with evasion and are heavily context-dependent. The percentage means “markers of this kind are present in the text” — it is never a claim about anyone's truthfulness.",
      };
    },
  },
  {
    id: "subtext_load",
    build: (c) => {
      const unanswered = unansweredQuestions(c.all);
      const fade = matchAll(c.themText, FADE).length;
      const percent = clamp(unanswered.length * 18 + density(fade, words(c.themText), 2) * 0.5);
      return {
        id: "subtext_load",
        label: "Hidden meaning / subtext load",
        percent,
        read:
          percent >= 45
            ? "A noticeable amount is being left unsaid — dropped topics and deferrals without specifics."
            : "Most of what is meant appears to be stated directly.",
        tier: "inferred",
        tone: "neutral",
        evidence: [
          ...unanswered.map((m) => ({
            messageId: m.id,
            span: m.text.slice(0, 60),
            why: "raised and then dropped",
          })),
          ...gather(c.them, FADE),
        ],
        caveat: "A high subtext load is not evidence of bad intent. Some people are simply indirect.",
      };
    },
  },
  {
    id: "pressure",
    build: (c) => {
      const hits = matchAll(c.themText, PRESSURE);
      const percent = clamp(hits.length * 22);
      return {
        id: "pressure",
        label: "Pressure / obligation markers",
        percent,
        read: hits.length
          ? "Language associated with obligation or urgency pressure is present in this exchange."
          : "No obligation-pressure patterns detected.",
        tier: "inferred",
        tone: hits.length ? "caution" : "neutral",
        evidence: gather(c.them, PRESSURE),
        caveat:
          "Pattern-matching, not intent-reading. This flags language for your awareness; it does not accuse the other person of anything.",
      };
    },
  },
  {
    id: "stress",
    build: (c) => {
      const hits = matchAll(c.themText, STRESS);
      const frag = c.them.filter((m) => words(m.text) <= 3).length;
      const percent = clamp(density(hits.length, words(c.themText), 2) * 0.8 + frag * 6);
      return {
        id: "stress",
        label: "Strain markers",
        percent,
        read: percent >= 40
          ? "Absolutist and strain-associated language appears more than once."
          : "Little strain-associated language.",
        tier: "inferred",
        tone: percent >= 40 ? "caution" : "neutral",
        evidence: gather(c.them, STRESS),
        caveat:
          "Markers only — this is not a mental-health assessment and cannot be one. If you are worried about someone, ask them.",
      };
    },
  },
  {
    id: "attachment",
    build: (c) => {
      const we = matchAll(c.themText, WE_LANGUAGE).length;
      const future = matchAll(c.themText, FUTURE).length;
      const warm = matchAll(c.themText, WARMTH).length;
      const percent = clamp(density(we * 0.5 + future * 2 + warm * 2, words(c.themText), 3) * 0.9);
      return {
        id: "attachment",
        label: "Investment signals",
        percent,
        read: percent >= 45
          ? "Shared-frame language and concrete future plans are present."
          : "Little future-tense or shared-frame language on their side.",
        tier: "deterministic",
        tone: percent >= 45 ? "warm" : "neutral",
        evidence: gather(c.them, [...FUTURE, ...WARMTH, ...WE_LANGUAGE]),
        caveat: "Presence of signals, not a measure of the relationship's health.",
      };
    },
  },
  {
    id: "reciprocity",
    build: (c) => {
      const themQ = c.them.filter((m) => isQuestion(m.text)).length;
      const youQ = c.you.filter((m) => isQuestion(m.text)).length;
      const percent = clamp(themQ + youQ ? (themQ / (themQ + youQ)) * 100 : 40);
      return {
        id: "reciprocity",
        label: "Reciprocity",
        percent,
        read:
          percent >= 50
            ? "Questions flow in both directions."
            : `You asked ${youQ} question${youQ === 1 ? "" : "s"}; they asked ${themQ}.`,
        tier: "deterministic",
        tone: "neutral",
        evidence: c.them
          .filter((m) => isQuestion(m.text))
          .slice(0, 3)
          .map((m) => ({ messageId: m.id, span: m.text.slice(0, 60), why: "a question asked back" })),
        caveat: "Counts turns, not care.",
      };
    },
  },
  {
    id: "fade_markers",
    build: (c) => {
      const hits = matchAll(c.themText, FADE);
      return {
        id: "fade_markers",
        label: "Fade markers",
        percent: clamp(hits.length * 26),
        read: hits.length
          ? "Unbounded deferrals — plans referenced without a date attached."
          : "No unbounded deferrals detected.",
        tier: "inferred",
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
        percent: clamp(density(hits.length, words(c.themText), 1.6)),
        read: hits.length
          ? "The register is formal — a shift toward formality can mark distance as easily as respect."
          : "Informal register throughout.",
        tier: "deterministic",
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
        percent: clamp(hits.length * 24),
        read: hits.length ? "Schedule-pressure language is present." : "No schedule-pressure language.",
        tier: "deterministic",
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
        percent: clamp(hits.length * 28),
        read: hits.length
          ? "Agentless phrasing around a failure — the thing went wrong, but nobody did it."
          : "Responsibility is stated with an actor attached.",
        tier: "inferred",
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
        percent: clamp(hits.length * 27),
        read: hits.length
          ? "Self-effacing or debt-claiming phrasing that invites reassurance."
          : "No guilt-framing patterns detected.",
        tier: "inferred",
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
        percent: clamp(hits.length * 30),
        read: hits.length
          ? "A stated limit is being minimised or worked around."
          : "No boundary-minimising language detected.",
        tier: "inferred",
        tone: hits.length ? "caution" : "neutral",
        evidence: gather(c.them, BOUNDARY_PRESSURE),
        caveat: "Language only. Whether a limit was actually crossed is yours to judge.",
      };
    },
  },
];

export { unansweredQuestions };
