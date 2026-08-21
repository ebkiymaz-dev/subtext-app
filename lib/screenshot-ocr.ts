export type OcrProgress = { status: string; progress: number };

export type ScreenshotRead = {
  transcript: string;
  messageCount: number;
  participantCount: number;
};

export const OCR_LANGUAGE_OPTIONS = [
  { value: "auto", label: "Automatic — English, 中文, 日本語, Русский", trainedData: "eng+chi_sim+chi_tra+jpn+rus" },
  { value: "eng", label: "English / Latin alphabet", trainedData: "eng" },
  { value: "chi", label: "中文 — Chinese", trainedData: "chi_sim+chi_tra+eng" },
  { value: "jpn", label: "日本語 — Japanese", trainedData: "jpn+eng" },
  { value: "rus", label: "Русский — Russian", trainedData: "rus+eng" },
  { value: "kor", label: "한국어 — Korean", trainedData: "kor+eng" },
  { value: "ara", label: "العربية — Arabic", trainedData: "ara+eng" },
  { value: "hin", label: "हिन्दी — Hindi", trainedData: "hin+eng" },
  { value: "ben", label: "বাংলা — Bengali", trainedData: "ben+eng" },
  { value: "tha", label: "ไทย — Thai", trainedData: "tha+eng" },
  { value: "heb", label: "עברית — Hebrew", trainedData: "heb+eng" },
  { value: "fas", label: "فارسی — Persian", trainedData: "fas+eng" },
  { value: "ukr", label: "Українська — Ukrainian", trainedData: "ukr+eng" },
  { value: "vie", label: "Tiếng Việt — Vietnamese", trainedData: "vie+eng" },
  { value: "spa", label: "Español — Spanish", trainedData: "spa+eng" },
  { value: "fra", label: "Français — French", trainedData: "fra+eng" },
  { value: "deu", label: "Deutsch — German", trainedData: "deu+eng" },
  { value: "por", label: "Português — Portuguese", trainedData: "por+eng" },
  { value: "ita", label: "Italiano — Italian", trainedData: "ita+eng" },
  { value: "tur", label: "Türkçe — Turkish", trainedData: "tur+eng" },
  { value: "ind", label: "Bahasa Indonesia", trainedData: "ind+eng" },
] as const;

export type OcrLanguage = (typeof OCR_LANGUAGE_OPTIONS)[number]["value"];

export function trainedDataFor(language: OcrLanguage): string {
  return OCR_LANGUAGE_OPTIONS.find((option) => option.value === language)?.trainedData ?? "eng";
}

type Box = { x0: number; y0: number; x1: number; y1: number };
type Rgb = { r: number; g: number; b: number };
type OcrParagraph = {
  rawLines: string[];
  text: string;
  confidence: number;
  bbox: Box;
  side: "left" | "right" | "center";
  bubbleKey: string;
  sitsOnBubble: boolean;
};

const SYSTEM_LINE = /^(?:read|delivered|sent|today|yesterday|typing…?|message deleted|this message was deleted|\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}[/.]\d{1,2}[/.]\d{2,4})$/i;
const TIME_PREFIX = /^\s*\d{1,2}:\d{2}(?:\s*[ap]m)?\b/i;
const ODD_SYMBOL = /[©®™~=<>\[\]{}|\\]/;

function colourDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function quantizedColour({ r, g, b }: Rgb): string {
  const q = (value: number) => Math.round(value / 32) * 32;
  return `${q(r)}-${q(g)}-${q(b)}`;
}

function dominantColour(context: CanvasRenderingContext2D, width: number, height: number, box: Box): Rgb {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(width, Math.ceil(box.x1));
  const y1 = Math.min(height, Math.ceil(box.y1));
  const pixels = context.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 8) {
    if (pixels[i + 3] < 220) continue;
    const rgb = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
    const key = quantizedColour(rgb);
    const current = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    current.count += 1;
    current.r += rgb.r;
    current.g += rgb.g;
    current.b += rgb.b;
    buckets.set(key, current);
  }
  const winner = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  return winner
    ? { r: Math.round(winner.r / winner.count), g: Math.round(winner.g / winner.count), b: Math.round(winner.b / winner.count) }
    : { r: 255, g: 255, b: 255 };
}

export function looksLikeSenderName(text: string): boolean {
  const cleaned = text.trim();
  const glyphs = Array.from(cleaned);
  const singleHanName = glyphs.length === 1 && /^\p{Script=Han}$/u.test(cleaned);
  if ((!singleHanName && glyphs.length < 2) || glyphs.length > 42 || SYSTEM_LINE.test(cleaned)) return false;
  if (/[.!?;:]$/.test(cleaned) || TIME_PREFIX.test(cleaned)) return false;
  const words = cleaned.split(/\s+/);
  if (words.length > 5) return false;
  const letters = (cleaned.match(/\p{L}/gu) ?? []).length;
  const digits = (cleaned.match(/\d/g) ?? []).length;
  return (letters >= 2 || singleHanName) && digits <= 2 && letters / Math.max(1, glyphs.length) >= 0.55;
}

