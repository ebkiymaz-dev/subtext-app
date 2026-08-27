// ═════════════════════════════════════════════════════════════
// COMPETING INTERPRETATIONS — 3–5 weighted reads that sum to 100.
//
// SCHEMA RULES (enforced here in code, exactly as the live loop enforces
// them against the model): at least 3 interpretations, no single one above
// 60, weights sum to exactly 100, and EXACTLY ONE is flagged as the
// most-charitable read. The design never lets the darkest read stand alone.
//
// v2: the candidates below are generated from SIGNALS rather than from
// category percentages, and each one carries the verbatim lines it rests on.
// A reading with no quote behind it is a horoscope.
// ═════════════════════════════════════════════════════════════

import type {
  CategoryScore, ContextId, Interpretation, SignalSummary, Transcript,
} from "./types";
import { BID_LABEL } from "./signals";
import { formalityExcess, type RelationshipProfile } from "./relationship";

const MAX_SINGLE = 60;

/** Weights are relative, so a multiplier is only allowed to move them within
 *  a sane band — a context must not be able to delete a reading outright. */
const clampW = (n: number) => Math.max(0.4, Math.min(1.6, n));

interface Candidate {
  id: string;
  title: string;
  body: string;
  suggestedNext: string;
  charitable?: boolean;
  weight: number;
  quotes?: string[];
}

const get = (cats: CategoryScore[], id: string) => cats.find((c) => c.id === id)?.percent ?? 0;

const quoteOf = (t: Transcript, id: string | null | undefined) =>
  id ? (t.messages.find((m) => m.id === id)?.text ?? "") : "";

/**
 * THE HEADLINE — a short, evidence-grounded summary.
 *
 * The panel is honest but it is also nine bars, and nine bars is not an
 * answer. This is the answer, but it must separate what the text shows from
 * what it cannot establish about the writer's intent.
 */
