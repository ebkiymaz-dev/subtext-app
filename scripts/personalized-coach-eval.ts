import { buildAnswerCoachPrompt, validatePersonalizedCoach, type CoachGoalId } from "../lib/engine/answerCoach";
import { segment, setYou } from "../lib/engine/segment";
import type { ContextId } from "../lib/engine/types";

const cases: { id: string; context: ContextId; goal: CoachGoalId; text: string; safety: string }[] = [
  { id: "partner-repair", context: "partner", goal: "repair", text: "Me: I want to fix this without fighting.\nMaya: I want that too, but I need time tonight.", safety: "No special safety concern is visible." },
  { id: "boss-record", context: "work", goal: "decision", text: "Me: Which scope should I deliver Friday?\nDana: Just use your judgment, but do not get it wrong.", safety: "Keep scope and deadline confirmation in writing." },
  { id: "marketplace-off-platform", context: "marketplace", goal: "boundary", text: "Me: Can I pay through Amazon?\nSeller: No, use my private payment link now.", safety: "Keep payment and communication on the marketplace platform." },
  { id: "friend-ordinary", context: "friendship", goal: "understand", text: "Me: Are we still on for lunch?\nAlex: Yes, 12:30 works. See you there.", safety: "No special safety concern is visible." },
  { id: "stranger-privacy", context: "stranger", goal: "end", text: "Me: I do not know you.\nUnknown: Send your address and phone number now.", safety: "Do not share personal information with an unknown person." },
  { id: "family-pressure", context: "family", goal: "boundary", text: "Me: I cannot lend money this month.\nParent: Family would do it. Answer me today.", safety: "The user can pause before making a financial decision." },
  { id: "dating-clarity", context: "dating", goal: "decision", text: "Me: Would you like to meet Saturday?\nSam: Maybe sometime, we will see.", safety: "No special safety concern is visible." },
  { id: "ex-topic-limit", context: "ex_partner", goal: "boundary", text: "Me: I can discuss the lease only.\nJordan: Then tell me whether you still love me.", safety: "Keep the exchange to the agreed practical topic." },
];

let failures = 0;
for (const item of cases) {
  const transcript = setYou(segment(item.text), "Me");
  const first = transcript.messages[0]?.text ?? "";
  const second = transcript.messages[1]?.text ?? "";
  const prompt = buildAnswerCoachPrompt({ transcript, context: item.context, familiarity: "months", goal: item.goal, tone: "direct", youName: "Me" });
  if (!prompt.includes(item.text.split("\n")[0].split(": ")[1]) || !prompt.includes("USER GOAL")) { console.error(`FAIL ${item.id}: prompt lost the transcript or goal`); failures++; }
  const fixture = {
    summary: "The exchange contains a clear request and a reply that changes or limits what can happen next.",
    observations: [{ observation: "The user makes a specific move.", quote: first }, { observation: "The other person answers in a different direction.", quote: second }],
    possibleReadings: [{ title: "Practical reading", explanation: "One possibility is that the reply reflects the immediate situation rather than a stable attitude.", quotes: [second] }, { title: "Boundary reading", explanation: "Another possibility is that the reply leaves the user's request unresolved.", quotes: [first, second] }],
    userContribution: "The user's wording is direct; the excerpt is too short to infer a wider pattern.",
    recommendedApproach: "Keep the next message specific, proportionate, and aligned with the user's stated goal.",
    replies: [
      { style: "warm", text: "I want to handle this well. Can we agree one clear next step?", why: "It preserves connection and asks for clarity.", tradeoff: "It leaves more room for discussion." },
      { style: "direct", text: "Please answer the specific question so I can decide what to do next.", why: "It makes the missing answer visible.", tradeoff: "It may feel firmer." },
      { style: "boundary", text: "I will not proceed without a clear answer. I am pausing this conversation for now.", why: "It protects the user's agency without controlling the other person.", tradeoff: "It prioritizes safety and clarity over continued engagement." },
    ],
    avoid: ["Do not add accusations that the excerpt cannot support."],
    safetyNote: item.safety,
    confidence: { level: "low", why: "Only a short excerpt is available." },
  };
  const checked = validatePersonalizedCoach(fixture, transcript);
  if (!checked.coach) { console.error(`FAIL ${item.id}: valid fixture rejected (${checked.fatal})`); failures++; }

  const invented = structuredClone(fixture);
  invented.observations[0].quote = "This line was never in the conversation";
  const repaired = validatePersonalizedCoach(invented, transcript);
  if (!repaired.coach || repaired.coach.observations.some((observation) => observation.quote.includes("never in"))) { console.error(`FAIL ${item.id}: invented quote survived`); failures++; }
}

const transcript = setYou(segment("Me: Can we talk?\nSam: Tomorrow works."), "Me");
const unsafe = { summary: "They are manipulating you.", observations: [], possibleReadings: [], userContribution: "None", recommendedApproach: "Test them.", replies: [], avoid: [], safetyNote: "None", confidence: { level: "reasonable", why: "Certain." } };
if (validatePersonalizedCoach(unsafe, transcript).coach) { console.error("FAIL banned certainty/intent claims survived"); failures++; }

if (failures) process.exit(1);
console.log(`Personalized Coach gate passed: ${cases.length} contexts, quote grounding, three-style replies, and banned-claim rejection.`);
