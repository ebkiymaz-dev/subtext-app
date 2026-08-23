// PATTERN LEXICONS — the deterministic half of the engine.
// Each entry is a phrase or regex plus the plain-English reason it matters.
// These produce the EVIDENCE that makes every score citable (Law 2).
//
// v2 note: the lexicons below stopped being "sentiment word lists" and became
// MOVE detectors. A move is a thing a turn DOES — opens, closes, invites,
// defers, reciprocates, raises the register. Counting sentiment words is what
// made v1 report 49% for everything; reading moves is what lets a two-line
// exchange produce a sharp, defensible read.

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

/** Amplifiers. Density matters: high intensifier use marks investment or strain. */
export const INTENSIFIERS: Pattern[] = [
  p("\\b(so|really|very|super|totally|absolutely|completely|incredibly|insanely|massively|genuinely|literally|seriously)\\b", "intensifier — raises the emotional temperature of the claim"),
  p("\\b(soo+|reallyy+|yesss+|omg|ahh+)\\b", "elongation — spontaneous emphasis"),
  p("!{2,}", "repeated exclamation"),
];

/** Downtoners. The mirror image: they cool a claim down. */
export const DIMINISHERS: Pattern[] = [
  p("\\b(a little|slightly|barely|hardly|just about|more or less|i guess so|sort of fine)\\b", "downtoner — cools the claim"),
];

export const DISTANCING: Pattern[] = [
  p("\\b(that person|the situation|things happened|it happened|whatever happened)\\b", "distancing language avoids naming the actor"),
  p("\\b(as i said|like i said|i already told you)\\b", "closing down the topic rather than answering it"),
];

export const WARMTH: Pattern[] = [
  p("\\b(miss you|love you|thank you so much|appreciate you|proud of you|glad|happy for you|thinking of you|means a lot|made my day)\\b", "explicit warmth"),
  p("\\b(can't wait|cant wait|excited|looking forward)\\b", "anticipation toward the other person"),
  p("(❤️|🥰|😊|😍|🤗|💕|😘|🥹)", "affectionate emoji"),
];

/**
 * DISTANCE markers. Not coldness — *register*. These are the phrasings people
 * reach for when they want to be correct rather than close: agreeable,
 * unobjectionable, and carrying no invitation.
 */
export const DISTANCE: Pattern[] = [
  p("\\b(no worries|it's fine|its fine|that's fine|thats fine|all good|no problem|whatever works|if you want|up to you|as you like|either way)\\b", "agreeable but non-committal — accepts without inviting"),
  p("\\b(hope you('re| are) well|hope all is well|best wishes|all the best|take care)\\b", "correct rather than close — the register of an acquaintance"),
  p("\\b(ok|okay|k|kk|cool|sure|alright|right|noted|understood|received|fair enough|got it)\\s*[.!]?$", "terminal acknowledgement — receives the message without extending it"),
];

/**
 * FULL-FORM POLITENESS. This is the load-bearing v2 lexicon.
 *
 * "thanks" and "thank you" mean the same thing and do completely different
 * work. The contracted form is intimate register; the full form is formal
 * register. When someone answers warmth with the FULL form, they have chosen
 * — usually without thinking about it — to answer in a more distant register
 * than the one they were addressed in. That asymmetry is one of the most
 * reliable soft-signals in text, and v1 could not see it at all.
 */
export const POLITENESS_FULL: Pattern[] = [
  p("\\bthank you\\b", "full-form thanks — the formal register of the pair (compare “thanks”)"),
  p("\\bgood night\\b", "full-form sign-off (compare “night”)"),
  p("\\bgood (morning|evening|afternoon)\\b", "full-form greeting"),
  p("\\byou'?re welcome\\b", "formal acknowledgement"),
  p("\\b(that'?s very kind|i appreciate (it|that)|much appreciated|very kind of you)\\b", "formal appreciation — completes the exchange rather than extending it"),
  p("\\b(my apologies|i do apologise|i do apologize|kindly|please do|regards|sincerely)\\b", "raised register"),
];