export function buildHeadline(
  s: SignalSummary,
  cats: CategoryScore[],
  t: Transcript,
  context: ContextId,
  p: RelationshipProfile
): string {
  const bid = s.bids.find((b) => b.by === "you" && (b.kind === "compliment" || b.kind === "affection"));

  if (s.softClose && bid) {
    const base = `${bid.kind === "compliment" ? "A compliment" : "An expression of affection"} was acknowledged and followed by a sign-off. The reply closes this exchange without opening a new topic, but the text alone cannot tell us why.`;
    // With days of history there is no established register for this to be
    // a step back FROM, and saying so is more useful than the sharper line.
    return p.deviation <= 0.5
      ? `${base} You have known them ${p.familiarityLabel.toLowerCase()}, though, so treat this as the shape of one message rather than the shape of a person.`
      : base;
  }
  if (get(cats, "pressure") >= 40) {
    return "Their messages use obligation, urgency, or social pressure. Whatever the intent, that wording can make it harder to take time before responding.";
  }
  // ── the reading the user did not come here for ──
  // There are two people in every transcript and one of them is holding the
  // phone. An engine that can only find things wrong with the other person is
  // a flattery machine, so this branch sits high in the ladder on purpose.
  if (s.longestRun.you >= 3 && s.themWords < s.youWords * 0.7) {
    return `You sent ${s.longestRun.you} messages in a row before they answered. Most of the shape of this exchange is yours, which is worth knowing before reading anything into the size of their reply.`;
  }
  // ── the transactional contexts get their own ladder ──
  // A negotiation or a listing enquiry is not a relationship with a problem;
  // it is a job with a shape. Running the relational ladder over it is how a
  // tool like this loses the user's trust in one screen.
  if (p.transactional) {
    if (get(cats, "anchoring") >= 38) {
      return "The exchange emphasizes what is fixed, who else may be interested, or how quickly you must decide. Check the actual terms separately from that framing.";
    }
    if (get(cats, "commitment_specificity") >= 55) {
      return "Nothing on their side commits to a time, a figure or a place. In an exchange whose entire purpose is to arrange one of those three, that absence is the finding.";
    }
    if (get(cats, "deadline_pressure") >= 40) {
      return "The deadline is stated by the other person rather than demonstrated by the situation. Verify the timing before treating it as fixed.";
    }
  }

  // A relationship label is not evidence of somebody's usual writing style.
  // Require an observed contrast; punctuation alone must not imply distance.
  if (p.deviation >= 1 && s.politenessAsymmetry >= 0.2 && formalityExcess(s.themFormality, p) >= 0.5 && !s.mutualClose) {
    return "Their wording is more formal than yours in this excerpt. That is a difference in writing style, not proof of emotional distance or a change from how they usually speak.";
  }

  if (context === "work" && get(cats, "accountability_shift") >= 28) {
    return "The failure is described without anybody in it — things “got missed” and “weren't clear” rather than someone missing or clarifying them. Paired with a deferral, the effect is that nothing is answerable today.";
  }
  // A one-sided close is a signal. A mutual one is a finished conversation,
  // and reading it as withdrawal is how this kind of tool starts inventing
  // problems for people.
  if (
    !s.mutualClose &&
    s.closingIndex >= 0.6 &&
    s.continuationIndex <= 0.2 &&
    s.lastSpeaker === "them" &&
    get(cats, "engagement") < 45
  ) {
    return "Their last message acknowledges the exchange and closes it without adding a question or new topic. That supports a reading of conversational closure, but the text alone cannot tell us why.";
  }
  if (
    (context === "dating" || context === "friendship") &&
    (get(cats, "fade_markers") >= 45 || (get(cats, "engagement") < 35 && get(cats, "subtext_load") >= 40))
  ) {
    return "The words are warm, but no specific plan is offered. That can fit a gradual loss of momentum, though busyness or uncertainty could produce the same pattern.";
  }
  if (get(cats, "engagement") >= 60 && get(cats, "reciprocity") >= 55) {
    return "Both of you are carrying this. Attempts to connect are answered and continued, questions travel in both directions, and the tone is matched — this reads as a conversation, not a transaction.";
  }
  if (get(cats, "evasion") >= 45) {
    return "Specific questions are meeting non-specific answers. That pattern is consistent with a topic being stepped around — which is not the same as you being stepped around.";
  }
  if (p.deviation <= 0.5 && !p.transactional) {
    return `You have known them ${p.familiarityLabel.toLowerCase()}. The structural signals below are real, but there is no established way the two of you write to each other yet — so nothing here can be a departure from anything, and the engine will not pretend otherwise.`;
  }
  if (s.turns.length <= 3) {
    return `${s.turns.length} message${s.turns.length === 1 ? "" : "s"} is a thin sample. The structural signals below are real, but a confident story about what they mean would be invented rather than found.`;
  }
  return "No unusual language pattern stands out in this exchange. That does not establish intent; it means the text does not support a stronger conclusion.";
}

