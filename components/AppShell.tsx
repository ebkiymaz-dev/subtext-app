"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/basePath";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { modeSummary } from "@/lib/config";
import CapabilityBar from "@/components/CapabilityBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${BASE_PATH}/sw.js`).catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-[100dvh] bg-sbt-paper">
      <header className="sticky top-0 z-40 border-b border-sbt-linen bg-sbt-paper/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* The wordmark's two voices: script "Sub", serif "text". This is the
              ONLY place font-script is used — see lib/fonts.ts. Pinyon Script
              has a tiny x-height, hence the size bump and the -mr to close the
              gap its wide sidebearing leaves. aria-label carries the real name
              so screen readers never hear it as two words. */}
          <Link href="/" className="flex items-baseline" aria-label="Subtext — home">
            <span aria-hidden className="font-script text-3xl leading-none text-sbt-dusk -mr-0.5">
              Sub
            </span>
            <span aria-hidden className="font-display text-xl font-medium tracking-tight text-sbt-ink">
              text
            </span>
            <span aria-hidden className="ml-2 h-1.5 w-1.5 rounded-full bg-sbt-gold-700" />
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className={`rounded-sbt px-3 py-1.5 transition-colors ${
                pathname === "/" ? "text-sbt-ink" : "text-sbt-mute hover:text-sbt-ink"
              }`}
            >
              Read
            </Link>
            <Link
              href="/plans"
              className={`rounded-sbt px-3 py-1.5 transition-colors ${
                pathname === "/plans" ? "text-sbt-ink" : "text-sbt-mute hover:text-sbt-ink"
              }`}
            >
              Plans
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {/* Honest provider state. Renders nothing when a model is connected;
            when one is not, says so as the privacy feature it actually is
            rather than as a missing dependency. */}
        <CapabilityBar />
        {children}
      </main>

      <footer className="border-t border-sbt-linen">
        <div className="mx-auto w-full max-w-6xl space-y-1 px-4 py-6 sm:px-6">
          <p className="text-xs leading-relaxed text-sbt-mute">
            Subtext reads language, not people. It cannot detect lies, diagnose anything, or tell
            you what someone meant. It shows you which markers are present and where.
          </p>
          <p className="text-[10px] uppercase tracking-widest text-sbt-mute/70">
            on-device analysis · {modeSummary()} · your conversation never leaves this device
          </p>
        </div>
      </footer>
    </div>
  );
}
