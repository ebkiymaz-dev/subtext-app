// Deliberately narrow regression guards, not a semantic truth detector.
// Rejected drafts are withheld; we never silently rewrite a user's commitments.
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
const timingClaims = /\b(?:in quick succession|rapid[- ]fire|(?:repl(?:ied|y)|responded|answered) immediately|immediate (?:repl(?:y|ies)|responses?)|within (?:\d+|a few|several|two|three|five|ten) (?:seconds?|minutes?|hours?)|(?:quick|slow|delayed|instant) (?:repl(?:y|ies)|responses?))\b/gi;
const commitments = /\b(?:today|tonight|tomorrow(?: morning| afternoon| evening| night)?|(?:this|next) (?:week|month|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}\s*[ap]m|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi;
const amounts = /(?:[$€£₺]\s*\d+(?:[.,]\d+)*|\b\d+(?:[.,]\d+)*\s*(?:USD|EUR|GBP|TRY|dollars?|euros?|pounds?|lira)\b)/gi;
const coerciveTactics = /\b(?:make (?:them|him|her) jealous|play hard to get|give (?:them|him|her) the silent treatment|punish (?:them|him|her) with silence|test (?:their|his|her) loyalty|monitor (?:their|his|her) (?:online status|read receipts?|location)|check (?:their|his|her) location|post (?:something )?to (?:provoke|bait) (?:them|him|her)|wait (?:exactly )?\d+ (?:hours?|days?) (?:so|to make))\b/i;

export function hasUnqualifiedReading(explanation: string): boolean {
  // Require the uncertainty at the start, not a disclaimer tacked onto a claim.
  return !/^(?:(?:one|another|a|an alternative) (?:possibility|possible reading|possible explanation|interpretation|reading)\b|(?:perhaps|possibly)\b|[^.!?\n]{0,100}\b(?:may|might|could|cannot tell|can't tell)\b)/i.test(explanation.trim());
}

function unsupported(text: string, pattern: RegExp, messages: string[]): boolean {
  return [...text.matchAll(pattern)].some(([phrase]) => !messages.some(message => message.includes(normalize(phrase))));
}

export function coachGroundingFailure(args: {
  messages: string[];
  prose: string[];
  replies: string[];
}): string | null {
  const messages = args.messages.map(normalize);
  if ([...args.prose, ...args.replies].some(text => coerciveTactics.test(text))) {
    return "The draft recommended manipulation, retaliation, or surveillance.";
  }
  // The prompt receives message wording/order, not reliable elapsed-time metadata.
  if (args.prose.some(text => unsupported(text, timingClaims, messages))) {
    return "The draft inferred response timing that was not in the conversation.";
  }
  for (const reply of args.replies) {
    // Explicit editable slots are allowed, but never count as source evidence.
    const withoutSlots = reply.replace(/\[[^\[\]\r\n]{1,120}\]/g, "");
    if (unsupported(withoutSlots, commitments, messages) || unsupported(withoutSlots, amounts, messages)) {
      return "A reply introduced an unsupported date, time, or payment amount.";
    }
  }
  return null;
}
