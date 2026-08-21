// ═════════════════════════════════════════════════════════════
// THE SEVEN LEGITIMACY LAWS — invariants enforced in code, forever.
// (APPS_CLARIFIED §A1-REFINED.) These are not launch checks; they are the
// difference between a credible instrument and a horoscope that gets
// someone hurt.
// ═════════════════════════════════════════════════════════════

export const LEGITIMACY_LAWS = [
  "Every % is a confidence / markers-present weight — never a probability of fact.",
  "Every score is evidence-cited, or it is not rendered at all.",
  "The distress path always shows resources, never scores, and is never gamified.",
  "Suggestions are options tied to an interpretation — never commands.",
  "No clinical, forensic or legal claims. Ever.",
  "The model cannot drift: strict schema, guardrail prompt, and corroboration against the deterministic signals — on disagreement the lower-confidence honest read wins.",
  "No automatic raw-text storage, no cloud profiles, no surveillance; local archives require explicit opt-in.",
] as const;

/**
 * BANNED LEXICON. In production this is a build-failing lint over every
 * string the app can render. Phrases that assert fact, diagnose, or claim
 * lie-detection are forbidden output — not softened, forbidden.
 */
export const BANNED_PHRASES = [
  "is lying",
  "they lied",
  "lie detector",
  "probability they lied",
  "is manipulating you",
  "has trauma",
  "unresolved trauma",
  "is traumatised",
  "is traumatized",
  "diagnosis",
  "diagnosed",
  "narcissist",
  "sociopath",
  "gaslighting you",
  "definitely",
  "proves that",
] as const;

/** Returns the banned phrases found in a string. Empty array = clean. */
export function checkLexicon(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p));
}

/** Dev guard — every rendered read/interpretation passes through this. */
export function assertLegitimate(text: string, where: string): string {
  const hits = checkLexicon(text);
  if (hits.length && process.env.NODE_ENV !== "production") {
    // Loud in dev, never a crash in front of a user.
    console.warn(`[legitimacy] banned phrasing in ${where}: ${hits.join(", ")}`);
  }
  return text;
}

export const CONFIDENCE_CAPTION =
  "Each percentage shows how strongly that pattern appears in these messages. It does not measure the person's feelings or prove their intent.";
