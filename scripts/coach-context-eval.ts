import { analyze } from "../lib/engine/analyze";
import { checkLexicon } from "../lib/legitimacy";
import type { ContextId } from "../lib/engine/types";

interface CoachCase {
  id: string;
  context: ContextId;
  text: string;
  mustInclude: string[];
}

const cases: CoachCase[] = [
  {
    id: "partner-repair",
    context: "partner",
    text: "Me: I feel like we keep missing each other.\nMaya: I am tired of having the same argument.\nMe: I want to fix it, not win it.",
    mustInclude: ["care about us", "needs"],
  },
  {
    id: "boss-specifics",
    context: "work",
    text: "Me: Is the report ready to send?\nDana: Redo it.\nMe: Which sections need changing?\nDana: You should know.",
    mustInclude: ["expected outcome", "deadline", "in writing"],
  },
  {
    id: "amazon-marketplace",
    context: "marketplace",
    text: "Me: Is this the same item shown in the listing?\nSeller: Pay me directly and I can ship it faster.\nMe: Can we keep it through Amazon?\nSeller: No, use this link.",
    mustInclude: ["platform chat", "platform checkout", "off-platform"],
  },
  {
    id: "friend-repair",
    context: "friendship",
    text: "Me: I miss you. Are we okay?\nAlex: Just busy.\nMe: It has felt different lately.\nAlex: I do not know what you want me to say.",
    mustInclude: ["value our friendship", "rather ask than assume"],
  },
  {
    id: "stranger-boundary",
    context: "stranger",
    text: "Me: I do not know you.\nUnknown: Send me your address and phone number.\nMe: Why?\nUnknown: Just do it now.",
    mustInclude: ["not comfortable sharing", "do not contact me again"],
  },
  {
    id: "dating-clarity",
    context: "dating",
    text: "Me: Would you like to meet again?\nSam: Maybe sometime.\nMe: Are you free this weekend?\nSam: We will see.",
    mustInclude: ["interested in continuing", "prefer clarity"],
  },
];

let failures = 0;
for (const c of cases) {
  const result = analyze(c.text, c.context, "Me", "months");
  if (result.kind !== "analysis") {
    console.error(`FAIL ${c.id}: ordinary conversation entered care path`);
    failures++;
    continue;
  }

  const coachText = result.analysis.coach
    .flatMap((s) => [s.action, s.suggestedReply ?? "", s.reasoning])
    .join(" ");

  if (!result.analysis.coach.some((s) => Boolean(s.suggestedReply))) {
    console.error(`FAIL ${c.id}: no sendable reply`);
    failures++;
  }
  for (const expected of c.mustInclude) {
    if (!coachText.toLowerCase().includes(expected.toLowerCase())) {
      console.error(`FAIL ${c.id}: missing context safeguard “${expected}”`);
      failures++;
    }
  }
  const banned = checkLexicon(coachText);
  if (banned.length) {
    console.error(`FAIL ${c.id}: banned claim(s): ${banned.join(", ")}`);
    failures++;
  }
}

const crisis = analyze(
  "Me: Are you safe?\nAlex: Everyone would be better off without me and I do not want to be here anymore.",
  "partner",
  "Me"
);
if (crisis.kind !== "distress") {
  console.error("FAIL crisis invariant: Answer Coach must be replaced by the care path");
  failures++;
}

if (failures) {
  console.error(`\nAnswer Coach context gate failed: ${failures} issue(s).`);
  process.exit(1);
}

console.log(`Answer Coach context gate passed: ${cases.length} contexts + crisis invariant.`);
