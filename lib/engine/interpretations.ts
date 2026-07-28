// ═════════════════════════════════════════════════════════════
// COMPETING INTERPRETATIONS — 3–5 weighted reads that sum to 100.
//
// SCHEMA RULES (enforced here in code, exactly as the live loop enforces
// them against the model): at least 3 interpretations, no single one above
// 60, weights sum to exactly 100, and EXACTLY ONE is flagged as the
// most-charitable read. The design never lets the darkest read stand alone.
// ═════════════════════════════════════════════════════════════

import type { CategoryScore, ContextId, Interpretation, Transcript } from "./types";

const MAX_SINGLE = 60;

interface Candidate {
  id: string;
  title: string;
  body: string;
  suggestedNext: string;
  charitable?: boolean;
  weight: number;
}

const get = (cats: CategoryScore[], id: string) =>
  cats.find((c) => c.id === id)?.percent ?? 0;

export function buildInterpretations(
  cats: CategoryScore[],
  context: ContextId,
  t: Transcript
): Interpretation[] {
  const engagement = get(cats, "engagement");
  const evasion = get(cats, "evasion");
  const pressure = get(cats, "pressure");
  const stress = get(cats, "stress");
  const attachment = get(cats, "attachment");
  const subtext = get(cats, "subtext_load");
  const fade = get(cats, "fade_markers");
  const affectWarm = cats.find((c) => c.id === "affect")?.tone === "warm";

  const candidates: Candidate[] = [];

  // ── the charitable read is ALWAYS constructed first, never as a leftover ──
  candidates.push({
    id: "charitable",
    charitable: true,
    title: "The straightforward read",
    body:
      stress >= 35
        ? "They are carrying something unrelated to you. Strain-associated language shows up across their messages regardless of topic, which is what capacity looks like when it runs out — not what disinterest looks like."
        : engagement >= 50
          ? "They mean what they wrote. The exchange is broadly reciprocal, and the ambiguity you are reading may be the ordinary compression of text rather than a signal."
          : "They are short because they are busy or writing on a phone, and the brevity carries no message beyond itself. Terse text is the weakest evidence there is.",
    suggestedNext:
      "Say the plain thing: “Hey — no pressure either way, just wanted to check we're good.” It costs nothing and resolves most of this.",
    weight: 30,
  });

  if (evasion >= 35 || subtext >= 40) {
    candidates.push({
      id: "avoiding",
      title: "Something is being stepped around",
      body: `Questions were raised and not engaged with, and the phrasing moves away from specifics rather than toward them. That pattern is consistent with avoiding a particular topic — which is not the same as avoiding you.`,
      suggestedNext:
        "Ask one narrow, answerable question instead of an open one. “Is Thursday still on — yes or no?” gives them a cheap way to be direct.",
      weight: 26,
    });
  }

  if (fade >= 30 || (engagement < 40 && context === "dating")) {
    candidates.push({
      id: "fading",
      title: "Interest is drifting",
      body: "Deferrals appear without dates attached and reciprocal asking has thinned. This is the shape a fade takes in text — gradual, polite, and rarely stated.",
      suggestedNext:
        "Stop carrying the thread. Match their energy for a beat and let them initiate next; what happens next tells you more than another message will.",
      weight: 22,
    });
  }

  if (pressure >= 30) {
    candidates.push({
      id: "pressure",
      title: "You are being moved toward a decision",
      body: "Obligation, urgency or consensus framing is present. Whatever their intent, the effect of that phrasing is to compress your time to think.",
      suggestedNext:
        "Buy back the time explicitly: “I want to give you a real answer — I'll come back to you tomorrow.” A reasonable ask survives a day.",
      weight: 24,
    });
  }

  if (attachment >= 45 || affectWarm) {
    candidates.push({
      id: "invested",
      title: "They are more invested than the tone suggests",
      body: "Shared-frame language and concrete future references are present even where the register is flat. Warmth and terseness coexist more often than people expect.",
      suggestedNext:
        "Take the future reference seriously and make it specific — put a day on it and see if it holds.",
      weight: 20,
    });
  }

  if (stress >= 40) {
    candidates.push({
      id: "strained",
      title: "They are at capacity",
      body: "Absolutist and strain-associated language recurs across messages. When someone is depleted, warmth is usually the first thing that goes and it is rarely aimed at anyone.",
      suggestedNext: "Lower the ask. Offer something with no obligation attached and leave the door open.",
      weight: 20,
    });
  }

  // Always at least three reads.
  if (candidates.length < 3) {
    candidates.push({
      id: "ambiguous",
      title: "There genuinely isn't enough signal here",
      body: `${t.messages.length} message${t.messages.length === 1 ? "" : "s"} is a thin sample. The honest read is that this exchange does not carry a clear direction, and a confident interpretation of it would be invented rather than found.`,
      suggestedNext: "Wait for one more exchange before drawing a conclusion from it.",
      weight: 18,
    });
  }
  if (candidates.length < 3) {
    candidates.push({
      id: "neutral",
      title: "Nothing unusual is happening",
      body: "The markers that would distinguish one reading from another are largely absent. That is a real finding, not a failure to find one.",
      suggestedNext: "Reply as you normally would.",
      weight: 15,
    });
  }

  return normalise(candidates.slice(0, 5));
}

