// ── FONT LOADING (single swap point) ─────────────────────────
// All faces are OFL, downloaded + self-hosted at BUILD TIME by next/font, so
// the running app makes zero third-party requests — which matters more here
// than anywhere: this app handles people's private messages.
// The build machine needs access to fonts.googleapis.com; in a locked-down
// sandbox swap this one file for next/font/local.
//
// ── 2026-07-28 rebrand: ELEGANT ──────────────────────────────
// The wordmark pairs a script "Sub" with a classic serif "text". Three faces
// carry that across the UI:
//
//   display  Playfair Display — high stroke contrast, editorial. Headings and
//            pull quotes. Replaces Spectral, which was quieter and more
//            utilitarian than the mark.
//   body     Inter — the quiet sans. Everything functional: controls, labels,
//            transcripts. Deliberately NOT a serif; long analysis output has
//            to stay legible at small sizes.
//   script   Pinyon Script — the flourish, and the one to be careful with. It
//            is for the wordmark and the occasional section ornament ONLY.
//            Never body copy, never below ~24px, never anything a reader has
//            to parse quickly: it fails at small sizes and for dyslexic
//            readers. Used in exactly one place today (the header wordmark).

import { Playfair_Display, Inter, Pinyon_Script } from "next/font/google";

export const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

/** Ornamental only — read the note above before reaching for this. */
export const script = Pinyon_Script({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-script",
  display: "swap",
});

export const fontClass = `${display.variable} ${body.variable} ${script.variable}`;
