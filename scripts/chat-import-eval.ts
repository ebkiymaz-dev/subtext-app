import assert from "node:assert/strict";
import { prepareImportedChatText } from "../lib/chat-import";

const clean = prepareImportedChatText("\uFEFF[10:00] Ana: Hi\r\n[10:01] Me: Hello\u0000");
assert.equal(clean.text, "[10:00] Ana: Hi\n[10:01] Me: Hello");
assert.equal(clean.truncated, false);

const long = prepareImportedChatText("old partial line\nAna: Keep this\nMe: And this", 29);
assert.equal(long.truncated, true);
assert.equal(long.text, "Ana: Keep this\nMe: And this");

console.log("chat-import-eval: local TXT normalization and newest-line truncation passed");
