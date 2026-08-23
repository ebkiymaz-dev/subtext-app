import { activeParticipants, focusedTranscript, participantStats } from "../lib/group-chat";
import { chooseScreenshotSender, looksLikeMessage, looksLikeSenderName, trainedDataFor } from "../lib/screenshot-ocr";
import { segment } from "../lib/engine/segment";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

for (const debris of ["N= ED", "14:45 © “Zr 1 °", "TB8231 x Efe", "[3", "Ck ~", "[A Vianna Tailor BROS"]) {
  assert(!looksLikeMessage(debris, 82, true), `OCR debris was accepted as a message: ${debris}`);
}
assert(looksLikeMessage("Okay I will be around. 15.05", 82, true), "ordinary message was rejected");
assert(looksLikeMessage("OK", 82, true), "confident short reply was rejected");
assert(!looksLikeMessage("OK", 82, false), "text outside a bubble was accepted");
assert(looksLikeSenderName("Efe"), "simple sender name was rejected");
for (const name of ["张伟", "李", "佐藤", "Алексей", "Мария", "김민준", "فاطمة", "สมชาย", "שרה"]) {
  assert(looksLikeSenderName(name), `Unicode sender name was rejected: ${name}`);
}
assert(!looksLikeSenderName("14:45"), "timestamp was accepted as a sender");
assert(trainedDataFor("auto").includes("chi_sim"), "automatic OCR is missing Chinese");
assert(trainedDataFor("auto").includes("jpn"), "automatic OCR is missing Japanese");
assert(trainedDataFor("auto").includes("rus"), "automatic OCR is missing Russian");

const lastNamed = new Map<"left" | "right", string>();
const colourSpeakers = new Map<string, string>();
assert(chooseScreenshotSender("right", undefined, "blue", lastNamed, colourSpeakers) === "You", "right-side screenshot bubble was not assigned to the user");
assert(chooseScreenshotSender("left", "Мария", "grey", lastNamed, colourSpeakers) === "Мария", "explicit Unicode group sender was lost");
assert(chooseScreenshotSender("left", undefined, "grey", lastNamed, colourSpeakers) === "Мария", "consecutive group bubble did not continue the last named sender");
lastNamed.clear();
assert(chooseScreenshotSender("left", undefined, "grey", lastNamed, colourSpeakers).startsWith("Unclear speaker"), "uncertain group sender was presented as a known person");

const group = segment([
  "Me: Are we still meeting?",
  "Efe: Yes, at seven.",
  "Ava: I can join later.",
  "Noah: Please send the address.",
  "Me: Sending it now.",
  "Ava: Thanks!",
].join("\n"));
const participants = activeParticipants(group, {}, {});
assert(participants.length === 4, `expected 4 participants, received ${participants.length}`);
const focused = focusedTranscript(group, {}, {}, "Me", "Ava");
assert(focused.includes("Me: Are we still meeting?"), "user line missing from focused transcript");
assert(focused.includes("Ava: I can join later."), "focus participant missing from focused transcript");
assert(!focused.includes("Efe:") && !focused.includes("Noah:"), "other group participants were merged into focused read");
const excluded = { m2: true };
assert(!activeParticipants(group, {}, excluded).includes("Ava") === false, "participant removal accounting failed");
const stats = participantStats(group, {}, {});
assert(stats.reduce((sum, item) => sum + item.messages, 0) === 6, "group message totals drifted");
assert(stats.reduce((sum, item) => sum + item.share, 0) >= 99, "group shares do not cover the conversation");

console.log("ocr-group-eval: debris rejection and unlimited participant focus passed");
