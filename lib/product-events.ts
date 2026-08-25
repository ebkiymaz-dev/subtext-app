export type SubtextEvent =
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "distress_guard_shown"
  | "read_shared"
  | "sample_loaded"
  | "screenshot_imported"
  | "conversation_archived";

const KEY = "subtext.product-events.v1";

/** Local aggregate only: no conversation text, names, URLs, or arbitrary metadata. */
export function recordProductEvent(event: SubtextEvent): void {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
    current[event] = Math.max(0, Number(current[event]) || 0) + 1;
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Measurement is optional and must never interrupt the product.
  }
}
