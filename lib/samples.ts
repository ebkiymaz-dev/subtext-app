// THE OPENING SHOWCASE — shown before signup, no gate.
// Card order is deliberate: dating (the viral wow) → boss (proves it is not a
// dating toy) → distress LAST, as the closer. Showing that the product knows
// when to STOP is what earns the right to be trusted with private messages.

import type { ContextId, FamiliarityId } from "./engine/types";

export interface Sample {
  id: string;
  label: string;
  blurb: string;
  context: ContextId;
  /** every sample carries a plausible history, because the engine now reads
   *  register against it — a sample with no familiarity would be tuned by a
   *  default the user never chose. */
  familiarity: FamiliarityId;
  youName: string;
  text: string;
  /** true = this sample deliberately trips the crisis-safety screen */
  triggersCare?: boolean;
}

export const SAMPLES: Sample[] = [
  {
    // Eleven words, and the engine has plenty to say about them. This card
    // exists because it is the clearest demonstration of what v2 does that a
    // word-counting engine cannot: nothing here is negative, nothing is
    // hedged, and the structure is unmistakable.
    id: "polite-close",
    familiarity: "days",
    label: "Two lines",
    blurb:
      "A compliment, and a polite goodbye. Nothing negative in it anywhere — and eleven words is enough to read.",
    context: "dating",
    youName: "You",
    text: `You: You looked amazing today
Them: thank you, good night!`,
  },
  {
    id: "dating-fade",
    familiarity: "months",
    label: "The slow fade",
    blurb: "Warm words, no dates attached. What the phrasing is actually doing.",
    context: "dating",
    youName: "You",
    text: `You: Had such a good time on Thursday. Same again this week?
Sam: yeah that was fun :)
You: Are you free Friday or Saturday?
Sam: honestly this week is insane, work has been swamped
You: No worries. Next week maybe?
Sam: we'll see! I've been meaning to catch up properly
You: Is everything okay? You seem a bit distant
Sam: kind of just busy, nothing to worry about
You: Okay. Let me know when you're free and I'll book something
Sam: sounds good, one of these days for sure`,
  },
  {
    id: "terse-boss",
    familiarity: "year",
    label: "The terse message from your boss",
    blurb: "Four words on a Friday afternoon. Work context changes what matters.",
    context: "work",
    youName: "You",
    text: `You: Hi Dana — the Q3 deck is ready for your review, happy to walk through it whenever suits.
Dana: Received.
You: Any initial thoughts? I can turn changes around today if it's urgent.
Dana: Let's discuss Monday.
You: Sure — is there anything specific you'd like me to prepare for that?
Dana: As per my previous message, Monday.
You: Understood. Was there an issue with the approach?
Dana: There was a miscommunication about scope. It wasn't clear to me what was agreed. We'll cover it Monday.
You: Happy to clarify now if that helps?
Dana: Monday is fine. Regards.`,
  },
  {
    id: "care-path",
    familiarity: "five_years",
    label: "The 2am message",
    blurb:
      "The closer. When the language carries acute-distress markers, Subtext stops analysing and shows resources instead.",
    context: "friendship",
    youName: "You",
    triggersCare: true,
    text: `You: hey, you've been quiet all week. everything okay?
Jamie: not really. everything feels pointless lately
You: what's going on?
Jamie: I don't know. I'm just so tired of everything. honestly sometimes I think everyone would be better off without me
You: that scares me a bit. can we talk properly?
Jamie: I don't want to be a burden, nothing matters anyway`,
  },
  {
    id: "family-guilt",
    familiarity: "lifetime",
    label: "The family ask",
    blurb: "Obligation framing, and the limit that keeps being worked around.",
    context: "family",
    youName: "You",
    text: `Mum: Are you coming on Sunday? Everyone else has confirmed.
You: I told you last week I can't do Sundays this month, I'm working.
Mum: It's not a big deal, just this once. I already told them you would.
You: I really can't, I'm sorry.
Mum: After everything I've done for you, one Sunday. But don't worry about me, I'll manage on my own.
You: That's not fair.
Mum: I never said that. You're making this difficult. Everyone else finds the time.`,
  },
];

export const sampleById = (id: string) => SAMPLES.find((s) => s.id === id);
