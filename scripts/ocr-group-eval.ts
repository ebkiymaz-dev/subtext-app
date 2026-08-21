import { activeParticipants, focusedTranscript, participantStats } from "../lib/group-chat";
import { looksLikeMessage, looksLikeSenderName } from "../lib/screenshot-ocr";
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
assert(!looksLikeSenderName("14:45"), "timestamp was accepted as a sender");

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
