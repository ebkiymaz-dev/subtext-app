"use client";

// ═════════════════════════════════════════════════════════════
// CAPABILITY BAR — honest provider state, tuned for THIS app.
//
// Subtext is the one app in the estate where a missing model is not a
// shortfall. The deterministic engine — segmentation, the distress screen,
// every non-inferred category, all evidence extraction — runs on-device and is
// unaffected. With no provider connected the app is fully usable AND fully
// private, which is the strongest version of its promise.
//
// So this bar deliberately does not nag. It states what is running locally,
// offers a LOCAL model as the recommended upgrade (Ollama, which keeps the
// promise literally true), and mentions the hosted option second with the
// privacy caveat attached rather than buried.
//
// Reads GET /api/capabilities, which serves booleans and signup URLs only —
// never a key, and never any message text.
// ═════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/basePath";

interface ConnectBlock {
  account: string;
  label: string;
  signupUrl: string;
  envVars: string[];
  freeTier: string;
  cardRequired: boolean;
  warning?: string;
  recommended?: boolean;
}

interface Capability {
  capability: string;
  state: "live" | "degraded" | "blocked";
  provider: string;
  label: string;
  headline?: string;
  body?: string;
  connect?: ConnectBlock | null;
  alternatives?: ConnectBlock[];
  missingEnv: string[];
}

interface Report {
  app: string;
  state: string;
  capabilities: Record<string, Capability>;
}

export default function CapabilityBar() {
  const [report, setReport] = useState<Report | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE_PATH}/api/capabilities`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setReport(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const items = report
    ? Object.values(report.capabilities ?? {}).filter((c) => c && c.state !== "live")
    : [];

  const signature = items.map((c) => `${c.capability}=${c.state}/${c.provider}`).join(",");

  useEffect(() => {
    if (!signature) return;
    try {
      setDismissed(sessionStorage.getItem("sbtCapDismiss") === signature);
    } catch {
      /* private mode */
    }
  }, [signature]);

  if (!items.length || dismissed) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-sbt border border-sbt-linen bg-sbt-linen/40 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          {items.map((c) => (
            <div key={c.capability}>
              <h3 className="text-[10px] uppercase tracking-widest text-sbt-mute">
                {c.headline ?? "running in a reduced mode"}
              </h3>
              {c.body && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-sbt-dusk">{c.body}</p>
              )}

              {c.connect?.signupUrl && (
                <div className="mt-2.5">
                  <a
                    href={c.connect.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-sbt border border-sbt-ink/25 px-3 py-1.5 text-[11px] font-medium text-sbt-ink transition-colors hover:bg-sbt-ink hover:text-sbt-paper"
                  >
                    Connect {c.connect.label}
                    {c.connect.recommended ? " · recommended" : ""} →
                  </a>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-sbt-mute">
                    {c.connect.freeTier}
                  </p>
                </div>
              )}

              {c.alternatives?.map((alt) => (
                <div key={alt.account} className="mt-2">
                  <a
                    href={alt.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] underline decoration-sbt-mute/50 underline-offset-2 text-sbt-dusk hover:text-sbt-ink"
                  >
                    Or connect {alt.label} (hosted) →
                  </a>
                  {alt.warning && (
                    <p className="mt-1 text-[10px] leading-relaxed text-sbt-mute">
                      {alt.warning}
                    </p>
                  )}
                </div>
              ))}

              {c.missingEnv?.length > 0 && (
                <p className="mt-2 text-[10px] uppercase tracking-wider text-sbt-mute">
                  set in .env: {c.missingEnv.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          title="Dismiss for this session"
          onClick={() => {
            try {
              sessionStorage.setItem("sbtCapDismiss", signature);
            } catch {
              /* private mode */
            }
            setDismissed(true);
          }}
          className="flex-none text-base leading-none text-sbt-mute opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
