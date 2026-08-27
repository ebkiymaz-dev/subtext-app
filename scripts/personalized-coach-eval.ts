import { buildAnswerCoachPrompt, validatePersonalizedCoach, type CoachGoalId } from "../lib/engine/answerCoach";
import { segment, setYou } from "../lib/engine/segment";
import type { ContextId } from "../lib/engine/types";
import { coachGroundingFailure, hasUnqualifiedReading } from "../lib/engine/coachGrounding";

const cases: { id: string; context: ContextId; goal: CoachGoalId; text: string; safety: string; participants?: string[] }[] = [
  { id: "partner-repair", context: "partner", goal: "repair", text: "Me: I want to fix this without fighting.\nMaya: I want that too, but I need time tonight.", safety: "No special safety concern is visible." },
  { id: "boss-record", context: "work", goal: "decision", text: "Me: Which scope should I deliver Friday?\nDana: Just use your judgment, but do not get it wrong.", safety: "Keep scope and deadline confirmation in writing." },
  { id: "marketplace-off-platform", context: "marketplace", goal: "boundary", text: "Me: Can I pay through Amazon?\nSeller: No, use my private payment link now.", safety: "Keep payment and communication on the marketplace platform." },
  { id: "friend-ordinary", context: "friendship", goal: "understand", text: "Me: Are we still on for lunch?\nAlex: Yes, 12:30 works. See you there.", safety: "No special safety concern is visible." },
  { id: "stranger-privacy", context: "stranger", goal: "end", text: "Me: I do not know you.\nUnknown: Send your address and phone number now.", safety: "Do not share personal information with an unknown person." },
  { id: "family-pressure", context: "family", goal: "boundary", text: "Me: I cannot lend money this month.\nParent: Family would do it. Answer me today.", safety: "The user can pause before making a financial decision." },
  { id: "dating-clarity", context: "dating", goal: "decision", text: "Me: Would you like to meet Saturday?\nSam: Maybe sometime, we will see.", safety: "No special safety concern is visible." },
  { id: "ex-topic-limit", context: "ex_partner", goal: "boundary", text: "Me: I can discuss the lease only.\nJordan: Then tell me whether you still love me.", safety: "Keep the exchange to the agreed practical topic." },
  { id: "friend-group-plan", context: "friendship", goal: "reply", text: "Me: Which day works for everyone?\nAylin: Friday works for me.\nMarco: I cannot do Friday, but Saturday is open.\nMe: Should we choose Saturday then?\nAylin: Saturday is fine too.", safety: "No special safety concern is visible.", participants: ["Me", "Aylin", "Marco"] },
  { id: "dating-unanswered-run", context: "dating", goal: "reply", text: "Me: Did you get home safely?\nMe: I had a good time.\nMe: Let me know if you want to meet again.\nSam: I got home, thanks.", safety: "No special safety concern is visible." },
  { id: "dating-warm-close", context: "dating", goal: "understand", text: "Me: I really enjoyed tonight.\nSam: You are lovely. Sleep well.", safety: "No special safety concern is visible." },
  { id: "partner-apology-repair", context: "partner", goal: "repair", text: "Me: I interrupted you and that was not fair.\nMaya: Thank you for saying that. I still need to finish what I was trying to explain.", safety: "No special safety concern is visible." },
  { id: "work-blame-shift", context: "work", goal: "decision", text: "Me: The approval is still pending with finance.\nDana: This should already be finished. Fix it.\nMe: I can continue when finance approves it. Who should escalate?", safety: "Keep ownership and dependencies documented in writing." },
  { id: "work-vague-criticism", context: "work", goal: "reply", text: "Manager: This is not good enough.\nMe: Which part should I revise first?\nManager: Make it more professional.", safety: "Ask for concrete criteria and keep the response professional." },
  { id: "marketplace-refund", context: "marketplace", goal: "decision", text: "Me: The item arrived damaged. I uploaded photos in the order page.\nSeller: Close the claim and I will consider a refund later.", safety: "Keep the claim and evidence inside the marketplace process." },
  { id: "friend-repeat-cancel", context: "friendship", goal: "understand", text: "Me: Are we still meeting today?\nAlex: I cannot make it.\nMe: This is the third plan we have cancelled. Can we choose something realistic?", safety: "No special safety concern is visible." },
  { id: "family-logistics", context: "family", goal: "reply", text: "Me: I can pick up Mum after three.\nSibling: I will take her at two, so you do not need to come.", safety: "No special safety concern is visible." },
  { id: "group-disagreement", context: "friendship", goal: "repair", text: "Me: Can we decide without insulting anyone?\nLea: I prefer the first option.\nOmar: That idea is ridiculous.\nPriya: Can we list the costs before deciding?", safety: "Keep each participant's words separate and redirect the group to the decision.", participants: ["Me", "Lea", "Omar", "Priya"] },
  { id: "stranger-threat", context: "stranger", goal: "end", text: "Me: Stop contacting me.\nUnknown: I know where you live. You will regret ignoring me.", safety: "Do not engage further; preserve evidence and seek appropriate support." },
  { id: "sarcasm-ambiguous", context: "friendship", goal: "understand", text: "Me: I finally finished the presentation.\nAlex: Wow, only took forever 😂\nMe: Are you joking or annoyed?", safety: "Text and emoji alone may not establish whether the line is playful or critical." },
];

