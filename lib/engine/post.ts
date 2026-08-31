import type { Analysis, CategoryScore } from "./types";

const POST_CATEGORY_IDS = new Set([
  "affect", "sincerity", "subtext_load", "pressure", "stress",
  "professionalism", "deadline_pressure", "accountability_shift", "guilt",
  "boundary_pressure", "anchoring", "commitment_specificity", "warmth_distance",
]);

function postLanguage(text: string): string {
  return text
    .replace(/\bTheir side\b/gi, "The post")
    .replace(/\btheir side\b/gi, "the post")
    .replace(/\bTheir messages\b/gi, "The post")
    .replace(/\btheir messages\b/gi, "the post")
    .replace(/\bPost author's messages\b/gi, "The post")
    .replace(/\bThe post sound\b/gi, "The post sounds")
    .replace(/\bbetween you\b/gi, "within the post")
    .replace(/\ba other exchange\b/gi, "a standalone post")
    .replace(/\bat a few days of history\b/gi, "without relationship history")
    .replace(/\bon their side\b/gi, "in the post")
    .replace(/\bthey are\b/gi, "the author is")
    .replace(/\bthey\b/gi, "the author")
    .replace(/\bthem\b/gi, "the author")
    .replace(/\btheirs\b/gi, "the author's")
    .replace(/\btheir\b/gi, "the author's");
}

/**
 * A public post has one author and no reply sequence. Remove two-sided metrics
 * rather than fabricating engagement, reciprocity, or conversational power.
 */
export function adaptAnalysisForPost(analysis: Analysis): Analysis {
  const categories = analysis.categories
    .filter((category) => POST_CATEGORY_IDS.has(category.id))
    .map((category): CategoryScore => ({ ...category, read: postLanguage(category.read), caveat: postLanguage(category.caveat) }))
    .sort((a, b) => b.percent - a.percent || b.evidence.length - a.evidence.length);
  const strongest = categories.find((category) => category.percent >= 12);
  const headline = strongest
    ? `The clearest wording pattern is ${strongest.label.toLowerCase()} (${strongest.percent}% evidence strength). ${strongest.read}`
    : "This post does not contain enough strong language markers for a confident deeper read. Treat the wording as limited evidence, not a window into the author's intent.";
  return {
    ...analysis,
    headline,
    categories,
    interpretations: [],
    whatWasntSaid: [
      "A single post cannot show how the author responds to another person.",
      "The wording cannot establish motive, honesty, diagnosis, or what happened outside the screenshot.",
    ],
    methodNotes: [
      "Social-post mode examines only wording that is visible in the post.",
      "Two-sided conversation scores such as engagement, reciprocity, and steering are deliberately omitted.",
      ...analysis.methodNotes,
    ],
  };
}
