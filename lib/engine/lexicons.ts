// PATTERN LEXICONS — the deterministic half of the engine.
// Each entry is a phrase or regex plus the plain-English reason it matters.
// These produce the EVIDENCE that makes every score citable (Law 2).

export interface Pattern {
  re: RegExp;
  why: string;
}

const p = (source: string, why: string): Pattern => ({
  re: new RegExp(source, "gi"),
  why,
});

export const HEDGES: Pattern[] = [
  p("\\b(kind of|kinda|sort of|sorta|i guess|i suppose|maybe|probably|might|possibly|somewhat|a bit)\\b", "hedging softens a commitment"),
  p("\\b(to be honest|honestly|truthfully|not gonna lie|ngl)\\b", "truth-emphasis often marks a qualified statement"),
  p("\\b(i think|i feel like|i mean)\\b", "epistemic hedge"),
];

export const DISTANCING: Pattern[] = [
  p("\\b(that person|the situation|things happened|it happened|whatever happened)\\b", "distancing language avoids naming the actor"),
  p("\\b(as i said|like i said|i already told you)\\b", "closing down the topic rather than answering it"),
];

export const WARMTH: Pattern[] = [
  p("\\b(miss you|love you|thank you so much|appreciate you|proud of you|glad|happy for you|thinking of you|means a lot)\\b", "explicit warmth"),
  p("\\b(can't wait|cant wait|excited|looking forward)\\b", "anticipation toward the other person"),
  p("(❤️|🥰|😊|😍|🤗)", "affectionate emoji"),
];

export const IRRITATION: Pattern[] = [
  p("\\b(fine\\.|whatever|forget it|nevermind|never mind|if you say so|sure\\.)\\b", "clipped dismissal"),
  p("\\b(again\\?|seriously\\?|are you kidding|unbelievable)\\b", "exasperation marker"),
  p("\\b(i already|how many times|every time)\\b", "accumulated-grievance framing"),
];

export const STRESS: Pattern[] = [
  p("\\b(stressed|overwhelmed|exhausted|drained|anxious|panicking|can't cope|cant cope|too much right now)\\b", "explicit strain language"),
  p("\\b(always|never|everything|nothing|everyone|no one|nobody|completely|totally|constantly)\\b", "absolutist language is associated with strain"),
];

export const PRESSURE: Pattern[] = [
  p("\\b(after everything i('ve| have) done|you owe me|i always do|i'm the one who|im the one who)\\b", "obligation / debt framing"),
  p("\\b(if you (really )?(loved|cared|respected))\\b", "conditional-affection pressure"),
  p("\\b(right now|immediately|asap|by end of day|eod|today or)\\b", "urgency compression"),
  p("\\b(everyone (else )?(thinks|agrees|knows)|no one else has a problem)\\b", "consensus pressure"),
  p("\\b(you're overreacting|youre overreacting|calm down|you're being (dramatic|crazy|sensitive))\\b", "reframing the other person's reaction as the problem"),
  p("\\b(i never said that|that's not what happened|thats not what happened|you're remembering it wrong)\\b", "contesting the other person's account"),
];

export const FUTURE: Pattern[] = [
  p("\\b(we should|we could|let's|lets|next week|next month|when we|soon we|i'll book|ill book|plan to)\\b", "future-orientation with the other person"),
];

export const WE_LANGUAGE: Pattern[] = [p("\\b(we|us|our|ours)\\b", "shared-frame pronoun")];

export const SELF_REFERENCE: Pattern[] = [p("\\b(i|me|my|mine|myself)\\b", "self-reference")];

export const DEFLECTION: Pattern[] = [
  p("\\b(anyway|but anyway|moving on|changing the subject|let's not|lets not|can we not)\\b", "topic redirection"),
  p("\\b(why does it matter|why are you asking|what about you|what about when you)\\b", "returning the question instead of answering it"),
];

export const PERFORMATIVE: Pattern[] = [
  p("\\b(no worries at all|happy to help|totally fine|all good!|sounds great!|perfect!|amazing!)\\b", "formulaic positivity"),
  p("\\b(as per my (last )?(email|message)|circling back|just following up|per my previous)\\b", "scripted professional register"),
  p("\\b(with all due respect|no offen[cs]e but|not to be rude but)\\b", "politeness frame preceding a criticism"),
];

export const ACCOUNTABILITY_SHIFT: Pattern[] = [
  p("\\b(mistakes were made|it got missed|it wasn't communicated|it wasnt communicated|there was a miscommunication)\\b", "agentless framing of a failure"),
  p("\\b(i thought you were|i assumed you|wasn't clear to me|wasnt clear to me)\\b", "responsibility relocated to the other party"),
];

export const GUILT: Pattern[] = [
  p("\\b(don't worry about me|dont worry about me|i'll be fine|ill be fine|it's fine, really|its fine, really)\\b", "self-effacing framing that invites reassurance"),
  p("\\b(i suppose i'll just|guess i'll just|guess ill just|i'll manage on my own|ill manage on my own)\\b", "martyr framing"),
  p("\\b(after all i('ve| have) done for you|i sacrificed)\\b", "explicit debt claim"),
];

export const BOUNDARY_PRESSURE: Pattern[] = [
  p("\\b(just this once|it's not a big deal|its not a big deal|why do you have to make it|you're making this difficult|youre making this difficult)\\b", "minimising a stated limit"),
  p("\\b(i'll just come over|ill just come over|i already told them yes|i said you would)\\b", "committing the other person without consent"),
];

export const FADE: Pattern[] = [
  p("\\b(been really busy|so busy lately|swamped|crazy week|been meaning to)\\b", "availability framed as a constant condition"),
  p("\\b(we'll see|well see|maybe sometime|at some point|one of these days|let's play it by ear|lets play it by ear)\\b", "unbounded deferral"),
];

export const DEADLINE_PRESSURE: Pattern[] = [
  p("\\b(deadline|due (today|tomorrow|friday|monday)|behind schedule|slipping|blocker|urgent|escalat)\\b", "schedule pressure language"),
];

export const PROFESSIONAL: Pattern[] = [
  p("\\b(regards|kind regards|best,|please find|kindly|scheduled|action items?|deliverable|stakeholders?)\\b", "formal register"),
];

/** Count matches for a lexicon across a text, returning the matched spans. */
export function matchAll(text: string, patterns: Pattern[]): { span: string; why: string }[] {
  const out: { span: string; why: string }[] = [];
  for (const pat of patterns) {
    const re = new RegExp(pat.re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0]) out.push({ span: m[0], why: pat.why });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return out;
}