export function buildInterpretations(
  cats: CategoryScore[],
  context: ContextId,
  t: Transcript,
  s: SignalSummary,
  p: RelationshipProfile
): Interpretation[] {
  const engagement = get(cats, "engagement");
  const evasion = get(cats, "evasion");
  const pressure = get(cats, "pressure");
  const stress = get(cats, "stress");
  const attachment = get(cats, "attachment");
  const subtext = get(cats, "subtext_load");
  const fade = get(cats, "fade_markers");
  const distance = get(cats, "warmth_distance");
  const affectWarm = cats.find((c) => c.id === "affect")?.tone === "warm";

  const softBid = s.bids.find(
    (b) => b.by === "you" && (b.kind === "compliment" || b.kind === "affection" || b.kind === "self_disclosure")
  );
  const closingQuote = s.lastSpeaker === "them" ? t.messages[t.messages.length - 1]?.text ?? "" : "";

  const candidates: Candidate[] = [];

  // ── the charitable read is ALWAYS constructed first, never as a leftover ──
  candidates.push({
    id: "charitable",
    charitable: true,
    title: s.softClose ? "A routine sign-off is one possibility" : "A literal reading remains plausible",
    body: p.transactional
      ? `This is a ${p.contextLabel.toLowerCase()} exchange behaving like one. Brevity, formality and a clean sign-off are the register the situation prescribes, and reading warmth into their presence or absence here is reading the wrong variable.`
      : p.deviation <= 0.5
        ? `You have known them ${p.familiarityLabel.toLowerCase()}. People are careful and slightly formal with people they have just met, and almost everything below is consistent with nothing more than that.`
        : s.softClose
      ? "A short sign-off can be completely ordinary. Tiredness, device use, writing style, or limited time can all produce this shape, and the excerpt does not rule those explanations out."
      : stress >= 35
        ? "Strain-associated wording appears across their messages. It may reflect limited capacity, but this excerpt cannot establish the cause or distinguish it from disinterest."
        : engagement >= 50
          ? "A literal reading remains plausible. The exchange is broadly reciprocal, and some ambiguity may come from the ordinary compression of text."
          : "Brevity may reflect busyness, device use, writing style, or unseen context. Short text alone is weak evidence.",
    suggestedNext: s.softClose
      ? "If there is no practical deadline or safety concern, one option is to wait and see whether the conversation resumes normally."
      : evasion < 25 && pressure < 25 && distance < 35
        ? "If the plan is already clear, a brief acknowledgment or no further reply may be enough. This excerpt does not give you a reason to seek reassurance."
      : "Say the plain thing: “Hey — no pressure either way, just wanted to check we're good.” It costs nothing and resolves most of this.",
    weight: s.softClose ? 30 : 30,
    quotes: closingQuote ? [closingQuote] : [],
  });

  // ── the polite-close read: v2's signature ──
  if (s.softClose && softBid) {
    candidates.push({
      id: "polite_close",
      title: "The politeness is doing the work of a step back",
      body: `You offered ${BID_LABEL[softBid.kind]} and the reply acknowledged it without adding a new topic, used a more formal register, and ended the exchange. Together, those cues can be consistent with a polite close; they do not establish rejection or motive.`,
      suggestedNext:
        "If there is no practical deadline, you could pause and decide whether you want to leave space for them to reopen the conversation. This is an option, not a test of their feelings.",
      weight: Math.round(28 * clampW(p.registerWeight)),
      quotes: [quoteOf(t, softBid.messageId), quoteOf(t, softBid.responseMessageId)].filter(Boolean),
    });
  }

  if (
    !s.softClose &&
    s.closingIndex >= 0.55 &&
    s.continuationIndex <= 0.25 &&
    s.lastSpeaker === "them"
  ) {
    candidates.push({
      id: "wound_down",
      title: "The thread is being wound down, not dropped",
      body: "The last turns from their side close topics rather than opening them, and nothing at the end needs an answer. That is what winding down looks like — it is much more common than a decision, and it does not survive contact with one good reason to keep talking.",
      suggestedNext:
        "If you want it to continue, give it a specific reason to: one concrete question or one concrete plan, not an open-ended check-in.",
      weight: Math.round(24 * clampW(p.closureWeight)),
      quotes: closingQuote ? [closingQuote] : [],
    });
  }

  // Gated on evasion alone. It used to also fire on a high subtext load, and
  // the eval caught it asserting "questions were raised and not engaged with"
  // about an exchange containing no questions. A reading that describes
  // something that did not happen is worse than no reading.
  const unansweredCount =
    cats.find((c) => c.id === "evasion")?.evidence.filter((e) => /did not engage/.test(e.why)).length ?? 0;
  if (evasion >= 35) {
    candidates.push({
      id: "avoiding",
      title: "Something is being stepped around",
      body: `${unansweredCount ? `${unansweredCount} question${unansweredCount > 1 ? "s were" : " was"} raised and not engaged with, and the ` : "The "}phrasing moves away from specifics rather than toward them. That pattern is consistent with avoiding a particular topic — which is not the same as avoiding you.`,
      suggestedNext:
        "Ask one narrow, answerable question instead of an open one. “Is Thursday still on — yes or no?” gives them a cheap way to be direct.",
      weight: 24,
      quotes: cats
        .find((c) => c.id === "evasion")
        ?.evidence.slice(0, 2)
        .map((e) => quoteOf(t, e.messageId))
        .filter(Boolean),
    });
  }

  if (fade >= 30 || (engagement < 40 && context === "dating" && s.turns.length > 4)) {
    candidates.push({
      id: "fading",
      title: "Momentum may be decreasing",
      body: "Deferrals appear without dates attached and reciprocal asking has thinned. This can happen when momentum drops, but busyness or uncertainty can look the same.",
      suggestedNext:
        "One option is to stop adding messages for now and decide what level of effort feels right for you. A pause can create space without turning the interaction into a test.",
      weight: Math.round(22 * clampW(p.reciprocityWeight)),
      quotes: cats
        .find((c) => c.id === "fade_markers")
        ?.evidence.slice(0, 2)
        .map((e) => quoteOf(t, e.messageId))
        .filter(Boolean),
    });
  }

  if (pressure >= 30) {
    candidates.push({
      id: "pressure",
      title: "You are being moved toward a decision",
      body: "Obligation, urgency or consensus framing is present. Whatever their intent, the effect of that phrasing is to compress your time to think.",
      suggestedNext:
        "If it is safe and there is no genuine deadline, you can say: “I want to give you a considered answer. I’ll come back to you tomorrow.” Verify any claimed deadline rather than assuming it is flexible.",
      weight: 26,
      quotes: cats
        .find((c) => c.id === "pressure")
        ?.evidence.slice(0, 2)
        .map((e) => quoteOf(t, e.messageId))
        .filter(Boolean),
    });
  }

  const excess = formalityExcess(s.themFormality, p);
  if (distance >= 55 && !s.softClose && p.deviation >= 0.8) {
    candidates.push({
      id: "register_shift",
      title: "The register has moved, and the content hasn't",
      body:
        p.deviation >= 1.15
          ? `Nothing they have written is unkind. It is also more formal than this relationship history would normally suggest. Greater formality can accompany distance, but context, mood, audience, or habit can produce the same shift.`
          : "Nothing they have written is unkind, and the formality gap between the two of you is visible. Greater formality can accompany distance, but context, mood, audience, or habit can produce the same pattern.",
      suggestedNext:
        "Match their register once and see what happens. If the gap closes on its own, it was a mood. If it holds, it is information.",
      weight: Math.round(20 * clampW(p.registerWeight)),
    });
  }

  // ── THE READING THE FAMILIARITY INPUT EXISTS TO PROTECT ──
  // Without this, a cautious first-week exchange gets the full distance
  // treatment and the user walks away with a conclusion the data cannot
  // support. It is a real competing read, and at this range often the best one.
  if (p.deviation <= 0.5 && (distance >= 35 || engagement < 50)) {
    candidates.push({
      id: "no_norm_yet",
      title: "There is no baseline here yet",
      body: `You have known them ${p.familiarityLabel.toLowerCase()}. Every distance reading in this app works by comparing how someone writes to how they normally write to you — and that comparison does not exist yet. What looks like reserve at this range is usually just two people who have not yet worked out which register they are in.`,
      suggestedNext:
        "Set the register yourself rather than reading theirs. Write the way you would want the next month of this to sound, once, and see whether it is matched.",
      weight: 30,
    });
  }

  // ── the transactional read ──
  if (p.transactional && (get(cats, "anchoring") >= 25 || get(cats, "commitment_specificity") >= 45)) {
    candidates.push({
      id: "doing_business",
      title: "This is a negotiation doing what negotiations do",
      body: "The moves here — a number framed as fixed, a competitor invoked, a commitment left without a time on it — are the standard grammar of getting a better deal. They are not evidence of bad faith and they are not about you. They are about the price.",
      suggestedNext:
        "Answer the terms and ignore the framing. One question that forces a specific — a figure, a date, an address — is worth more than any read of their tone.",
      weight: 26,
    });
  }

  if (excess >= 0.55 && p.deviation >= 1 && !candidates.some((c) => c.id === "register_shift")) {
    candidates.push({
      id: "raised_register",
      title: "They are writing to you the way they write to strangers",
      body: `Their register sits well above the baseline for ${p.contextLabel.toLowerCase()} at ${p.familiarityLabel.toLowerCase()}. That can be the day they are having, an audience they think might read it, or a decision — the text cannot distinguish those. What it can say is that the level is not the usual one.`,
      suggestedNext:
        "Name it lightly and once: “you sound formal — everything ok?” It is a cheap question and the answer to it is worth more than the whole panel above.",
      weight: Math.round(22 * clampW(p.registerWeight)),
    });
  }

  if (attachment >= 45 || affectWarm) {
    candidates.push({
      id: "invested",
      title: "Future-oriented language is present",
      body: "Shared-frame language and concrete future references are present even where the register is flat. Warmth and terseness coexist more often than people expect.",
      suggestedNext:
        "Take the future reference seriously and make it specific — put a day on it and see if it holds.",
      weight: 20,
    });
  }

  if (stress >= 40) {
    candidates.push({
      id: "strained",
      title: "Strain-associated language is present",
      body: "Absolutist and strain-associated language recurs across messages. When someone is depleted, warmth is usually the first thing that goes and it is rarely aimed at anyone.",
      suggestedNext: "Lower the ask. Offer something with no obligation attached and leave the door open.",
      weight: 20,
    });
  }

  // ── the floor: three reads, always ──
  // These are not filler. Each is a genuine, common explanation that the
  // specific detectors above cannot represent, and they are added in order
  // until the schema minimum is met.
  const GENERICS: Candidate[] = [
    {
      id: "ambiguous",
      title: "There genuinely isn't much here to read",
      body: `${t.messages.length} message${t.messages.length === 1 ? "" : "s"} is a thin sample. The structural signals above are real — a sign-off is a sign-off — but one exchange is one data point, and the difference between a pattern and a bad evening is the number of times it happens.`,
      suggestedNext: "Wait for one more exchange before drawing a conclusion from this one.",
      weight: 20,
    },
    {
      id: "neutral",
      title: "Nothing unusual is happening",
      body: "The markers that would distinguish one reading from another are largely absent. That is a real finding, not a failure to find one.",
      suggestedNext: "Reply as you normally would.",
      weight: 16,
    },
    {
      id: "offscreen",
      title: "The explanation isn't in the text",
      body: "Conversations sit on top of everything that happened before them and everything happening around them. Tone of voice, the last time you saw each other, what kind of day it has been — none of that is visible here, and any of it can account for the whole pattern above.",
      suggestedNext: "Weigh this against what you already know about them, which is more evidence than this app has.",
      weight: 14,
    },
  ];
  for (const g of GENERICS) {
    if (candidates.length >= 3) break;
    candidates.push(g);
  }

  return normalise(candidates.slice(0, 5));
}

