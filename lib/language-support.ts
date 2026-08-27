export type LanguageAssessment = {
  status: "english" | "non_english" | "uncertain";
  code?: string;
  score?: number;
  reason: string;
};

const NON_LATIN_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Thai}\p{Script=Greek}\p{Script=Armenian}\p{Script=Georgian}\p{Script=Ethiopic}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Sinhala}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Lao}\p{Script=Tibetan}]/gu;

export function analysisText(raw: string): string {
  return raw
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/^\s*(?:\[[^\]]+\]\s*)?[^:\n]{1,48}:\s*/u, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyLanguageRanking(
  text: string,
  ranked: Array<[string, number]>
): LanguageAssessment {
  const prepared = analysisText(text);
  const nonLatinCount = prepared.match(NON_LATIN_SCRIPT)?.length ?? 0;
  if (nonLatinCount >= 2) {
    return { status: "non_english", reason: "non-Latin script detected" };
  }

  const letters = prepared.match(/\p{L}/gu)?.length ?? 0;
  const words = prepared.match(/[\p{L}\p{N}'’]+/gu)?.length ?? 0;
  if (letters < 70 || words < 12) {
    return { status: "uncertain", reason: "conversation is too short for safe automatic language detection" };
  }

  const first = ranked[0];
  const english = ranked.find(([code]) => code === "eng");
  if (!first || first[0] === "und") {
    return { status: "uncertain", reason: "language detector returned no reliable language" };
  }
  if (first[0] === "eng" && first[1] >= 0.92) {
    return { status: "english", code: "eng", score: first[1], reason: "English language pattern detected" };
  }
  const englishScore = english?.[1] ?? 0;
  if (first[0] !== "eng" && first[1] >= 0.86 && first[1] - englishScore >= 0.08) {
    return { status: "non_english", code: first[0], score: first[1], reason: `${first[0]} language pattern detected` };
  }
  return { status: "uncertain", code: first[0], score: first[1], reason: "automatic language detection was ambiguous" };
}

export async function assessEnglishReadiness(text: string): Promise<LanguageAssessment> {
  const prepared = analysisText(text);
  // Script and short-text gates avoid loading the 186-language detector when
  // the outcome can already be decided safely.
  const preliminary = classifyLanguageRanking(prepared, []);
  if (preliminary.status !== "uncertain" || !prepared || (prepared.match(/\p{L}/gu)?.length ?? 0) < 70) {
    return preliminary;
  }
  const { francAll } = await import("franc");
  return classifyLanguageRanking(prepared, francAll(prepared, { minLength: 30 }).slice(0, 12));
}
