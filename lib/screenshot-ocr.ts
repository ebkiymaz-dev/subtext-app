export type OcrProgress = { status: string; progress: number };

export type ScreenshotRead = {
  transcript: string;
  messageCount: number;
  participantCount: number;
  participants: string[];
};

// Official Tesseract language-model codes. Models are downloaded only after a
// user chooses one; loading 100+ models into the app or automatic mode would be
// punishing on mobile data and memory.
const OCR_LANGUAGE_MODELS = [
  ["afr", "Afrikaans"], ["amh", "Amharic"], ["ara", "Arabic"], ["asm", "Assamese"],
  ["aze", "Azerbaijani"], ["aze_cyrl", "Azerbaijani — Cyrillic"], ["bel", "Belarusian"],
  ["ben", "Bengali"], ["bod", "Tibetan"], ["bos", "Bosnian"], ["bre", "Breton"],
  ["bul", "Bulgarian"], ["cat", "Catalan / Valencian"], ["ceb", "Cebuano"],
  ["ces", "Czech"], ["chi_sim", "Chinese — Simplified"], ["chi_tra", "Chinese — Traditional"],
  ["chr", "Cherokee"], ["cym", "Welsh"], ["dan", "Danish"], ["deu", "German"],
  ["dzo", "Dzongkha"], ["ell", "Greek"], ["eng", "English"], ["epo", "Esperanto"],
  ["est", "Estonian"], ["eus", "Basque"], ["fas", "Persian"], ["fin", "Finnish"],
  ["fra", "French"], ["gle", "Irish"], ["glg", "Galician"], ["guj", "Gujarati"],
  ["hat", "Haitian Creole"], ["heb", "Hebrew"], ["hin", "Hindi"], ["hrv", "Croatian"],
  ["hun", "Hungarian"], ["iku", "Inuktitut"], ["ind", "Indonesian"], ["isl", "Icelandic"],
  ["ita", "Italian"], ["jav", "Javanese"], ["jpn", "Japanese"], ["kan", "Kannada"],
  ["kat", "Georgian"], ["kaz", "Kazakh"], ["khm", "Khmer"], ["kir", "Kyrgyz"],
  ["kmr", "Kurdish — Kurmanji"], ["kor", "Korean"], ["kur", "Kurdish"], ["lao", "Lao"],
  ["lat", "Latin"], ["lav", "Latvian"], ["lit", "Lithuanian"], ["ltz", "Luxembourgish"],
  ["mal", "Malayalam"], ["mar", "Marathi"], ["mkd", "Macedonian"], ["mlt", "Maltese"],
  ["mon", "Mongolian"], ["mri", "Māori"], ["msa", "Malay"], ["mya", "Burmese"],
  ["nep", "Nepali"], ["nld", "Dutch / Flemish"], ["nor", "Norwegian"], ["oci", "Occitan"],
  ["ori", "Odia"], ["pan", "Punjabi"], ["pol", "Polish"], ["por", "Portuguese"],
  ["pus", "Pashto"], ["que", "Quechua"], ["ron", "Romanian / Moldovan"], ["rus", "Russian"],
  ["san", "Sanskrit"], ["sin", "Sinhala"], ["slk", "Slovak"], ["slv", "Slovenian"],
  ["snd", "Sindhi"], ["spa", "Spanish"], ["sqi", "Albanian"], ["srp", "Serbian — Cyrillic"],
  ["srp_latn", "Serbian — Latin"], ["sun", "Sundanese"], ["swa", "Swahili"],
  ["swe", "Swedish"], ["syr", "Syriac"], ["tam", "Tamil"], ["tat", "Tatar"],
  ["tel", "Telugu"], ["tgk", "Tajik"], ["tgl", "Tagalog"], ["tha", "Thai"],
  ["tir", "Tigrinya"], ["ton", "Tongan"], ["tur", "Turkish"], ["uig", "Uyghur"],
  ["ukr", "Ukrainian"], ["urd", "Urdu"], ["uzb", "Uzbek — Latin"],
  ["uzb_cyrl", "Uzbek — Cyrillic"], ["vie", "Vietnamese"], ["yid", "Yiddish"],
  ["yor", "Yoruba"],
] as const;

export const OCR_LANGUAGE_OPTIONS = [
  { value: "auto", label: "Automatic — English, 中文, 日本語, Русский", trainedData: "eng+chi_sim+chi_tra+jpn+rus" },
  ...OCR_LANGUAGE_MODELS.map(([value, label]) => ({
    value,
    label,
    trainedData: value === "eng" ? "eng" : `${value}+eng`,
  })),
] as const;