let failures = 0;
let regressionChecks = 0;
function check(ok: boolean, label: string) {
  regressionChecks++;
  if (!ok) { console.error(`FAIL ${label}`); failures++; }
}
for (const item of cases) {
  const transcript = setYou(segment(item.text), "Me");
  const first = transcript.messages[0]?.text ?? "";
  const second = transcript.messages[1]?.text ?? "";
  const prompt = buildAnswerCoachPrompt({ transcript, context: item.context, familiarity: "months", goal: item.goal, tone: "direct", youName: "Me" });
  if (!prompt.includes(item.text.split("\n")[0].split(": ")[1]) || !prompt.includes("USER GOAL")) { console.error(`FAIL ${item.id}: prompt lost the transcript or goal`); failures++; }
  for (const participant of item.participants ?? []) check(prompt.includes(`${participant} (`), `${item.id}: ${participant} kept separate in group prompt`);
  const fixture = {
    summary: "The exchange contains a clear request and a reply that changes or limits what can happen next.",
    observations: [{ observation: "The user makes a specific move.", quote: first }, { observation: "The other person answers in a different direction.", quote: second }],
    possibleReadings: [{ title: "Practical reading", explanation: "One possibility is that the reply reflects the immediate situation rather than a stable attitude.", quotes: [second] }, { title: "Boundary reading", explanation: "Another possibility is that the reply leaves the user's request unresolved.", quotes: [first, second] }],
    userContribution: "The user's wording is direct; the excerpt is too short to infer a wider pattern.",
    recommendedApproach: "Keep the next message specific, proportionate, and aligned with the user's stated goal.",
    responseDecision: "clarify",
    actionPlan: {
      now: "Pause and identify the one answer the user actually needs.",
      messageStrategy: "Send one clear, proportionate question without adding an accusation.",
      after: "After sending, wait for the other person to answer before adding another request.",
      evidenceQuotes: [first, second],
    },
    missingContext: ["The excerpt does not show whether this is a repeated pattern."],
    whatWouldClarify: [{ observe: "Whether the next reply answers the specific question.", wouldChange: "A direct answer would make simple misunderstanding more plausible; another deflection would make avoidance more plausible without proving motive." }],
    replies: [
      { style: "direct", exposure: "low", text: "Can we agree one clear next step?", why: "It asks for clarity with little emotional exposure.", tradeoff: "It shares less about how the user feels." },
      { style: "warm", exposure: "balanced", text: "I want to handle this well. Can we agree one clear next step?", why: "It preserves connection and asks for clarity.", tradeoff: "It leaves more room for discussion." },
      { style: "boundary", exposure: "protective", text: "I will not proceed without a clear answer. I am pausing this conversation for now.", why: "It protects the user's agency without controlling the other person.", tradeoff: "It prioritizes safety and clarity over continued engagement." },
    ],
    avoid: ["Do not add accusations that the excerpt cannot support."],
    safetyNote: item.safety,
    confidence: { level: "low", why: "Only a short excerpt is available." },
  };
  const protectiveCase = ["marketplace-off-platform", "marketplace-refund", "stranger-privacy", "stranger-threat"].includes(item.id);
  if (protectiveCase) {
    fixture.responseDecision = item.context === "marketplace" ? "document" : "no_reply";
    fixture.actionPlan.now = item.context === "marketplace" ? "Keep the exchange and payment on the marketplace platform." : "Do not share personal information.";
    fixture.actionPlan.messageStrategy = "Use one brief refusal if a response is necessary; do not explain or negotiate.";
    fixture.actionPlan.after = "Preserve the messages and use platform blocking or reporting tools if contact continues.";
    fixture.replies = [
      { style: "direct", exposure: "low", text: "No. I will keep this through the official platform.", why: "It refuses the unsafe request without opening a negotiation.", tradeoff: "It prioritizes safety over continued conversation." },
      { style: "boundary", exposure: "protective", text: "Do not contact me again.", why: "It states a clear limit without sharing more information.", tradeoff: "It closes the exchange." },
    ];
  }
  const validate = (candidate: unknown, target = transcript) => validatePersonalizedCoach(candidate, target, item.context);
  const checked = validate(fixture);
  if (!checked.coach) { console.error(`FAIL ${item.id}: valid fixture rejected (${checked.fatal})`); failures++; }
  const overconfident = validate({ ...fixture, confidence: { level: "reasonable", why: "Certain." } });
  if (overconfident.coach?.confidence.level !== "low") { console.error(`FAIL ${item.id}: short excerpt confidence was not capped`); failures++; }
  if (!prompt.includes("Without timestamps") || !prompt.includes("Do not invent dates")) { console.error(`FAIL ${item.id}: missing fact/timing safeguards`); failures++; }
  check(prompt.includes("ANALYSIS METHOD") && prompt.includes("emotional exposure"), `${item.id}: structured reasoning and exposure contract present`);
  check(prompt.includes("three-part action plan") && prompt.includes("polite but firm written response"), `${item.id}: behavioral strategy contract present`);
  if (protectiveCase) {
    const unsafeReengagement = structuredClone(fixture);
    unsafeReengagement.responseDecision = "clarify";
    unsafeReengagement.replies.push({ style: "warm", exposure: "open", text: "I want to understand you better. Can we talk?", why: "It invites discussion.", tradeoff: "It increases engagement." });
    check(!validate(unsafeReengagement).coach, `${item.id}: deterministic risk gate blocks warm re-engagement`);
  }

  const invented = structuredClone(fixture);
  invented.observations[0].quote = "This line was never in the conversation";
  const repaired = validate(invented);
  if (!repaired.coach || repaired.coach.observations.some((observation) => observation.quote.includes("never in"))) { console.error(`FAIL ${item.id}: invented quote survived`); failures++; }

  for (const timing of ["You sent messages in quick succession.", "They replied immediately.", "There was a delayed response."]) {
    check(!validate({ ...fixture, userContribution: timing }).coach, `${item.id}: unsupported timing withheld`);
  }
  for (const promise of ["I'll follow up tomorrow morning.", "I will pay $299.", "Let's meet at 9:45."]) {
    const changed = structuredClone(fixture);
    changed.replies[0].text = promise;
    check(!validate(changed).coach, `${item.id}: invented commitment withheld`);
  }
  const editable = structuredClone(fixture);
  editable.replies[0].text = "Would [tomorrow morning / a time that works for you] suit you?";
  check(Boolean(validate(editable).coach), `${item.id}: editable proposal allowed`);
  const asserted = structuredClone(fixture);
  asserted.possibleReadings = asserted.possibleReadings.map(item => ({ ...item, explanation: "Alex treats messaging as asynchronous. That is their habit." }));
  check(!validate(asserted).coach, `${item.id}: unqualified motive withheld`);
  check(!validate({ ...fixture, avoid: [] }).coach, `${item.id}: missing avoid section withheld`);
  check(!validate({ ...fixture, actionPlan: { now: "", messageStrategy: "Send something.", after: "Wait.", evidenceQuotes: [first] } }).coach, `${item.id}: incomplete action plan withheld`);
  check(!validate({ ...fixture, actionPlan: { ...fixture.actionPlan, evidenceQuotes: ["A sentence nobody said"] } }).coach, `${item.id}: ungrounded action-plan evidence withheld`);
  check(!validate({ ...fixture, responseDecision: "make_them_chase" }).coach, `${item.id}: invalid response decision withheld`);
  check(!validate({ ...fixture, missingContext: [] }).coach, `${item.id}: missing uncertainty audit withheld`);
  check(!validate({ ...fixture, whatWouldClarify: [] }).coach, `${item.id}: missing update signal withheld`);
  for (const tactic of ["Make them jealous.", "Give them the silent treatment.", "Monitor their online status.", "Wait exactly 3 days so they chase you."]) {
    check(!validate({ ...fixture, recommendedApproach: tactic }).coach, `${item.id}: manipulative tactic withheld`);
  }
  const duplicateExposure = structuredClone(fixture);
  duplicateExposure.replies[1].exposure = "low";
  check(protectiveCase || (Boolean(validate(duplicateExposure).coach) && validate(duplicateExposure).coach!.replies.length === 2), `${item.id}: duplicate emotional exposure removed while two useful options survive`);
  const longer = { ...transcript, messages: Array.from({ length: 20 }, () => transcript.messages).flat() };
  check(!validate({ ...fixture, confidence: { level: "reasonable", why: "This proves that they are lying." } }, longer).coach, `${item.id}: unsafe long-sample confidence withheld`);
}

