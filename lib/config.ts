// SUBTEXT — runtime mode config. Everything defaults to mock: the whole
// mechanic runs with zero keys and zero cost.

export type LlmMode = "mock" | "live";
export type BillingMode = "mock" | "play";

function envOr<T extends string>(v: string | undefined, fallback: T): T {
  return (v as T) || fallback;
}

export const config = {
  /** live → ONE structured call per analysis for the inferred categories */
  llmMode: envOr<LlmMode>(process.env.NEXT_PUBLIC_LLM_MODE, "mock"),
  billingMode: envOr<BillingMode>(process.env.NEXT_PUBLIC_BILLING_MODE, "mock"),
} as const;

export const modeSummary = () => `llm:${config.llmMode} · billing:${config.billingMode}`;
