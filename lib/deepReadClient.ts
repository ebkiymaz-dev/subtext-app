// Client half of the deep read. Posts text to the server route and gets
// structured JSON back. No key, no provider name, no base URL lives here —
// the browser bundle must never contain any of those.

import type { DeepReadResult } from "./engine/deepRead";
import type { ContextId } from "./engine/types";
import { withBase } from "./basePath";

export async function requestDeepRead(
  text: string,
  context: ContextId,
  youName?: string
): Promise<DeepReadResult> {
  try {
    const res = await fetch(withBase("/api/deep-read"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context, youName }),
    });
    return (await res.json()) as DeepReadResult;
  } catch {
    return { ok: false, reason: "Could not reach the server. Your on-device analysis is unaffected." };
  }
}