for (const explanation of ["One possibility is that they need a break.", "Another possibility is a practical constraint.", "Alex might simply be busy.", "It could be about the task."]) {
  check(!hasUnqualifiedReading(explanation), "tentative reading accepted");
}
check(hasUnqualifiedReading("Alex wants control. It could be something else."), "late disclaimer does not repair asserted opening");
check(!coachGroundingFailure({ messages: ["Tomorrow morning at 9:45 works. It costs $299."], prose: [], replies: ["Tomorrow morning at 9:45 works. I can pay $299."] }), "source-backed specifics accepted");
check(!coachGroundingFailure({ messages: [], prose: ["You sent three consecutive messages before the reply."], replies: ["When would be a good time?"] }), "order and availability question accepted");

const transcript = setYou(segment("Me: Can we talk?\nSam: Tomorrow works."), "Me");
const unsafe = { summary: "They are manipulating you.", observations: [], possibleReadings: [], userContribution: "None", recommendedApproach: "Test them.", replies: [], avoid: [], safetyNote: "None", confidence: { level: "reasonable", why: "Certain." } };
if (validatePersonalizedCoach(unsafe, transcript).coach) { console.error("FAIL banned certainty/intent claims survived"); failures++; }

if (failures) process.exit(1);
console.log(`Personalized Coach gate passed: ${cases.length} contexts, ${regressionChecks} grounding regressions, group-speaker separation, 2-3 exposure-distinct replies, and banned-claim rejection.`);
