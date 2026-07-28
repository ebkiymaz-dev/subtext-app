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
// only importer is `app/api/capabilities/route.ts` (server-only). Never import
// this from a "use client" component.
//
// ── SUBTEXT IS THE SPECIAL CASE ──────────────────────────────
// This app's core promise is "your conversation never touches our server", and
// that promise is architectural: segmentation, the distress screen and every
// deterministic category run on-device and always will. Only the `inferred`
// category scores and the interpretation prose would ever go to a model.
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
      "FREE TIER ONLY: Google may use prompts and responses to improve its products, " +
      "and human reviewers may see them. Strongly inadvisable for private messages.",
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
  return Boolean(spec?.keyEnv && env(spec.keyEnv));
}

export function resolveLlmProvider(): string {
  const explicit = (env("LLM_PROVIDER") || env("AI_PROVIDER") || "auto").toLowerCase();
  if (explicit in LLM_SPECS) return explicit;
  for (const candidate of LLM_ORDER) {
    if (llmIsConfigured(candidate)) return candidate;
  }
  return "ollama"; // the recommended provider for this app specifically
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
    missingEnv: configured || !spec.keyEnv ? [] : [spec.keyEnv],
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
