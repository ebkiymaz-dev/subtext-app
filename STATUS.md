# SUBTEXT — STATUS

**Built:** 2026-07-27 · INNOVATOR (Opus) under MAESTRO · for mert
**State:** mock build complete. Runs end to end with zero keys, zero server, zero spend.

## Platform decision
**One responsive PWA.** Desktop is the Grammarly-style paste-and-analyze surface (transcript left,
category panel right, bidirectional highlight between them); mobile is the same app with the paste
path and the panel promoted to the top. **Native (Expo) share-sheet + OCR is noted and deliberately
not built tonight** — those are acquisition features, not capability features, and the honest
position is that no API exists for a third party to read personal DMs at all. See `PLATFORM.md`.

## What was built
Next.js 14 + TypeScript + Tailwind, the exact "Considered Reader" tokens from `DESIGN_BUILD.md`
(twilight ink #241F35, coral #E0785A, calm teal, warm paper, Spectral + Inter, 12px radii).

**The engine (`lib/engine/`)** — `segment` (three paste formats) → **`distress` (the hard rule,
runs first)** → `lexicons` → `categories` → `interpretations` → `analyze`.

**`lib/legitimacy.ts`** — the Seven Legitimacy Laws plus a **banned-lexicon check**: "is lying",
"lie detector", "has trauma", "narcissist", "definitely", "proves that" and friends are forbidden
output. Every string the app renders currently passes with **zero violations**.

**The UI** — `SegmentedTranscript` (inline coral evidence marks, bidirectionally linked to the
panel), `Panel` (the hero: calm sequential fills, per-category read + caveat + evidence count),
`Interpretations` (weighted, charitable read in teal), `CoachCard` (Premium, blurred on Free),
`DistressCard` (the override), plans page with the Seven Laws printed on it.

Four seeded showcase conversations: the slow fade · the terse boss · the family ask · the 2am
message (deliberately last).

## Verification (sandbox, Linux, Node 22, next 14.2.35)
- `tsc --noEmit` — **clean, 0 errors.**
- `next build` — **succeeds, 3 routes.** First-load JS 87.1 kB shared, 112 kB on the main route.
- **Crisis-safety screen: 6/6 cases pass** — three phrasings that must trigger (including one buried
  inside a transcript), two that must not ("I feel hopeless about this project" correctly does *not*
  trigger). On a trigger the app renders resources only: no scores, no interpretations, no paywall,
  and **the free counter is not ticked**.
- **Schema enforcement verified on all samples:** 3–5 interpretations, weights summing to exactly
  100, none above 60%, exactly one flagged charitable.
- **Banned-lexicon check: 0 violations** across every category read, caveat and interpretation.
- **Engine smoke test:** the slow-fade sample returns Fade markers 89%, Evasion 83%, Subtext load
  55%, Engagement 35%, Power 34% ("you are driving") — with 3–4 cited evidence lines each.
- **Honest caveat:** the sandbox blocks `fonts.googleapis.com`, so the build was run with
  `lib/fonts.ts` stubbed. That one file is the only unverified piece.

## Three fixes made during verification
1. The Evasion caveat literally contained the phrase "lie detector" while denying it — which tripped
   the app's own banned-lexicon check. Reworded, because a lint you have to exempt yourself from is
   a bad lint.
2. Several categories were saturating at **100%**, which is both alarmist and a Law 1 violation —
   a confidence panel must never render certainty. Scores are now softened and hard-capped at 92%.
3. One deterministic category scored without a cited line, breaking Law 2. The structural categories
   now always attach evidence — if nothing stands out, the shortest reply *is* the evidence for a
   low score.

## Still to wire
See `README.md` → "Server + payment wiring TODO". The one structured model call with the schema
loop, **the 50-conversation calibration eval set (the real gate)**, the body-scrub proving test,
jurisdiction-aware crisis links (day one), legal review, then Lemon Squeezy.

## OneDrive safety
Source only — no `node_modules`, no `.next`. `.gitignore` excludes both. All installs and builds
ran in `/tmp`, never in OneDrive. **No keys anywhere in the repo.**
