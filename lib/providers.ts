// ═════════════════════════════════════════════════════════════
// PROVIDER CAPABILITIES — the TypeScript half of nj_providers.
//
// Mirrors the resolution rules of the suite's Python provider layer
// (`Neon Jungle Tools/nj_providers/`) so a key pasted into one .env behaves the
// same everywhere. Subtext is browser-only and cannot import that package.
//
// ── THE RULE THAT MATTERS ────────────────────────────────────
// THIS FILE MUST ONLY EVER RUN ON THE SERVER.
//
// It reads process.env for names like GROQ_API_KEY. Those are deliberately NOT
// prefixed NEXT_PUBLIC_, because that prefix inlines a value into the browser
// bundle — a provider key in a NEXT_PUBLIC_ variable is a published key. The
// importers are server-only Route Handlers. Never import this from a "use
// client" component.
//
// ── SUBTEXT IS THE SPECIAL CASE ──────────────────────────────
// This app's core promise is "your conversation never touches our server", and
// that promise is architectural: segmentation, the distress screen and every
// deterministic category run on-device and always will. Only an explicit,
// paid Answer Coach request sends conversation text to a configured provider.
//
// So a missing LLM here is NOT a broken app — it is the fully private one. The
// copy below says that rather than nagging, and Ollama is presented as the
// RECOMMENDED provider rather than a fallback, because a local model is the
// only option that keeps the promise literally true.
// ═════════════════════════════════════════════════════════════

export type CapabilityState = "live" | "degraded" | "blocked";

export interface ConnectBlock {
  account: string;
  label: string;
  signupUrl: string;
  envVars: string[];
  freeTier: string;
  cardRequired: boolean;
  warning?: string;
  recommended?: boolean;
}

export interface Capability {
  capability: "llm";
  state: CapabilityState;
  provider: string;
  label: string;
  free: boolean;
  configured: boolean;
  limit: string;
  privacy: string;
  headline?: string;
  body?: string;
  connect?: ConnectBlock | null;
  alternatives?: ConnectBlock[];
  missingEnv: string[];
}

export interface CapabilityReport {
  app: string;
  label: string;
  state: CapabilityState;
  allLive: boolean;
  capabilities: { llm: Capability };
  connectToUnlock: ConnectBlock[];
}

const env = (name: string): string => (process.env[name] ?? "").trim();

const OLLAMA: ConnectBlock = {
  account: "ollama",
  label: "Ollama (local)",
  signupUrl: "https://ollama.com/download",
  envVars: ["OLLAMA_HOST"],
  freeTier:
    "No account, no key, no quota — the limit is your GPU. Nothing leaves this " +
    "machine, which is the only setup that keeps Subtext's privacy promise " +
    "literally true.",
  cardRequired: false,
  recommended: true,
};

const GROQ: ConnectBlock = {
  account: "groq",
  label: "Groq",
  signupUrl: "https://console.groq.com/keys",
  envVars: ["GROQ_API_KEY"],
  freeTier: "Free, no card. ~30 req/min; token-per-minute is the real cap.",
  cardRequired: false,
  warning:
    "Hosted, so message text would leave this machine. Groq does not retain or " +
    "train on it, but local Ollama is the stronger promise for this app.",
};

const LLM_ORDER = ["groq", "gemini", "ollama", "openai", "claude"] as const;

const LLM_SPECS: Record<
  string,
  { label: string; keyEnv: string; free: boolean; limit: string; privacy: string }
> = {
  groq: {
    label: "Groq",
    keyEnv: "GROQ_API_KEY",
    free: true,
    limit: "Free tier, no card: roughly 30 requests/minute, per organisation.",
    privacy: "Groq's services agreement says user data is not retained or used to train.",
  },
  gemini: {
    label: "Google Gemini",
    keyEnv: "GEMINI_API_KEY",
    free: true,
    limit: "Free tier, no card. Real limits are per-project and not guaranteed.",
    privacy:
      "Paid Gemini API data terms: prompts and responses are not used to improve Google's products; " +
      "limited abuse-monitoring retention can still apply.",
  },
  ollama: {
    label: "Ollama (local)",
    keyEnv: "",
    free: true,
    limit: "No quota at all — the limit is the GPU, and requests are serial.",
    privacy: "Fully local. Nothing leaves the machine. Private by construction.",
  },
  openai: {
    label: "OpenAI",
    keyEnv: "OPENAI_API_KEY",
    free: false,
    limit: "Paid per token. No free tier.",
    privacy: "API data is not used for training by default.",
  },
  claude: {
    label: "Anthropic Claude",
    keyEnv: "ANTHROPIC_API_KEY",
    free: false,
    limit: "Paid per token. No free tier.",
    privacy: "API data is not used for training by default.",
  },
};

function llmIsConfigured(name: string): boolean {
  if (name === "ollama") {
    return Boolean(env("OLLAMA_HOST")) || env("LLM_PROVIDER").toLowerCase() === "ollama";
  }
  const spec = LLM_SPECS[name];
  const hasCredentials = Boolean(spec?.keyEnv && env(spec.keyEnv));
  if (!hasCredentials) return false;
  if (env("ANSWER_COACH_PROVIDER_TERMS_CONFIRMED").toLowerCase() !== "true") return false;
  if (name === "gemini" && env("GEMINI_PAID_DATA_TERMS_CONFIRMED").toLowerCase() !== "true") return false;
  return true;
}