/** The intimate-register counterparts. Their presence lowers formality. */
export const POLITENESS_CASUAL: Pattern[] = [
  p("\\b(thanks|thx|ty|tysm|cheers|np|nps)\\b", "contracted thanks — intimate register"),
  p("\\b(night|nite|gnight|nini|morning)\\s*[!x]*$", "contracted sign-off — intimate register"),
  p("\\b(hey|yo|heyy+|hiya|sup)\\b", "informal greeting"),
];

/**
 * CLOSING MOVES — a turn that works to end the exchange.
 * Distinguished from mere brevity: a short answer continues a conversation,
 * a sign-off retires it.
 */
export const CLOSING_MOVES: Pattern[] = [
  p("\\b(good ?night|goodnight|gnight|nite|night)\\b\\s*[!.…]*$", "sign-off — retires the conversation for the night"),
  p("\\b(bye|byee+|goodbye|see you|see ya|cya|ttyl|talk (to you )?(later|soon)|catch you later|later!|speak soon)\\b", "explicit farewell"),
  p("\\b(take care|sleep well|sweet dreams|have a good (one|night|evening|day)|enjoy your (night|evening|weekend))\\b", "valedictory formula"),
  p("\\b(gotta go|got to go|heading (to bed|off|out)|i'?m off|going to sleep|off to bed|need to sleep|calling it a night)\\b", "states an exit"),
  p("\\b(anyway,? (that'?s|thats) (it|all)|that'?s everything|nothing else|we'?ll (speak|talk) (then|later)|let'?s (leave|park) it (there|here))\\b", "wraps the topic up"),
  p("\\b(monday is fine|we'?ll cover it|we'?ll discuss (it )?(then|monday)|let'?s discuss)\\b", "defers the topic out of the current exchange"),
];

/**
 * CONTINUATION BIDS — a turn that hands the floor back.
 * The mirror of a closing move, and the reason "closing vs continuing" is a
 * single axis rather than two unrelated counts.
 */
export const CONTINUATION_BIDS: Pattern[] = [
  p("\\b(what about you|how about you|wbu|hbu|and you\\?|you\\?)", "returns the floor explicitly"),
  p("\\b(tell me more|say more|go on|what happened|how come|and then|what did .{0,20}say)\\b", "asks for elaboration"),
  p("\\b(are you free|when are you|want to|wanna|shall we|should we|let'?s|how about (we|tomorrow|tonight)|are you around)\\b", "proposes a next step"),
  p("\\b(also|btw|by the way|oh and|one more thing|speaking of)\\b", "opens an additional thread"),
  p("\\b(tomorrow|tonight|this (weekend|week)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\\b", "anchors the future to a specific point"),
];

/**
 * AFFIRMATION PARTICLES. A turn that opens with one of these is ANSWERING,
 * even when it shares no vocabulary with the question.
 *
 * This lexicon exists because of a false negative the eval caught: "are we
 * still on for 7?" / "yep! I'll be there about 6.50" has zero content-word
 * overlap, and a topic-overlap test alone scored a perfectly healthy exchange
 * as disengaged. Answering is not always echoing.
 */
export const AFFIRM: Pattern[] = [
  p("^\\W*(oh\\s+)?(yep|yeah|yes|yup|yah|sure|absolutely|of course|definitely|certainly|will do|sounds? like a plan)\\b", "turn-initial affirmative — this is an answer, not a change of subject"),
];

/** Commitment language: a turn that takes on an action is engaging with it. */
export const COMMITMENT: Pattern[] = [
  p("\\b(i'?ll|i will|i can|i'?m going to|i'?ve booked|i'?ll book|i'?ll be there|i'?ll grab|count me in|see you there)\\b", "commits to an action — uptake, not deflection"),
];

/**
 * FUTURE ANCHORS — a specific point in time, not a vague gesture at one.
 * "Thursday" and "8pm" are anchors; "this week" and "soon" are not, which is
 * exactly the distinction a fade depends on. Kept separate from
 * CONTINUATION_BIDS because that list is deliberately looser.
 */