export function looksLikeMessage(text: string, confidence: number, sitsOnBubble: boolean): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!sitsOnBubble || confidence < 42 || cleaned.length < 2 || SYSTEM_LINE.test(cleaned)) return false;
  const letters = (cleaned.match(/\p{L}/gu) ?? []).length;
  const digits = (cleaned.match(/\d/g) ?? []).length;
  const symbols = (cleaned.match(/[^\p{L}\p{N}\s.,!?'’“”:;()@#%&+\-/]/gu) ?? []).length;
  if (letters < 2 || (digits > letters * 1.4 && letters < 8)) return false;
  if (/\b[A-Z]{1,5}\d{3,}\b/.test(cleaned) && cleaned.split(/\s+/).length <= 4) return false;
  if (symbols > Math.max(1, letters * 0.2) || ODD_SYMBOL.test(cleaned)) return false;
  if (TIME_PREFIX.test(cleaned) && cleaned.replace(TIME_PREFIX, "").trim().split(/\s+/).length < 3) return false;
  if (cleaned.length <= 5 && (confidence < 66 || digits > 0 || symbols > 0)) return false;
  return true;
}

function embeddedSender(lines: string[]): { sender?: string; text: string } {
  if (lines.length >= 2 && looksLikeSenderName(lines[0])) {
    return { sender: lines[0], text: lines.slice(1).join(" ").trim() };
  }
  return { text: lines.join(" ").trim() };
}

/** Local OCR with bubble, name-label, colour, and alignment cues. */
export async function readChatScreenshot(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
  language: OcrLanguage = "auto"
): Promise<ScreenshotRead> {
  const [{ createWorker, OEM, PSM }, bitmap] = await Promise.all([
    import("tesseract.js"),
    createImageBitmap(file),
  ]);
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Screenshot canvas is unavailable on this device.");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const worker = await createWorker(trainedDataFor(language), OEM.LSTM_ONLY, {
    logger(message) { onProgress?.({ status: message.status, progress: message.progress }); },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
    const result = await worker.recognize(file, {}, { blocks: true, text: true });
    const paragraphs: OcrParagraph[] = (result.data.blocks ?? [])
      .flatMap((block) => block.paragraphs)
      .map((paragraph) => {
        const rawLines = paragraph.text.split(/\r\n|\r|\n/)
          .map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
        const text = rawLines.join(" ").trim();
        const bbox = paragraph.bbox;
        const left = bbox.x0;
        const right = width - bbox.x1;
        const side: OcrParagraph["side"] = Math.abs(left - right) < width * 0.055
          ? "center" : left < right ? "left" : "right";
        const padX = Math.max(7, width * 0.009);
        const padY = Math.max(5, height * 0.004);
        const bubbleColour = dominantColour(context, width, height, {
          x0: bbox.x0 - padX, y0: bbox.y0 - padY, x1: bbox.x1 + padX, y1: bbox.y1 + padY,
        });
        const yMid = Math.max(0, Math.min(height - 1, (bbox.y0 + bbox.y1) / 2));
        const outsideX = side === "left" ? width * 0.94 : width * 0.06;
        const outside = dominantColour(context, width, height, {
          x0: outsideX - 5, x1: outsideX + 5, y0: yMid - 7, y1: yMid + 7,
        });
        return {
          rawLines, text, confidence: paragraph.confidence, bbox, side,
          bubbleKey: quantizedColour(bubbleColour),
          sitsOnBubble: side !== "center" && colourDistance(bubbleColour, outside) >= 11,
        };
      })
      .filter((paragraph) => paragraph.text.length > 1 && paragraph.confidence >= 28)
      .filter((paragraph) => paragraph.bbox.x1 - paragraph.bbox.x0 < width * 0.86)
      .sort((a, b) => a.bbox.y0 - b.bbox.y0);

    const colourSpeakers = new Map<string, string>();
    const participantNames = new Set<string>();
    const messages: string[] = [];
    for (let index = 0; index < paragraphs.length; index += 1) {
      const paragraph = paragraphs[index];
      if (paragraph.side === "center") continue;
      const embedded = embeddedSender(paragraph.rawLines);
      if (!looksLikeMessage(embedded.text, paragraph.confidence, paragraph.sitsOnBubble)) continue;
      let sender = embedded.sender;
      if (!sender && index > 0) {
        const previous = paragraphs[index - 1];
        const gap = paragraph.bbox.y0 - previous.bbox.y1;
        const aligned = Math.abs(paragraph.bbox.x0 - previous.bbox.x0) < width * 0.08;
        if (!previous.sitsOnBubble && aligned && gap >= 0 && gap < height * 0.035 && looksLikeSenderName(previous.text)) {
          sender = previous.text;
        }
      }
      if (!sender) {
        if (paragraph.side === "right") sender = "You";
        else {
          const key = `${paragraph.side}-${paragraph.bubbleKey}`;
          if (!colourSpeakers.has(key)) colourSpeakers.set(key, `Person ${colourSpeakers.size + 1}`);
          sender = colourSpeakers.get(key)!;
        }
      }
      participantNames.add(sender);
      messages.push(`${sender}: ${embedded.text}`);
    }
    if (!messages.length) throw new Error("No chat bubbles were found after removing headers, timestamps, and OCR debris.");
    return { transcript: messages.join("\n"), messageCount: messages.length, participantCount: participantNames.size };
  } finally {
    await worker.terminate();
  }
}
