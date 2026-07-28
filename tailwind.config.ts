import type { Config } from "tailwindcss";

// "The Considered Reader" — tokens straight from framework/subtext/DESIGN_BUILD.md §A.
//
// 2026-07-28 rebrand (ELEGANT). The palette moves off the cool violet ink and
// coral accent onto the wordmark's warm register: near-black warm ink, and
// gold in place of coral (token RENAMED sbt-gold -> sbt-gold so no class
// still says "coral"). Cream and linen were already right and are untouched.
// Gold is a light hue: on the cream ground use sbt-gold-700, not sbt-gold.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "sbt-ink": "#1F1D1A",
        "sbt-dusk": "#3A342C",
        "sbt-gold": "#B08D3F",
        "sbt-gold-700": "#836524",
        "sbt-teal": "#107F75",
        "sbt-paper": "#FAF7F2",
        "sbt-linen": "#EFE9DF",
        "sbt-mute": "#6B6459",
        "sbt-amber": "#986822",
        "sbt-rose": "#B4415B",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        // Ornament only — see lib/fonts.ts before using this anywhere new.
        script: ["var(--font-script)", "cursive"],
      },
      borderRadius: { sbt: "12px" },
      boxShadow: { soft: "0 2px 24px rgba(36,31,53,0.07)" },
      transitionTimingFunction: { warm: "cubic-bezier(.22,.61,.36,1)" },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fill-bar": { "0%": { width: "0%" } },
      },
      animation: {
        "rise-in": "rise-in 420ms cubic-bezier(.22,.61,.36,1) both",
        "fill-bar": "fill-bar 700ms cubic-bezier(.22,.61,.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