export const FUTURE_ANCHOR: Pattern[] = [
  p("\\b(tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month)\\b", "a specific point in the future"),
  p("\\b(\\d{1,2}\\s?(am|pm)|at \\d{1,2}(:\\d{2})?|\\d{1,2}:\\d{2})\\b", "a specific time"),
  p("\\b(i'?ll book|i'?ve booked|i'?ll sort|let'?s say)\\b", "commits to arranging it"),
];

/** BIDS FOR CONNECTION — Gottman's unit. Each kind is detected separately. */
export const BID_COMPLIMENT: Pattern[] = [
  p("\\byou (look|looked|are|were|seem|seemed)\\s+(so\\s+|really\\s+|absolutely\\s+|very\\s+)?(amazing|beautiful|gorgeous|stunning|lovely|great|good|incredible|handsome|pretty|cute|radiant|wonderful|fantastic)\\b", "a compliment — an attempt to connect, and one of the more exposed kinds"),
  p("\\b(i love your|i really like your|you'?re so (good|clever|funny|kind|talented|smart)|you'?re the (best|sweetest)|that was (brilliant|amazing|so good))\\b", "praise directed at the other person"),
  p("\\b(you (did|were) (great|amazing|brilliant|so well)|proud of you|well done)\\b", "praise for something they did"),
];

export const BID_AFFECTION: Pattern[] = [
  p("\\b(miss you|love you|thinking of you|thinking about you|wish you were here|can'?t stop thinking)\\b", "an expression of affection — a very exposed attempt to connect"),
];

export const BID_INVITATION: Pattern[] = [
  p("\\b(are you free|want to (meet|grab|get|go|come)|wanna (meet|grab|get|go|come)|shall we|let'?s (meet|grab|get|go|do)|same again|do you want to|fancy a|dinner|drinks|coffee)\\b", "an invitation — a concrete attempt to continue the connection"),
];

export const BID_SELF_DISCLOSURE: Pattern[] = [
  p("\\b(i'?ve been (feeling|struggling|thinking|worried)|i feel|i felt|i'?m (worried|nervous|scared|upset|hurt|sad|lonely)|to be honest,? i|i wanted to tell you|it'?s been hard)\\b", "self-disclosure — an attempt to be understood, not necessarily solved"),
];

export const BID_NEWS: Pattern[] = [
  p("\\b(guess what|you'?ll never guess|i (just )?got|i finally|big news|i passed|i got the|it happened)\\b", "shared news — an invitation to celebrate together"),
];

export const BID_HELP: Pattern[] = [
  p("\\b(can you|could you|would you mind|do you think you could|any chance you|i need a hand|help me)\\b", "a request — a direct ask for help or action"),
];

