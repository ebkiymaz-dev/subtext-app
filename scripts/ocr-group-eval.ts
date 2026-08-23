import { activeParticipants, focusedTranscript, participantStats } from "../lib/group-chat";
import { chooseScreenshotSender, detectColouredBubbleBoxes, groupScreenshotParagraphs, looksLikeMessage, looksLikeSenderName, normaliseOcrLine, trainedDataFor } from "../lib/screenshot-ocr";
import { segment } from "../lib/engine/segment";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

for (const debris of ["N= ED", "14:45 © “Zr 1 °", "TB8231 x Efe", "[3", "Ck ~", "[A Vianna Tailor BROS"]) {
  assert(!looksLikeMessage(debris, 82, true), `OCR debris was accepted as a message: ${debris}`);
}
assert(looksLikeMessage("Okay I will be around. 15.05", 82, true), "ordinary message was rejected");
assert(looksLikeMessage("OK", 82, true), "confident short reply was rejected");
assert(normaliseOcrLine("| can bring the tickets.") === "I can bring the tickets.", "capital-I OCR artifact was not corrected");
assert(!looksLikeMessage("OK", 82, false), "text outside a bubble was accepted");
assert(looksLikeSenderName("Efe"), "simple sender name was rejected");
for (const name of ["张伟", "李", "佐藤", "Алексей", "Мария", "김민준", "فاطمة", "สมชาย", "שרה"]) {
  assert(looksLikeSenderName(name), `Unicode sender name was rejected: ${name}`);
}
assert(!looksLikeSenderName("14:45"), "timestamp was accepted as a sender");
assert(trainedDataFor("auto").includes("chi_sim"), "automatic OCR is missing Chinese");
assert(trainedDataFor("auto").includes("jpn"), "automatic OCR is missing Japanese");
assert(trainedDataFor("auto").includes("rus"), "automatic OCR is missing Russian");

const colouredPixels = new Uint8ClampedArray(100 * 100 * 4);
for (let pixel = 0; pixel < colouredPixels.length; pixel += 4) {
  colouredPixels[pixel] = 248;
  colouredPixels[pixel + 1] = 248;
  colouredPixels[pixel + 2] = 248;
  colouredPixels[pixel + 3] = 255;
}
for (let y = 20; y < 40; y += 1) {
  for (let x = 55; x < 95; x += 1) {
    const pixel = (y * 100 + x) * 4;
    colouredPixels[pixel] = 72;
    colouredPixels[pixel + 1] = 136;
    colouredPixels[pixel + 2] = 235;
  }
}
const colouredBoxes = detectColouredBubbleBoxes(colouredPixels, 100, 100);
assert(colouredBoxes.length === 1, "expected one coloured bubble, received " + colouredBoxes.length);
assert(colouredBoxes[0].x0 <= 56 && colouredBoxes[0].x1 >= 94, "coloured bubble bounds were clipped");

const lastNamed = new Map<"left" | "right", string>();
const colourSpeakers = new Map<string, string>();
assert(chooseScreenshotSender("right", undefined, "blue", lastNamed, colourSpeakers) === "You", "right-side screenshot bubble was not assigned to the user");
assert(chooseScreenshotSender("left", "Мария", "grey", lastNamed, colourSpeakers) === "Мария", "explicit Unicode group sender was lost");
assert(chooseScreenshotSender("left", undefined, "grey", lastNamed, colourSpeakers) === "Мария", "consecutive group bubble did not continue the last named sender");
lastNamed.clear();
assert(chooseScreenshotSender("left", undefined, "grey", lastNamed, colourSpeakers).startsWith("Unclear speaker"), "uncertain group sender was presented as a known person");

const fragments = groupScreenshotParagraphs([
  { rawLines: ["Maria"], text: "Maria", confidence: 94, bbox: { x0: 50, y0: 150, x1: 180, y1: 180 }, side: "left", bubbleKey: "224-224-224", sitsOnBubble: true },
  { rawLines: ["Should we meet at seven?"], text: "Should we meet at seven?", confidence: 92, bbox: { x0: 50, y0: 188, x1: 520, y1: 225 }, side: "left", bubbleKey: "224-224-224", sitsOnBubble: true },
  { rawLines: ["Kenji"], text: "Kenji", confidence: 95, bbox: { x0: 50, y0: 300, x1: 160, y1: 330 }, side: "left", bubbleKey: "224-224-224", sitsOnBubble: true },
  { rawLines: ["I can bring the tickets."], text: "I can bring the tickets.", confidence: 93, bbox: { x0: 50, y0: 338, x1: 500, y1: 375 }, side: "left", bubbleKey: "224-224-224", sitsOnBubble: true },
], 1080, 1500);
assert(fragments.length === 2, `name/message fragments produced ${fragments.length} bubbles instead of 2`);
assert(fragments[0].rawLines.join("|") === "Maria|Should we meet at seven?", "Maria label was not joined to its message");
assert(fragments[1].rawLines.join("|") === "Kenji|I can bring the tickets.", "Kenji label was not joined to its message");

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