function coachMissingConfiguration(provider: string, spec?: { keyEnv: string }): string[] {
  const missing: string[] = [];
  if (spec?.keyEnv && !env(spec.keyEnv)) missing.push(spec.keyEnv);
  if (provider !== "ollama" && env("ANSWER_COACH_PROVIDER_TERMS_CONFIRMED").toLowerCase() !== "true") {
    missing.push("ANSWER_COACH_PROVIDER_TERMS_CONFIRMED=true");
  }
  if (provider === "gemini" && env("GEMINI_PAID_DATA_TERMS_CONFIRMED").toLowerCase() !== "true") {
    missing.push("GEMINI_PAID_DATA_TERMS_CONFIRMED=true");
  }
  return missing;
}

export function resolveLlmProvider(): string {
  const explicit = (env("LLM_PROVIDER") || env("AI_PROVIDER") || "auto").toLowerCase();
  if (explicit in LLM_SPECS) return explicit;
  for (const candidate of LLM_ORDER) {
    if (llmIsConfigured(candidate)) return candidate;
  }
  return "ollama"; // the recommended provider for this app specifically
}

// ═════════════════════════════════════════════════════════════
// THE ANSWER-COACH PROVIDER SEAM (Premium tier).
//
// `capabilityReport()` below answers "what is configured?" for the UI and
// returns booleans only. THIS function answers "how do I call it?" and
// returns a key — so it is only ever called from the Answer Coach server route,
// which is a server Route Handler. It must never be imported from a
// "use client" module; doing so would put a provider key in the bundle.
//
// Model ladders are deliberately duplicated from the Python
// `nj_providers/llm.py` rather than abstracted: model ids are the single most
// perishable constant in the estate (Google retires ids out from under a
// pinned name), and a ladder that walks past a 404 is the only thing that
// keeps a pinned id from becoming an outage.
// ═════════════════════════════════════════════════════════════

export interface CoachProvider {
  provider: string;
  label: string;
  /** which wire protocol to speak */
  kind: "gemini" | "openai";
  /** mutated by the route to record which rung actually answered */
  model: string;
  ladder: string[];
  baseUrl: string;
  apiKey: string;
  configured: boolean;
  missingEnv: string[];
  free: boolean;
  privacy: string;
}

const COACH_MODEL_LADDERS: Record<string, string[]> = {
  // Verified against the live API 2026-07-29 in nj_providers: ListModels and
  // generateContent disagree, so this ladder is the call-verified one.
  gemini: ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.0-flash"],
  groq: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  ollama: ["qwen2.5:14b-instruct"],
  openai: ["gpt-4o-mini"],
};

export function resolveCoachProvider(): CoachProvider {
  const provider = resolveLlmProvider();
  const spec = LLM_SPECS[provider];
  // Claude's Messages API is a different shape from chat-completions. A shim
  // that silently dropped parameters would be worse than an honest refusal,
  // so this seam declines it rather than pretending.
  const configured = llmIsConfigured(provider) && provider !== "claude";
  const envModel = env(`${provider.toUpperCase()}_MODEL`);
  const ladder = envModel
    ? [envModel, ...(COACH_MODEL_LADDERS[provider] ?? []).filter((m) => m !== envModel)]
    : (COACH_MODEL_LADDERS[provider] ?? []);

  const baseUrl =
    provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : provider === "ollama"
        ? `${env("OLLAMA_HOST") || "http://127.0.0.1:11434"}/v1`
        : provider === "openai"
          ? "https://api.openai.com/v1"
          : "";

  return {
    provider,
    label: spec?.label ?? provider,
    kind: provider === "gemini" ? "gemini" : "openai",
    model: ladder[0] ?? "",
    ladder,
    baseUrl,
    apiKey: spec?.keyEnv ? env(spec.keyEnv) : "",
    configured,
    missingEnv:
      provider === "claude"
        ? ["GEMINI_API_KEY", "GROQ_API_KEY", "OLLAMA_HOST (Anthropic's API is not chat-completions shaped)"]
        : configured ? [] : coachMissingConfiguration(provider, spec),
    free: spec?.free ?? false,
    privacy: spec?.privacy ?? "",
  };
}

export function capabilityReport(): CapabilityReport {
  const provider = resolveLlmProvider();
  const spec = LLM_SPECS[provider];
  const configured = llmIsConfigured(provider);

  const llm: Capability = {
    capability: "llm",
    // Never "blocked": the whole deterministic engine runs regardless, so the
    // app is fully usable with no provider at all.
    state: configured ? "live" : "degraded",
    provider,
    label: spec.label,
    free: spec.free,
    configured,
    limit: spec.limit,
    privacy: spec.privacy,
    headline: configured ? undefined : "Inferred reads are running on-device",
    body: configured
      ? undefined
      : "Segmentation, the distress screen and every deterministic category run " +
        "locally and are unaffected — that part never changes. The categories " +
        "marked “inferred” and the interpretation prose are currently computed " +
        "from the same lexicons instead of a model, and are labelled as such " +
        "wherever they appear. Connecting a LOCAL model keeps this fully private " +
        "and is the recommended setup for Subtext.",
    connect: configured ? null : OLLAMA,
    alternatives: configured ? [] : [GROQ],
    missingEnv: configured ? [] : coachMissingConfiguration(provider, spec),
  };

  return {
    app: "subtext",
    label: "Subtext",
    state: llm.state,
    allLive: llm.state === "live",
    capabilities: { llm },
    connectToUnlock: llm.connect ? [llm.connect] : [],
  };
}
