export type OcrProgress = {
  status: string;
  progress: number;
};

export type ScreenshotRead = {
  transcript: string;
  messageCount: number;
};

const SYSTEM_LINE = /^(?:read|delivered|sent|today|yesterday|typing…?|\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}[/.]\d{1,2}[/.]\d{2,4})$/i;

/**
 * Reads a chat screenshot entirely inside the browser. Tesseract may download
 * its English OCR model the first time, but the selected image is never sent
 * to Subtext or an OCR API.
 */
export async function readChatScreenshot(
  file: File,
  onProgress?: (progress: OcrProgress) => void
): Promise<ScreenshotRead> {
  const [{ createWorker, OEM, PSM }, bitmap] = await Promise.all([
    import("tesseract.js"),
    createImageBitmap(file),
  ]);

  const width = bitmap.width;
  bitmap.close();

  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    logger(message) {
      onProgress?.({ status: message.status, progress: message.progress });
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });
    const result = await worker.recognize(file, {}, { blocks: true, text: true });
    const paragraphs = (result.data.blocks ?? [])
      .flatMap((block) => block.paragraphs)
      .map((paragraph) => ({
        text: paragraph.text.replace(/\s+/g, " ").trim(),
        confidence: paragraph.confidence,
        bbox: paragraph.bbox,
      }))
      .filter((paragraph) => paragraph.text.length > 1 && paragraph.confidence >= 28)
      .filter((paragraph) => !SYSTEM_LINE.test(paragraph.text))
      .filter((paragraph) => paragraph.bbox.x1 - paragraph.bbox.x0 < width * 0.82)
      .sort((a, b) => a.bbox.y0 - b.bbox.y0);

    const messages = paragraphs.flatMap((paragraph) => {
      const distanceFromLeft = paragraph.bbox.x0;
      const distanceFromRight = width - paragraph.bbox.x1;
      const difference = Math.abs(distanceFromLeft - distanceFromRight);
      // Centred headers and date separators are not conversation bubbles.
      if (difference < width * 0.06) return [];
      const side = distanceFromLeft < distanceFromRight ? "Left side" : "Right side";
      return [`${side}: ${paragraph.text}`];
    });

    if (!messages.length) {
      throw new Error("No left- or right-aligned chat bubbles were found.");
    }

    return { transcript: messages.join("\n"), messageCount: messages.length };
  } finally {
    await worker.terminate();
  }
}
