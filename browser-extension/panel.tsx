import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CompanionPanel, { type CompanionTransport } from "../components/CompanionPanel";
import "../components/companion.css";
import "./page.css";

const transport: CompanionTransport = {
  disclosure: () => chrome.runtime.sendMessage({ type: "DISCLOSURE" }),
  session: () => chrome.runtime.sendMessage({ type: "SESSION" }),
  // Keep slow model requests in the visible extension page, not an ephemeral
  // MV3 worker (Chrome may terminate a worker waiting >30s for fetch headers).
  coach: async body => {
    const response = await fetch("https://neonjungletools.com/subtext/api/answer-coach/", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      cache: "no-store", signal: AbortSignal.timeout(150000),
    });
    return response.json();
  },
  copy: text => navigator.clipboard.writeText(text),
};
function ExtensionPanel() {
  const [capture, setCapture] = useState({ text: "", source: "Tap Scan to read the visible conversation. Nothing is read in the background.", sequence: 0 });
  async function scan() {
    const result = await chrome.runtime.sendMessage({ type: "SCAN" });
    setCapture(previous => ({ text: result?.text || "", source: result?.source || result?.reason || "Highlight text in your conversation, then open Subtext again.", sequence: previous.sequence + 1 }));
  }
  // This frame is created only through the extension toolbar action.
  useEffect(() => { void scan(); }, []);
  return <CompanionPanel key={capture.sequence} initialText={capture.text} source={capture.source} transport={transport} onScan={scan} onClose={() => chrome.runtime.sendMessage({ type: "CLOSE" })} />;
}
createRoot(document.getElementById("root")!).render(<ExtensionPanel />);
