import { createRequire } from "node:module";
import { francAll } from "franc";

const require = createRequire(import.meta.url);
const { segment } = require("../.eval-out/lib/engine/segment.js");
const { OCR_LANGUAGE_OPTIONS, looksLikeSenderName, trainedDataFor } = require("../.eval-out/lib/screenshot-ocr.js");
const { classifyLanguageRanking } = require("../.eval-out/lib/language-support.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const models = OCR_LANGUAGE_OPTIONS.filter((option) => option.value !== "auto");
assert(models.length >= 100, `expected at least 100 selectable OCR languages, received ${models.length}`);

const scriptSamples = [
  "Conversation text stays attached to its speaker.",
  "¿Nos vemos mañana? Sí, te aviso cuando llegue.",
  "Je vais répondre après la réunion.",
  "Ich melde mich später noch einmal.",
  "Bugün biraz geç geleceğim, haber veririm.",
  "Я напишу, когда буду рядом.",
  "Я напишу, коли буду поруч.",
  "سأكتب لك عندما أصل إلى هناك.",
  "אני אכתוב כשאגיע לשם.",
  "मैं पहुँचने पर तुम्हें लिखूँगा।",
  "আমি পৌঁছালে তোমাকে লিখব।",
  "நான் வந்ததும் உனக்கு எழுதுகிறேன்.",
  "నేను చేరుకున్నప్పుడు నీకు వ్రాస్తాను.",
  "ನಾನು ತಲುಪಿದಾಗ ನಿಮಗೆ ಬರೆಯುತ್ತೇನೆ.",
  "ഞാൻ എത്തിയാൽ എഴുതാം.",
  "હું પહોંચું ત્યારે લખીશ.",
  "ਮੈਂ ਪਹੁੰਚ ਕੇ ਲਿਖਾਂਗਾ।",
  "ถึงแล้วฉันจะส่งข้อความนะ",
  "着いたらメッセージを送ります。",
  "도착하면 메시지를 보낼게요.",
  "我到了以后会给你发消息。",
  "როგორც კი მივალ, მოგწერ.",
  "Երբ հասնեմ, քեզ կգրեմ։",
  "Όταν φτάσω, θα σου γράψω.",
  "ရောက်ရင် စာပို့မယ်။",
];

for (const [index, model] of models.slice(0, 100).entries()) {
  const senderA = `${model.label.split(/\s+[—/]/u)[0].slice(0, 24)} A`;
  const senderB = `${model.label.split(/\s+[—/]/u)[0].slice(0, 24)} B`;
  const first = scriptSamples[index % scriptSamples.length];
  const second = scriptSamples[(index + 7) % scriptSamples.length];
  const transcript = segment(`${senderA}: ${first}\n${senderB}: ${second}`);
  assert(transcript.format === "named", `${model.value}: named format was lost`);
  assert(transcript.messages.length === 2, `${model.value}: expected 2 messages, received ${transcript.messages.length}`);
  assert(transcript.names.length === 2, `${model.value}: expected 2 speakers, received ${transcript.names.length}`);
  assert(transcript.messages[0].text === first && transcript.messages[1].text === second, `${model.value}: Unicode text changed during extraction`);
  assert(looksLikeSenderName(senderA), `${model.value}: sender label was rejected`);
  assert(trainedDataFor(model.value).includes(model.value), `${model.value}: OCR model mapping is missing`);
}

const languageSamples = {
  eng: "Are we still meeting tonight? Yes, I can be there at seven. Please let me know when you arrive. I will send you the address now.",
  spa: "¿Todavía nos reunimos esta noche? Sí, puedo estar allí a las siete. Avísame cuando llegues. Te enviaré la dirección ahora.",
  fra: "Est-ce que nous nous retrouvons toujours ce soir ? Oui, je peux être là à sept heures. Dis-moi quand tu arrives. Je vais envoyer l’adresse.",
  tur: "Bu akşam hâlâ buluşuyor muyuz? Evet, saat yedide orada olabilirim. Geldiğinde bana haber ver. Adresi şimdi göndereceğim.",
};
for (const [expected, text] of Object.entries(languageSamples)) {
  const ranked = francAll(text, { minLength: 30 }).slice(0, 12);
  const assessment = classifyLanguageRanking(text, ranked);
  assert(expected === "eng" ? assessment.status === "english" : assessment.status === "non_english", `${expected}: unsafe analysis-language decision ${JSON.stringify(assessment)}`);
}
assert(classifyLanguageRanking("Okay, thanks.", francAll("Okay, thanks.", { minLength: 3 })).status === "uncertain", "short chat was guessed instead of requiring confirmation");
assert(classifyLanguageRanking("李: 我到了以后会给你发消息。\n王: 好的，我会等你。", []).status === "non_english", "non-Latin script was not withheld");

console.log(`multilingual-extraction-eval: ${Math.min(100, models.length)} OCR/model extraction cases + English/Spanish/French/Turkish safety gates passed`);