export type OcrLanguage = (typeof OCR_LANGUAGE_OPTIONS)[number]["value"];

export function trainedDataFor(language: OcrLanguage): string {
  return OCR_LANGUAGE_OPTIONS.find((option) => option.value === language)?.trainedData ?? "eng";
}

type Box = { x0: number; y0: number; x1: number; y1: number };
type Rgb = { r: number; g: number; b: number };
type OcrSide = "left" | "right";
type OcrParagraph = {
  rawLines: string[];
  text: string;
  confidence: number;
  bbox: Box;
  side: "left" | "right" | "center";
  bubbleKey: string;
  sitsOnBubble: boolean;
};

export const MAX_SCREENSHOT_BYTES = 30 * 1024 * 1024;
const MAX_OCR_PIXELS = 6_000_000;
const MAX_OCR_EDGE = 3200;

export function screenshotCanvasSize(sourceWidth: number, sourceHeight: number): { width: number; height: number } {
  const edgeScale = Math.min(1, MAX_OCR_EDGE / Math.max(sourceWidth, sourceHeight));
  const pixelScale = Math.min(1, Math.sqrt(MAX_OCR_PIXELS / Math.max(1, sourceWidth * sourceHeight)));
  const scale = Math.min(edgeScale, pixelScale);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

const SYSTEM_LINE = /^(?:read|delivered|sent|today|yesterday|typing…?|message deleted|this message was deleted|\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}[/.]\d{1,2}[/.]\d{2,4})$/i;
const TIME_PREFIX = /^\s*\d{1,2}:\d{2}(?:\s*[ap]m)?\b/i;
const ODD_SYMBOL = /[©®™~=<>\[\]{}|\\]/;

export function normaliseOcrLine(text: string): string {
  // Tesseract commonly reads a capital I as a pipe at the beginning of a
  // sentence. A standalone pipe is not natural chat punctuation, so this is a
  // safe correction before the debris filter evaluates the message.
  return text.replace(/(^|\s)\|(?=\s|$)/g, "$1I").replace(/\s+/g, " ").trim();
}

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
  if (confidence >= 66 && /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|\s)+$/u.test(cleaned)) return true;
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

function verticalGap(a: OcrParagraph, b: OcrParagraph): number {
  return b.bbox.y0 - a.bbox.y1;
}

function horizontallyRelated(a: OcrParagraph, b: OcrParagraph, width: number): boolean {
  const overlap = Math.max(0, Math.min(a.bbox.x1, b.bbox.x1) - Math.max(a.bbox.x0, b.bbox.x0));
  const narrowest = Math.max(1, Math.min(a.bbox.x1 - a.bbox.x0, b.bbox.x1 - b.bbox.x0));
  return overlap / narrowest >= 0.35 || Math.abs(a.bbox.x0 - b.bbox.x0) < width * 0.1;
}

/** Joins a separately-detected name label and message text back into one chat bubble. */
export function groupScreenshotParagraphs(
  paragraphs: OcrParagraph[],
  width: number,
  height: number
): OcrParagraph[] {
  const grouped: OcrParagraph[] = [];
  for (const paragraph of paragraphs) {
    const previous = grouped[grouped.length - 1];
    const gap = previous ? verticalGap(previous, paragraph) : Number.POSITIVE_INFINITY;
    const joinsPrevious = Boolean(previous)
      && previous.side !== "center"
      && previous.side === paragraph.side
      && gap >= -height * 0.006
      && gap <= height * 0.026
      && horizontallyRelated(previous, paragraph, width)
      && (previous.bubbleKey === paragraph.bubbleKey || looksLikeSenderName(previous.text));

    if (!joinsPrevious || !previous) {
      grouped.push({ ...paragraph, rawLines: [...paragraph.rawLines], bbox: { ...paragraph.bbox } });
      continue;
    }

    previous.rawLines.push(...paragraph.rawLines);
    previous.text = previous.rawLines.join(" ").trim();
    previous.confidence = Math.max(previous.confidence, paragraph.confidence);
    previous.sitsOnBubble = previous.sitsOnBubble || paragraph.sitsOnBubble;
    previous.bbox = {
      x0: Math.min(previous.bbox.x0, paragraph.bbox.x0),
      y0: Math.min(previous.bbox.y0, paragraph.bbox.y0),
      x1: Math.max(previous.bbox.x1, paragraph.bbox.x1),
      y1: Math.max(previous.bbox.y1, paragraph.bbox.y1),
    };
  }
  return grouped;
}

