// ═════════════════════════════════════════════════════════════
// THE CRISIS-SAFETY SCREEN — A HARD RULE.
//
// This runs BEFORE any analysis and BEFORE any model spend. If acute
// self-harm or suicidality signals are present, the app does NOT score the
// conversation. It replaces the entire surface with a supportive resource
// card. No percentages, no interpretations, no gamification, no paywall.
//
// This is deliberately tuned to over-trigger rather than under-trigger: a
// false positive costs a user one dismissible screen; a false negative is
// unacceptable. Showing the product knows when to STOP is what earns the
// right to be trusted with private messages.
//
// LIVE: this stays a LOCAL classifier — it must fire before anything leaves
// the device, and the crisis links become jurisdiction-aware.
// ═════════════════════════════════════════════════════════════

import type { DistressResult } from "./types";

/** Explicit self-harm / suicidality phrasing. */
const ACUTE = [
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "want to die",
  "wanna die",
  "better off dead",
  "better off without me",
  "not want to be here anymore",
  "don't want to be here anymore",
  "dont want to be here anymore",
  "don't want to exist",
  "take my own life",
  "suicidal",
  "suicide",
  "hurt myself",
  "harm myself",
  "cut myself",
  "overdose",
  "there's no point anymore",
  "theres no point anymore",
  "no reason to keep going",
  "can't do this anymore",
  "cant do this anymore",
  "i give up on everything",
  "goodbye forever",
  "won't be around much longer",
  "wont be around much longer",
];

/** Hopelessness / burden language — only counts alongside another marker. */
const SUPPORTING = [
  "hopeless",
  "worthless",
  "burden to everyone",
  "a burden",
  "nothing matters",
  "no one would notice",
  "nobody would notice",
  "no one would care",
  "nobody would care",
  "so tired of everything",
  "can't keep going",
  "cant keep going",
  "trapped",
  "empty inside",
];

/** Explicit threats, stalking, extortion, coercion, or ignored no-contact boundaries. */
const INTERPERSONAL_DANGER = [
  "i will kill you",
  "i'll kill you",
  "im going to kill you",
  "i'm going to kill you",
  "you will regret",
  "you'll regret",
  "watch your back",
  "i know where you live",
  "i'm coming for you",
  "im coming for you",
  "you can't hide",
  "you cant hide",
  "i won't take no",
  "i wont take no",
  "send the money or",
  "pay me or else",
  "i will post the photos",
  "i'll post the photos",
  "stop contacting me",
  "do not contact me again",
  "leave me alone",
];

export function screenForDistress(text: string): DistressResult {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  const acuteHits = ACUTE.filter((p) => t.includes(p));
  const supportHits = SUPPORTING.filter((p) => t.includes(p));
  const dangerHits = INTERPERSONAL_DANGER.filter((p) => t.includes(p));

  // One explicit marker is enough. Two supporting markers together are enough.
  const selfHarm = acuteHits.length > 0 || supportHits.length >= 2;
  const interpersonalDanger = dangerHits.length > 0;
  const triggered = selfHarm || interpersonalDanger;

  return {
    triggered,
    mode: selfHarm ? "self_harm" : interpersonalDanger ? "interpersonal_danger" : null,
    markers: [...acuteHits, ...supportHits, ...dangerHits],
  };
}

/**
 * Resources shown on the distress path.
 * TODO[live]: make jurisdiction-aware (detect locale → local helpline) on
 * day one of launch. findahelpline.com is the international fallback.
 */
export const CRISIS_RESOURCES = [
  {
    region: "United States & Canada",
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    href: "https://988lifeline.org",
  },
  {
    region: "United States",
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    href: "https://www.crisistextline.org",
  },
  {
    region: "United Kingdom & Ireland",
    name: "Samaritans",
    contact: "Call 116 123",
    href: "https://www.samaritans.org",
  },
  {
    region: "International",
    name: "Find a Helpline",
    contact: "Local helplines in 130+ countries",
    href: "https://findahelpline.com",
  },
];
