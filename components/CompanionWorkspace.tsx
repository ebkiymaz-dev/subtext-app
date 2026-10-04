"use client";
import { useEffect, useRef, useState } from "react";
import CompanionPanel, { type CompanionTransport } from "./CompanionPanel";
import { getFreeAnswerAceSession } from "@/lib/freeAnswerAceClient";
import { withBase } from "@/lib/basePath";
import { readChatScreenshot } from "@/lib/screenshot-ocr";
import "./companion.css";

interface NativeCompanion { consumeCapture(): string; copyReply(text: string): void; closePanel(): void; scanAgain(): void; getEntitlementProof(): string }
declare global { interface Window { SubtextCompanion?: NativeCompanion } }
const transport: CompanionTransport = {
  disclosure: async () => {
    const response = await fetch(withBase("/api/capabilities"), { cache: "no-store", signal: AbortSignal.timeout(15000) });
    return (await response.json()).coachProvider;
  },
  session: async () => {
    try {
      const proof = JSON.parse(window.SubtextCompanion?.getEntitlementProof() || "{}");
      if (proof.purchaseToken && proof.packageName && proof.productId) return { ok: true, entitlement: proof };
    } catch { /* Server-verified free access remains available. */ }
    return getFreeAnswerAceSession();
  },
  coach: async body => {
    const response = await fetch(withBase("/api/answer-coach"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(150000) });
    return response.json();
  },
  copy: async text => { if (window.SubtextCompanion) window.SubtextCompanion.copyReply(text); else await navigator.clipboard.writeText(text); },
};
export default function CompanionWorkspace() {
  const [capture, setCapture] = useState({ text: "", sequence: 0 });
  const [status, setStatus] = useState("Paste text here, or choose Use Subtext to analyze text from the Android notification.");
  const extraction = useRef<Promise<string | null> | null>(null);
  useEffect(() => {
    let active = true;
    async function extract(): Promise<string | null> {
      const raw = window.SubtextCompanion?.consumeCapture();
      if (!raw) return null;
        const payload = JSON.parse(raw);
        if (!payload.base64) return null;
        const bytes = Uint8Array.from(atob(payload.base64), c => c.charCodeAt(0));
        const file = new File([bytes], "conversation.jpg", { type: "image/jpeg" });
        setStatus("Reading this screenshot on your device…");
        const result = await readChatScreenshot(file);
        return result.transcript;
    }
    // Reuse the one-time native handoff during React StrictMode effect replay.
    if (!extraction.current) extraction.current = extract();
    extraction.current.then(text => {
        if (!active || text === null) return;
        setCapture(previous => ({ text, sequence: previous.sequence + 1 }));
        setStatus("Check the captured words and speaker names below. Only the visible screen was captured.");
    }).catch(() => { if (active) setStatus("Could not read this screen. It may be protected or unclear. Paste the message, or close this panel and scan again."); });
    return () => { active = false; };
  }, []);
  return <CompanionPanel key={capture.sequence} initialText={capture.text} source="Conversation Assist" status={status} transport={transport} onScan={() => window.SubtextCompanion?.scanAgain()} onClose={() => window.SubtextCompanion?.closePanel()} />;
}