function overlapsExisting(candidate: OcrParagraph, paragraphs: OcrParagraph[]): boolean {
  return paragraphs.some((paragraph) => {
    const overlapWidth = Math.max(0, Math.min(candidate.bbox.x1, paragraph.bbox.x1) - Math.max(candidate.bbox.x0, paragraph.bbox.x0));
    const overlapHeight = Math.max(0, Math.min(candidate.bbox.y1, paragraph.bbox.y1) - Math.max(candidate.bbox.y0, paragraph.bbox.y0));
    const overlap = overlapWidth * overlapHeight;
    const candidateArea = Math.max(1, (candidate.bbox.x1 - candidate.bbox.x0) * (candidate.bbox.y1 - candidate.bbox.y0));
    const paragraphArea = Math.max(1, (paragraph.bbox.x1 - paragraph.bbox.x0) * (paragraph.bbox.y1 - paragraph.bbox.y0));
    return overlap / Math.min(candidateArea, paragraphArea) >= 0.55;
  });
}

/** Finds filled, saturated chat bubbles without uploading or interpreting pixels. */
export function detectColouredBubbleBoxes(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Box[] {
  const rows: Array<{ y: number; x0: number; x1: number; count: number }> = [];
  const minimumColouredPixels = Math.max(12, Math.floor(width * 0.06));
  for (let y = 0; y < height; y += 1) {
    let count = 0;
    let x0 = width;
    let x1 = 0;
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      if (pixels[index + 3] < 220) continue;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (Math.max(red, green, blue) - Math.min(red, green, blue) < 38) continue;
      count += 2;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x + 2);
    }
    if (count >= minimumColouredPixels) rows.push({ y, x0, x1, count });
  }

  const boxes: Array<Box & { colouredPixels: number }> = [];
  for (const row of rows) {
    const current = boxes[boxes.length - 1];
    if (current && row.y <= current.y1 + 3) {
      current.y1 = row.y + 1;
      current.x0 = Math.min(current.x0, row.x0);
      current.x1 = Math.max(current.x1, row.x1);
      current.colouredPixels += row.count;
    } else {
      boxes.push({ x0: row.x0, y0: row.y, x1: row.x1, y1: row.y + 1, colouredPixels: row.count });
    }
  }
  return boxes.filter((box) => {
    const boxWidth = box.x1 - box.x0;
    const boxHeight = box.y1 - box.y0;
    const fillRatio = box.colouredPixels / Math.max(1, boxWidth * boxHeight);
    return boxWidth >= width * 0.12
      && boxHeight >= Math.max(18, height * 0.012)
      && boxHeight <= height * 0.28
      && fillRatio >= 0.35;
  }).map(({ x0, y0, x1, y1 }) => ({ x0, y0, x1, y1 }));
}

export function chooseScreenshotSender(
  side: OcrSide,
  explicitSender: string | undefined,
  bubbleKey: string,
  lastNamedSender: Map<OcrSide, string>,
  colourSpeakers: Map<string, string>
): string {
  if (explicitSender) {
    lastNamedSender.set(side, explicitSender);
    colourSpeakers.set(`${side}-${bubbleKey}`, explicitSender);
    return explicitSender;
  }
  if (side === "right") return "You";
  const key = `${side}-${bubbleKey}`;
  if (colourSpeakers.has(key)) return colourSpeakers.get(key)!;
  if (!colourSpeakers.has(key)) colourSpeakers.set(key, `Unclear speaker ${colourSpeakers.size + 1}`);
  return colourSpeakers.get(key)!;
}

