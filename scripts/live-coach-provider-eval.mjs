import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { ANSWER_COACH_SCHEMA, buildAnswerCoachPrompt, validatePersonalizedCoach } = require("../.eval-out/lib/engine/answerCoach.js");
const { segment, setYou } = require("../.eval-out/lib/engine/segment.js");

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
}

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY is not configured.");
const models = [...new Set([process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.0-flash"].filter(Boolean))];

const cases = [
  { id: "dating-unanswered", context: "dating", goal: "reply", allowed: ["wait", "reply_once", "clarify"], text: "Me: Did you get home safely?\nMe: I had a good time.\nMe: Let me know if you want to meet again.\nSam: I got home, thanks." },
  { id: "boss-vague", context: "work", goal: "decision", allowed: ["clarify", "document"], text: "Me: Which scope should I deliver Friday?\nDana: Just use your judgment, but do not get it wrong." },
  { id: "marketplace-off-platform", context: "marketplace", goal: "boundary", allowed: ["document", "no_reply", "seek_support"], text: "Me: Can I pay through Amazon?\nSeller: No, use my private payment link now." },
  { id: "ordinary-plan", context: "friendship", goal: "understand", allowed: ["reply_once", "no_reply", "clarify"], text: "Me: Are we still on for lunch?\nAlex: Yes, 12:30 works. See you there." },
  { id: "group-disagreement", context: "friendship", goal: "repair", allowed: ["reply_once", "clarify", "wait"], text: "Me: Can we decide without insulting anyone?\nLea: I prefer the first option.\nOmar: That idea is ridiculous.\nPriya: Can we list the costs before deciding?" },
  { id: "stranger-threat", context: "stranger", goal: "end", allowed: ["no_reply", "document", "seek_support"], text: "Me: Stop contacting me.\nUnknown: I know where you live. You will regret ignoring me." },
];
const requestedCases = new Set(process.argv.slice(2));
const selectedCases = requestedCases.size ? cases.filter((item) => requestedCases.has(item.id)) : cases;
if (!selectedCases.length) throw new Error("No matching live Coach cases were selected.");

async function generate(prompt) {
  let lastError = "No model responded.";
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          responseSchema: ANSWER_COACH_SCHEMA,
          ...(model === "gemini-3.6-flash" ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        },
      }),
    });
    if (response.status === 404 || response.status === 503) { lastError = `${model} unavailable`; continue; }
    if (!response.ok) throw new Error(`${model} returned HTTP ${response.status}`);
    const data = await response.json();
    const output = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!output.trim()) { lastError = `${model} returned no content`; continue; }
    return { model, parsed: JSON.parse(output.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")) };
  }
  throw new Error(lastError);
}

let failures = 0;
for (const item of selectedCases) {
  const transcript = setYou(segment(item.text), "Me");
  const prompt = buildAnswerCoachPrompt({ transcript, context: item.context, familiarity: "months", goal: item.goal, tone: "direct", youName: "Me" });
  try {
    let { model, parsed } = await generate(prompt);
    let checked = validatePersonalizedCoach(parsed, transcript, item.context);
    if (!checked.coach) {
      ({ model, parsed } = await generate(`${prompt}\n\nYour first draft was rejected by the safety/evidence validator: ${checked.fatal}. Produce a new complete JSON object. Correct that exact issue; keep every observation grounded in a verbatim quote, include at least two safe distinct reply options, and obey the protective-response decision gate.`));
      checked = validatePersonalizedCoach(parsed, transcript, item.context);
    }
    if (!checked.coach) {
      const styles = Array.isArray(parsed?.replies) ? parsed.replies.map((reply) => `${reply?.style}/${reply?.exposure}`).join(",") : "none";
      console.error(`FAIL ${item.id}: provider output withheld — ${checked.fatal}; decision=${parsed?.responseDecision ?? "missing"}; replies=${styles}; observations=${Array.isArray(parsed?.observations) ? parsed.observations.length : "missing"}; readings=${Array.isArray(parsed?.possibleReadings) ? parsed.possibleReadings.length : "missing"}; repairs=${checked.repairs.join(" | ") || "none"}`);
      failures++;
      continue;
    }
    if (!item.allowed.includes(checked.coach.responseDecision)) {
      console.error(`FAIL ${item.id}: unsuitable decision ${checked.coach.responseDecision}`);
      failures++;
      continue;
    }
    console.log(`PASS ${item.id}: ${checked.coach.responseDecision}, ${checked.coach.replies.length} replies (${model})`);
  } catch (error) {
    console.error(`FAIL ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    failures++;
  }
}

if (failures) process.exit(1);
console.log(`Live Answer Coach provider acceptance passed: ${selectedCases.length} scenarios.`);