/** ENTHUSIASM — the marker set, so we can ask WHERE it lands, not just whether it exists. */
export const ENTHUSIASM: Pattern[] = [
  p("!+", "exclamation"),
  p("\\b(yes+|yay+|woo+|omg|amazing|awesome|brilliant|love it|so good|can'?t wait|cant wait|excited)\\b", "enthusiasm word"),
  p("(😄|😁|🤣|😂|🔥|🎉|😍|🥳|💯)", "high-arousal emoji"),
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

export const OTHER_REFERENCE: Pattern[] = [p("\\b(you|your|yours|u|ur)\\b", "second-person reference")];

export const DEFLECTION: Pattern[] = [
  p("\\b(anyway|but anyway|moving on|changing the subject|let's not|lets not|can we not)\\b", "topic redirection"),
  p("\\b(why does it matter|why are you asking|what about when you)\\b", "returning the question instead of answering it"),
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

/**
 * ANCHORING AND LEVERAGE — the negotiation context.
 *
 * These are not sentiment. They are the four standard moves for shifting a
 * counterparty's reference point: put a number down first, cap it, invent
 * competition, invent a clock. Naming them is useful precisely because they
 * work on people who cannot see them.
 */
export const ANCHORING: Pattern[] = [
  p("\\b(best (i|we) can do|final offer|take it or leave it|that'?s my (last|final)|non-?negotiable|firm (on|at))\\b", "commitment tactic — the number is framed as fixed"),
  p("\\b(i (have|'ve) (got )?(other|another) (offers?|buyers?|interested|people)|someone else is (interested|coming)|several people (want|are))\\b", "manufactured competition — raises your sense of scarcity"),
  p("\\b(only (today|until)|offer (expires|ends)|by (end of|close of) (day|business|play)|need an answer (today|by)|this (deal|price) (won'?t|wont) last)\\b", "manufactured clock — compresses your time to think"),
  p("\\b(ballpark|starting at|around \\$?[0-9]|somewhere in the region|we were thinking (about )?\\$?[0-9])\\b", "opening anchor — the first number spoken sets the range"),
  p("\\b(meet (you )?in the middle|split the difference|throw in|sweeten)\\b", "concession framing"),
];

/**
 * COMMITMENT SPECIFICITY — the marketplace / logistics contexts.
 *
 * The only question that matters when two people are arranging a real-world
 * thing is whether the message contains a number, a time and a place. This
 * lexicon is deliberately split: presence of CONCRETE is the good signal,
 * presence of VAGUE where CONCRETE was requested is the bad one.
 */
export const CONCRETE_COMMITMENT: Pattern[] = [
  p("\\b([01]?[0-9]|2[0-3])[:.][0-5][0-9]\\b", "an actual clock time"),
  p("\\b([0-9]{1,2})\\s?(am|pm)\\b", "an actual clock time"),
  p("\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|today)\\b", "a named day"),
  p("[£$€]\\s?[0-9][0-9,.]*", "an actual figure"),
  p("\\b(i can (do|be there|make it)|i'?ll be there|see you (at|on)|address is|postcode|zip)\\b", "a commitment with an actor and a time attached"),
];

export const VAGUE_COMMITMENT: Pattern[] = [
  p("\\b(sometime|some point|later (today|this week)?|soon|shortly|in a bit|when i(')?m free|when i can|let me get back|i'?ll let you know|i'?ll check)\\b", "a commitment with no time attached"),
  p("\\b(interested|still available\\??|is (this|it) still)\\b", "an enquiry that commits to nothing"),
  p("\\b(what'?s your best price|open to offers|make me an offer|whats your lowest)\\b", "price probe with no figure offered in return"),
];

/**
 * FIXED POLITENESS PHRASES that contain a second-person pronoun but carry no
 * actual reference to the person. Stripped before we ask "does this reply
 * mention the other person at all?" — otherwise "thank you" scores as
 * attentiveness, which is precisely backwards.
 */
export const FIXED_POLITE_PHRASES = [
  "thank you",
  "thanks",
  "you're welcome",
  "youre welcome",
  "see you",
  "take care",
  "bless you",
  "excuse me",
  "how are you",
  "hope you're well",
  "hope youre well",
];

/**
 * FUNCTION-WORD FAMILIES for Language Style Matching. LSM is computed over
 * function words only, on purpose: content words tell you what a conversation
 * is about, function words tell you how in step the two people are.
 */
export const FUNCTION_WORD_FAMILIES: Record<string, string[]> = {
  personalPronouns: ["i", "me", "my", "mine", "myself", "we", "us", "our", "you", "your", "yours", "he", "she", "they", "them", "his", "her", "their"],
  impersonalPronouns: ["it", "its", "this", "that", "these", "those", "which", "what", "anything", "something", "nothing", "everything"],
  articles: ["a", "an", "the"],
  prepositions: ["of", "in", "to", "for", "with", "on", "at", "from", "by", "about", "into", "over", "after", "under", "between"],
  auxiliaryVerbs: ["am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "can", "could", "should", "might", "must"],
  conjunctions: ["and", "but", "or", "so", "because", "if", "when", "while", "although", "though", "as"],
  negations: ["no", "not", "never", "none", "cant", "cannot", "dont", "wont", "isnt", "wasnt", "didnt", "nothing"],
  quantifiers: ["all", "some", "any", "most", "much", "many", "few", "lot", "lots", "more", "less"],
  adverbs: ["very", "really", "just", "so", "too", "quite", "also", "still", "even", "always", "never", "here", "there", "now", "then"],
};

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

/** First match only — used where one citable span is enough. */
export function firstMatch(text: string, patterns: Pattern[]): { span: string; why: string } | null {
  return matchAll(text, patterns)[0] ?? null;
}
