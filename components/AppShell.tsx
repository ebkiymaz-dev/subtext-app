"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/basePath";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { config } from "@/lib/config";
import CapabilityBar from "@/components/CapabilityBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`)
        .then((registration) => registration.update())
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-[100dvh] bg-sbt-paper">
      <header className="sticky top-0 z-40 border-b border-sbt-linen bg-sbt-paper/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
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
              href="/archive"
              className={`rounded-sbt px-3 py-1.5 transition-colors ${
                pathname.startsWith("/archive") ? "text-sbt-ink" : "text-sbt-mute hover:text-sbt-ink"
              }`}
            >
              Archive
            </Link>
            {config.billingMode !== "mock" ? (
              <Link
                href="/plans"
                className={`rounded-sbt px-3 py-1.5 transition-colors ${
                  pathname === "/plans" ? "text-sbt-ink" : "text-sbt-mute hover:text-sbt-ink"
                }`}
              >
                Plans
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6 sm:pb-16 sm:pt-6">
        {/* Honest provider state. Renders nothing when a model is connected;
            when one is not, says so as the privacy feature it actually is
            rather than as a missing dependency. */}
        <CapabilityBar />
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-sbt-linen bg-sbt-paper/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Subtext navigation"
      >
        <Link
          href="/"
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] ${pathname === "/" ? "text-sbt-gold-700" : "text-sbt-mute"}`}
        >
          <span aria-hidden className="text-base">◉</span>
          Read
        </Link>
        <Link
          href="/archive"
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] ${pathname.startsWith("/archive") ? "text-sbt-gold-700" : "text-sbt-mute"}`}
        >
          <span aria-hidden className="text-base">▣</span>
          Archive
        </Link>
        <Link
          href="/privacy"
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] ${pathname.startsWith("/privacy") ? "text-sbt-gold-700" : "text-sbt-mute"}`}
        >
          <span aria-hidden className="text-base">⌾</span>
          Privacy
        </Link>
      </nav>

      <footer className="border-t border-sbt-linen pb-16 sm:pb-0">
        <div className="mx-auto w-full max-w-6xl space-y-1 px-4 py-6 sm:px-6">
          <p className="text-xs leading-relaxed text-sbt-mute">
            Subtext reads language, not people. It cannot detect lies, diagnose anything, or tell
            you what someone meant. It shows you which markers are present and where.
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-widest text-sbt-mute/70">
            <p>private by default · archive and deep read are always optional</p>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-sbt-dusk">
              Privacy policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