/** Enforce the schema: cap at 60, sum to exactly 100, keep the charitable read. */
export function normalise(list: Candidate[]): Interpretation[] {
  const total = list.reduce((a, c) => a + c.weight, 0) || 1;
  let scaled = list.map((c) => ({ ...c, weight: (c.weight / total) * 100 }));

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
      quotes: (c.quotes ?? []).filter(Boolean).slice(0, 2),
    }))
    .sort((a, b) => b.weight - a.weight);
}

/** "What wasn't said" — absences are as informative as presences. */
export function whatWasntSaid(
  cats: CategoryScore[],
  t: Transcript,
  s: SignalSummary,
  p: RelationshipProfile
): string[] {
  const out: string[] = [];
  const themText = t.messages
    .filter((m) => m.speaker === "them")
    .map((m) => m.text)
    .join(" ")
    .toLowerCase();
  const themTurns = s.turns.filter((x) => x.speaker === "them");

  const unreturned = s.bids.filter(
    (b) => b.by === "you" && b.kind !== "question" && b.response !== "toward"
  );
  for (const b of unreturned.slice(0, 1)) {
    out.push(
      `${BID_LABEL[b.kind].replace(/^a /, "The ").replace(/^an /, "The ")} you made isn't returned or picked up — nothing in their reply refers back to it.`
    );
  }

  if (themTurns.length && themTurns.every((x) => !x.refersToOther) && p.warmthWeight >= 0.5) {
    out.push(
      "Once fixed politeness phrases are set aside, their messages contain no reference to you at all — no “you”, no “your”, nothing pointed your way."
    );
  }
  if (!/\b(sorry|apolog)/.test(themText) && get(cats, "pressure") >= 30)
    out.push("No acknowledgement or apology appears anywhere in their messages.");
  if (
    !/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|\d{1,2}(am|pm)|next week)\b/.test(
      themText
    )
  )
    out.push(
      p.transactional
        ? "No specific day, time or figure is proposed on their side — in an exchange that exists to settle one, that is the gap worth chasing."
        : "No specific day or time is proposed on their side — nothing points past this conversation."
    );
  // Nobody owes a question back in a work or marketplace exchange, so this
  // absence is only reported where its presence would have been the norm.
  if (!/\?/.test(themText) && p.reciprocityWeight >= 0.7)
    out.push("They asked nothing back across the whole exchange.");
  if (!/\b(i feel|i felt|i think|i want|i need|i'?m)\b/.test(themText))
    out.push("They state no position of their own — no wants, no needs, no view.");
  if (get(cats, "engagement") < 40 && !/\b(busy|work|swamped|sick|travel|tired|bed|sleep)\b/.test(themText))
    out.push("The brevity is never explained — no reason is offered for the shorter reply.");

  return out.slice(0, 4);
}

/** PREMIUM Coach — options, never commands, always tied to evidence. */
export function buildCoach(
  cats: CategoryScore[],
  s: SignalSummary,
  p: RelationshipProfile,
  transcript: Transcript
): CoachOut[] {
  const out: CoachOut[] = [];
  const find = (id: string) => cats.find((c) => c.id === id);
  const otherName = transcript.messages.find((m) => m.speaker === "them")?.name;
  const greeting = otherName && !/^(them|other|unknown)$/i.test(otherName) ? `${otherName}, ` : "";

  // Situation beats relationship category. A polite sign-off should never be
  // turned into an invitation to seek reassurance merely because the context
  // is dating. Give the least escalatory, most ordinary options first.
  if (s.softClose) {
    return [
      {
        mode: "clear",
        action: "You can leave the exchange here",
        reasoning:
          "The compliment was acknowledged and the conversation ended politely. Nothing in this excerpt requires another message, and silence here is not a tactic or a verdict.",
      },
      {
        mode: "warm",
        action: "If you want to answer, simply match the sign-off",
        suggestedReply: "Good night 😊",
        reasoning:
          "A brief matched sign-off stays warm without reopening the compliment or asking the other person to explain a normal ending.",
      },
    ];
  }

  if (s.uptakeRate >= 0.65 && s.unreciprocated.length === 0 && s.longestRun.you <= 2) {
    out.push({
      mode: "warm",
      action: "Match the clear, cooperative tone",
      suggestedReply: `${greeting}thanks — that works for me.`,
      reasoning:
        "The exchange is reciprocal and the other person is answering what was asked. A short acknowledgment preserves that rhythm without adding pressure or inventing a concern.",
    });
  }

  // Start with wording that fits the real-world relationship. These are
  // editable options, not verdicts about the other person or tactics for
  // controlling them. The user keeps the final choice.
  switch (p.context) {
    case "partner":
      out.push({
        mode: "warm",
        action: "Reconnect, then ask for one honest answer",
        suggestedReply: `${greeting}I care about us, and I do not want us to guess what the other means. Can we talk about what each of us needs here?`,
        reasoning:
          "This names care without surrendering the issue. It asks for needs and a conversation, which makes repair possible without assigning a motive or a clinical label.",
      });
      out.push({
        mode: "boundary",
        action: "Name the effect and the limit",
        suggestedReply: `${greeting}I want to discuss this, but I cannot do it through insults or pressure. I am available when we can speak respectfully.`,
        reasoning:
          "A useful boundary describes the conduct, your response, and the condition for continuing. It does not threaten, punish, or claim to know why they acted that way.",
      });
      break;
    case "dating":
      out.push({
        mode: "clear",
        action: "Ask for clarity without chasing",
        suggestedReply: `${greeting}I have enjoyed getting to know you. Are you interested in continuing this? Either answer is okay; I would just prefer clarity.`,
        reasoning:
          "A direct, low-pressure question protects your time and gives the other person room to answer honestly. A non-answer is also useful information.",
      });
      break;
    case "work":
      out.push({
        mode: "practical",
        action: "Turn the exchange into a documented next step",
        suggestedReply: `${greeting}to make sure I deliver the right result, could you confirm the expected outcome, who owns the decision, and the deadline? I will reply with the next step.`,
        reasoning:
          "At work, specifics protect the user better than reading tone. This keeps the message professional, creates a shared record, and makes responsibility and timing visible.",
      });
      out.push({
        mode: "boundary",
        action: "Raise a workplace concern neutrally",
        suggestedReply: `${greeting}I want to resolve this constructively. Could we keep the feedback specific to the work and agree the next action in writing?`,
        reasoning:
          "This avoids emotional speculation and retaliation. It requests observable feedback and a record while leaving room for a professional resolution.",
      });
      break;
    case "marketplace":
      out.push({
        mode: "practical",
        action: "Keep the transaction specific and on-platform",
        suggestedReply: `${greeting}please confirm the exact item, condition, total price, delivery date, and return terms here in the platform chat. I will only pay through the platform checkout.`,
        reasoning:
          "For Amazon or another marketplace, verifiable facts and platform protections matter more than tone. Keeping messages and payment on-platform preserves evidence and reduces avoidable risk.",
      });
      out.push({
        mode: "boundary",
        action: "Decline an unsafe or unclear transaction",
        suggestedReply: `${greeting}I am not comfortable moving payment or communication off-platform. If the purchase cannot be completed here under the stated terms, I will not proceed.`,
        reasoning:
          "This protects money, privacy, and recourse. It sets a condition without accusing the other person of fraud or arguing about their intent.",
      });
      break;
    case "business":
      out.push({
        mode: "practical",
        action: "Put the commercial terms in writing",
        suggestedReply: `${greeting}to confirm, my understanding is: scope [ ], price [ ], owner [ ], and deadline [ ]. Please correct anything that differs before we proceed.`,
        reasoning:
          "A written summary reduces ambiguity and protects optionality. It moves the negotiation from impressions to terms that either side can confirm or change.",
      });
      break;
    case "friendship":
      out.push({
        mode: "warm",
        action: "Protect the friendship while naming the issue",
        suggestedReply: `${greeting}I value our friendship, so I would rather ask than assume. I felt some distance in this exchange. Is something between us, or is life simply heavy right now?`,
        reasoning:
          "This separates an observation from an interpretation and offers more than one explanation. It makes honesty easier without forcing agreement.",
      });
      break;
    case "family":
      out.push({
        mode: "boundary",
        action: "State a family boundary without debating it",
        suggestedReply: `${greeting}I understand that you feel strongly. My decision is [ ]. I am willing to discuss it respectfully, but I am not available for pressure or insults.`,
        reasoning:
          "Family history can pull the conversation into obligation and old roles. This acknowledges emotion while keeping the decision and conditions under the user’s control.",
      });
      break;
    case "ex_partner":
      out.push({
        mode: "clear",
        action: "Keep the purpose and boundary explicit",
        suggestedReply: `${greeting}I can discuss [specific practical issue]. I am not available to reopen the relationship conversation. Please keep messages to that topic.`,
        reasoning:
          "A narrow purpose reduces mixed signals and protects both sides from an exchange neither agreed to have.",
      });
      break;
    case "stranger":
      out.push({
        mode: "boundary",
        action: "Use the minimum information needed",
        suggestedReply: `${greeting}no, thank you. I am not comfortable sharing that information. Please do not contact me again.`,
        reasoning:
          "With a stranger, the user does not owe personal details, a debate, or continued access. A short boundary limits exposure and avoids revealing more than necessary.",
      });
      break;
    default:
      out.push({
        mode: "clear",
        action: "Separate what happened from what you need",
        suggestedReply: `${greeting}I may be reading this differently than you intended. What I need now is [specific answer or action]. Can you confirm that directly?`,
        reasoning:
          "This avoids pretending to know the other person’s motives. It makes the user’s need answerable and leaves room for correction.",
      });
  }

  // Coach optimises the USER's conduct, so the first thing it looks at is
  // the user's conduct.
  if (s.longestRun.you >= 3) {
    out.push({
      action: `You could send one message and stop, rather than ${s.longestRun.you}.`,
      reasoning:
        "A run of unanswered messages changes what the other person is replying to: they are now responding to the pile, not to the thing you actually wanted an answer about. One message leaves the signal clean and leaves you something to read.",
    });
  }

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
  if (engagementCat && engagementCat.percent < 40 && !s.softClose) {
    out.push({
      action: "You could stop initiating for a stretch and let them come to you.",
      reasoning:
        "Right now you are supplying most of the momentum. A pause may reduce pressure and give you space to decide what level of effort feels sustainable; it should not be used as a punishment or experiment.",
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

  const anchorCat = find("anchoring");
  if (anchorCat && anchorCat.percent >= 30) {
    out.push({
      action: "Put your own number down before answering theirs.",
      reasoning:
        "Whoever states a figure first sets the range the rest of the conversation moves inside. Responding to their anchor — even to reject it — keeps you inside it. Naming your own price resets where the middle is.",
      evidenceMessageId: anchorCat.evidence[0]?.messageId,
    });
  }

  const specCat = find("commitment_specificity");
  if (specCat && specCat.percent >= 50) {
    out.push({
      action: "Ask for one specific and stop there.",
      reasoning:
        "A time, a figure or an address. A single closed request is the cheapest test there is of whether an unbounded commitment is a scheduling problem or a soft no — and unlike a read of their tone, the answer is unambiguous.",
      evidenceMessageId: specCat.evidence[0]?.messageId,
    });
  }

  if (p.deviation <= 0.5 && !out.length) {
    out.push({
      action: "Set the register rather than reading it.",
      reasoning: `You have known them ${p.familiarityLabel.toLowerCase()}, which means there is nothing to compare this against yet. Writing once in the register you would actually want tells you more in a day than any amount of analysis of theirs.`,
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

interface CoachOut {
  mode?: "warm" | "clear" | "boundary" | "practical";
  action: string;
  suggestedReply?: string;
  reasoning: string;
  evidenceMessageId?: string;
}
