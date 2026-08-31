export const CHAT_IMPORT_LIMIT = 12_000;

export type ImportedChatText = {
  text: string;
  truncated: boolean;
};

/**
 * Prepare a plain-text chat export without sending it anywhere.
 *
 * When an export is too large for the deliberately small on-device workspace,
 * keep the newest complete lines. Recent context is normally the part the user
 * is asking about, and cutting on a line boundary avoids inventing a partial
 * first message.
 */
export function prepareImportedChatText(source: string, limit = CHAT_IMPORT_LIMIT): ImportedChatText {
  const normalized = source
    .replace(/^\uFEFF/, "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (normalized.length <= limit) return { text: normalized, truncated: false };

  const tail = normalized.slice(-limit);
  const firstLineBreak = tail.indexOf("\n");
  return {
    text: (firstLineBreak >= 0 ? tail.slice(firstLineBreak + 1) : tail).trim(),
    truncated: true,
  };
}
