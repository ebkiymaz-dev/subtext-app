"use client";

import { useState } from "react";
import { eraseAllSubtextData } from "@/lib/privacyControls";

export default function EraseSubtextData() {
  const [state, setState] = useState<"idle" | "erasing" | "done" | "error">("idle");

  async function erase() {
    const confirmed = window.confirm(
      "Erase all Subtext data from this device? This permanently removes your local profile, archived conversations, counters, progress, cached pages, and offline access. This cannot be undone.",
    );
    if (!confirmed) return;

    setState("erasing");
    try {
      await eraseAllSubtextData();
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="rounded-sbt border border-sbt-rose/25 bg-sbt-rose/[0.04] p-4">
      <h3 className="font-display text-base text-sbt-ink">Erase all Subtext data</h3>
      <p className="mt-1 text-xs leading-relaxed text-sbt-mute">
        Removes this device&apos;s local profile, saved conversations, usage and completion counters,
        cached pages, and Subtext offline service worker. It does not affect other Neon Jungle apps.
      </p>
      <button
        type="button"
        onClick={erase}
        disabled={state === "erasing" || state === "done"}
        className="mt-3 rounded-sbt border border-sbt-rose/40 px-4 py-2.5 text-sm font-medium text-sbt-rose disabled:opacity-50"
      >
        {state === "erasing" ? "Erasing…" : state === "done" ? "Subtext data erased" : "Erase all Subtext data"}
      </button>
      {state === "done" ? (
        <p role="status" className="mt-2 text-xs text-sbt-dusk">Local Subtext data and offline state were removed from this device.</p>
      ) : null}
      {state === "error" ? (
        <p role="alert" className="mt-2 text-xs text-sbt-rose">Some browser-managed data could not be removed. Clear Subtext&apos;s storage in your browser or Android app settings.</p>
      ) : null}
    </div>
  );
}
