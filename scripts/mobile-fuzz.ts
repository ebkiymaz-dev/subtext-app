import { analyze } from "../lib/engine/analyze";
import type { ContextId, FamiliarityId } from "../lib/engine/types";

const contexts: ContextId[] = [
  "dating", "friendship", "family", "work", "roommate",
  "ex_partner", "business", "marketplace", "neighbor", "other",
];
const familiarities: FamiliarityId[] = ["days", "months", "year", "five_years", "lifetime"];
const lines = [
  "Alex: Are we still meeting tonight?",
  "Me: Yes — I can be there at 7 😊",
  "Alex: Okay… let me know.",
  "Me: I will. Is everything alright?",
  "[20/08/2026, 17:02] José: ¿Todavía vienes?",
  "[20/08/2026, 17:03] Me: Sí, llego pronto.",
  "李: 我今天会晚一点。",
  "Me: 好的，谢谢你告诉我。",
  "Sam: 👍",
  "Me: Thanks",
  "Manager: Please revisit the attached plan — the scope isn't final.",
  "Me: Understood. I'll send a revised version tomorrow.",
];

let runs = 0;
for (let index = 0; index < 1_000; index += 1) {
  const count = 1 + (index % lines.length);
  const separator = ["\n", "\r\n", "\r"][index % 3];
  const paste = Array.from({ length: count }, (_, offset) => lines[(index + offset) % lines.length]).join(separator);
  const result = analyze(
    paste,
    contexts[index % contexts.length],
    undefined,
    familiarities[index % familiarities.length]
  );
  if (result.kind === "analysis" && !result.analysis.headline.trim()) {
    throw new Error(`Empty headline at run ${index}`);
  }
  runs += 1;
}

console.log(`mobile-fuzz: ${runs} mixed-format and Unicode analyses passed`);
