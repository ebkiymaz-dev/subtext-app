// SEGMENTATION — turn a pasted conversation into speaker-attributed messages.
// Handles the three shapes people actually paste: "Name: text", a WhatsApp
// export ("[12/03/2026, 14:22] Name: text"), and bare alternating lines.
// 100% local — this never leaves the device, in mock OR live.

import type { Message, Speaker, Transcript } from "./types";

const WHATSAPP =
  /^\[?(\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?)\]?\s*[-–]?\s*([^:]{1,40}):\s*(.+)$/;
const NAMED = /^([A-Za-z][\w .'-]{0,30}):\s*(.+)$/;

export function segment(raw: string): Transcript {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return { messages: [], names: [], format: "single" };

  const parsed: { name: string; text: string; timestamp?: string }[] = [];
  let format: Transcript["format"] = "alternating";

  const whatsappCount = lines.filter((l) => WHATSAPP.test(l)).length;
  const namedCount = lines.filter((l) => NAMED.test(l)).length;

  if (whatsappCount >= Math.max(2, lines.length * 0.5)) {
    format = "whatsapp";
    for (const line of lines) {
      const m = line.match(WHATSAPP);
      if (m) parsed.push({ timestamp: m[1], name: m[2].trim(), text: m[3].trim() });
      else if (parsed.length) parsed[parsed.length - 1].text += ` ${line}`;
    }
  } else if (namedCount >= Math.max(2, lines.length * 0.5)) {
    format = "named";
    for (const line of lines) {
      const m = line.match(NAMED);
      if (m) parsed.push({ name: m[1].trim(), text: m[2].trim() });
      else if (parsed.length) parsed[parsed.length - 1].text += ` ${line}`;
    }
  } else if (lines.length === 1) {
    format = "single";
    parsed.push({ name: "Them", text: lines[0] });
  } else {
    format = "alternating";
    lines.forEach((line, i) => parsed.push({ name: i % 2 === 0 ? "You" : "Them", text: line }));
  }

  const names = [...new Set(parsed.map((p) => p.name))];

  // First-person heuristic for the default "which one is you?" — the user can flip it.
  const defaultYou =
    names.find((n) => /^(you|me|myself)$/i.test(n)) ?? names[0] ?? "You";

  const messages: Message[] = parsed.map((p, i) => ({
    id: `m${i}`,
    index: i,
    speaker: (p.name === defaultYou ? "you" : "them") as Speaker,
    name: p.name,
    text: p.text,
    timestamp: p.timestamp,
  }));

  return { messages, names, format };
}

/** Re-attribute after the user answers "which one is you?" */
export function setYou(t: Transcript, youName: string): Transcript {
  return {
    ...t,
    messages: t.messages.map((m) => ({
      ...m,
      speaker: (m.name === youName ? "you" : "them") as Speaker,
    })),
  };
}