/** Enforce the schema: cap at 60, sum to exactly 100, keep the charitable read. */
function normalise(list: Candidate[]): Interpretation[] {
  const total = list.reduce((a, c) => a + c.weight, 0) || 1;
  let scaled = list.map((c) => ({ ...c, weight: (c.weight / total) * 100 }));

  // no single read may dominate — redistribute the excess
  const over = scaled.filter((c) => c.weight > MAX_SINGLE);
  if (over.length) {
    const excess = over.reduce((a, c) => a + (c.weight - MAX_SINGLE), 0);
    const others = scaled.filter((c) => c.weight <= MAX_SINGLE);
    const share = excess / Math.max(others.length, 1);
    scaled = scaled.map((c) =>
      c.weight > MAX_SINGLE ? { ...c, weight: MAX_SINGLE } : { ...c, weight: c.weight + share }
    );
  }

  const rounded = scaled.map((c) => ({ ...c, weight: Math.round(c.weight) }));
  const drift = 100 - rounded.reduce((a, c) => a + c.weight, 0);
  if (drift !== 0 && rounded.length) rounded[0].weight += drift;

  return rounded
    .map((c) => ({
      id: c.id,
      weight: c.weight,
      title: c.title,
      body: c.body,
      charitable: Boolean(c.charitable),
      suggestedNext: c.suggestedNext,
    }))
    .sort((a, b) => b.weight - a.weight);
}

/** "What wasn't said" — absences are as informative as presences. */
export function whatWasntSaid(cats: CategoryScore[], t: Transcript): string[] {
  const out: string[] = [];
  const themText = t.messages
    .filter((m) => m.speaker === "them")
    .map((m) => m.text)
    .join(" ")
    .toLowerCase();

  if (!/\b(sorry|apolog)/.test(themText) && get(cats, "pressure") >= 30)
    out.push("No acknowledgement or apology appears anywhere in their messages.");
  if (!/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|\d{1,2}(am|pm)|next week)\b/.test(themText))
    out.push("No specific day or time is proposed on their side — every reference to the future is open-ended.");
  if (!/\?/.test(themText))
    out.push("They asked nothing back across the whole exchange.");
  if (!/\b(i feel|i felt|i think|i want|i need)\b/.test(themText))
    out.push("They state no position of their own — no wants, no needs, no view.");
  if (get(cats, "engagement") < 40 && !/\b(busy|work|swamped|sick|travel)\b/.test(themText))
    out.push("The brevity is never explained — no reason is offered for the shorter replies.");

  return out.slice(0, 4);
}

/** PREMIUM Coach — options, never commands, always tied to evidence. */
export function buildCoach(cats: CategoryScore[]): { action: string; reasoning: string; evidenceMessageId?: string }[] {
  const out: { action: string; reasoning: string; evidenceMessageId?: string }[] = [];
  const find = (id: string) => cats.find((c) => c.id === id);

  const evasionCat = find("evasion");
  if (evasionCat && evasionCat.percent >= 40) {
    out.push({
      action: "Consider replacing the open question with a closed one.",
      reasoning:
        "An open question is easy to answer around. A yes/no question makes a non-answer visible to both of you — which is information, whichever way it goes.",
      evidenceMessageId: evasionCat.evidence[0]?.messageId,
    });
  }

  const engagementCat = find("engagement");
  if (engagementCat && engagementCat.percent < 40) {
    out.push({
      action: "You could stop initiating for a stretch and let them come to you.",
      reasoning:
        "Right now you are supplying most of the momentum, which makes it impossible to tell how much they would supply on their own. Pausing is a measurement, not a punishment.",
      evidenceMessageId: engagementCat.evidence[0]?.messageId,
    });
  }

  const pressureCat = find("pressure");
  if (pressureCat && pressureCat.percent >= 30) {
    out.push({
      action: "You might name the timeline out loud rather than absorbing it.",
      reasoning:
        "Saying “I'll get back to you tomorrow” converts implied urgency into an explicit, reasonable commitment — and a reasonable request survives a day.",
      evidenceMessageId: pressureCat.evidence[0]?.messageId,
    });
  }

  const stressCat = find("stress");
  if (stressCat && stressCat.percent >= 40) {
    out.push({
      action: "Consider lowering the ask before raising the concern.",
      reasoning:
        "Strain-associated language suggests limited capacity. A smaller request is more likely to get an honest answer than a bigger one.",
      evidenceMessageId: stressCat.evidence[0]?.messageId,
    });
  }

  if (!out.length) {
    out.push({
      action: "Nothing here needs managing.",
      reasoning:
        "The markers that would justify changing your approach are not present. Coach will not manufacture advice to fill space.",
    });
  }

  return out.slice(0, 4);
}