/** Local OCR with bubble, name-label, colour, and alignment cues. */
export async function readChatScreenshot(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
  language: OcrLanguage = "auto"
): Promise<ScreenshotRead> {
  if (file.size > MAX_SCREENSHOT_BYTES) {
    throw new Error("SCREENSHOT_TOO_LARGE");
  }
  const [{ createWorker, OEM, PSM }, bitmap] = await Promise.all([
    import("tesseract.js"),
    createImageBitmap(file),
  ]);
  const { width, height } = screenshotCanvasSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Screenshot canvas is unavailable on this device.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const worker = await createWorker(trainedDataFor(language), OEM.LSTM_ONLY, {
    logger(message) { onProgress?.({ status: message.status, progress: message.progress }); },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
    // Tesseract can combine several visually separate chat bubbles into one
    // paragraph, especially when they share the same colour and alignment. Use
    // its line boxes as the spatial source of truth, then rebuild a bubble from
    // adjacent lines below. This preserves group-chat sender labels instead of
    // letting one large OCR paragraph swallow the messages beneath it.
    const extractParagraphs = (
      blocks: NonNullable<Awaited<ReturnType<typeof worker.recognize>>["data"]["blocks"]>,
      offsetX = 0,
      offsetY = 0,
      forcedSide?: OcrParagraph["side"]
    ): OcrParagraph[] => blocks
      .flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))
      .map((line) => {
        const rawLines = line.text.split(/\r\n|\r|\n/)
          .map(normaliseOcrLine).filter(Boolean);
        const text = rawLines.join(" ").trim();
        const bbox = {
          x0: line.bbox.x0 + offsetX,
          y0: line.bbox.y0 + offsetY,
          x1: line.bbox.x1 + offsetX,
          y1: line.bbox.y1 + offsetY,
        };
        const left = bbox.x0;
        const right = width - bbox.x1;
        const side: OcrParagraph["side"] = forcedSide ?? (Math.abs(left - right) < width * 0.055
          ? "center" : left < right ? "left" : "right");
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
          rawLines, text, confidence: line.confidence, bbox, side,
          bubbleKey: quantizedColour(bubbleColour),
          sitsOnBubble: side !== "center" && colourDistance(bubbleColour, outside) >= 11,
        };
      })
      .filter((paragraph) => paragraph.text.length > 1 && paragraph.confidence >= 28)
      .filter((paragraph) => paragraph.bbox.x1 - paragraph.bbox.x0 < width * 0.86)
      .sort((a, b) => a.bbox.y0 - b.bbox.y0);

    const result = await worker.recognize(canvas, {}, { blocks: true, text: true });
    let paragraphs = extractParagraphs(result.data.blocks ?? []);
    const sideCounts = {
      left: paragraphs.filter((paragraph) => paragraph.side === "left").length,
      right: paragraphs.filter((paragraph) => paragraph.side === "right").length,
    };

    // Whole-page segmentation commonly ignores white text on a coloured bubble.
    // If one side is sparse, detect saturated bubble rectangles and read each
    // crop as a single block. This stays fully on-device and is both faster and
    // more reliable than another whole-screenshot OCR pass.
    if (sideCounts.left < 2 || sideCounts.right < 2) {
      const image = context.getImageData(0, 0, width, height);
      const colouredBoxes = detectColouredBubbleBoxes(image.data, width, height);
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
      for (const box of colouredBoxes) {
        const cropWidth = Math.max(1, Math.ceil(box.x1 - box.x0));
        const cropHeight = Math.max(1, Math.ceil(box.y1 - box.y0));
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        const cropContext = cropCanvas.getContext("2d");
        if (!cropContext) continue;
        cropContext.drawImage(canvas, box.x0, box.y0, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        const cropResult = await worker.recognize(cropCanvas, {}, { blocks: true, text: true });
        const boxLeft = box.x0;
        const boxRight = width - box.x1;
        const boxSide: OcrParagraph["side"] = Math.abs(boxLeft - boxRight) < width * 0.055
          ? "center" : boxLeft < boxRight ? "left" : "right";
        const cropParagraphs = extractParagraphs(cropResult.data.blocks ?? [], box.x0, box.y0, boxSide);
        if (cropParagraphs.length) {
          // A crop is the higher-quality reading for this coloured region. Drop
          // any overlapping whole-page fragment (often gibberish) before adding
          // the isolated lines, rather than letting that fragment suppress them.
          paragraphs = paragraphs.filter((paragraph) => !overlapsExisting(paragraph, cropParagraphs));
          paragraphs.push(...cropParagraphs);
        }
      }
      paragraphs.sort((a, b) => a.bbox.y0 - b.bbox.y0);
    }

    paragraphs = groupScreenshotParagraphs(paragraphs, width, height);

    const colourSpeakers = new Map<string, string>();
    const lastNamedSender = new Map<"left" | "right", string>();
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
      sender = chooseScreenshotSender(paragraph.side, sender, paragraph.bubbleKey, lastNamedSender, colourSpeakers);
      participantNames.add(sender);
      messages.push(`${sender}: ${embedded.text}`);
    }
    if (!messages.length) throw new Error("No chat bubbles were found after removing headers, timestamps, and OCR debris.");
    return {
      transcript: messages.join("\n"),
      messageCount: messages.length,
      participantCount: participantNames.size,
      participants: [...participantNames],
    };
  } finally {
    await worker.terminate();
  }
}
