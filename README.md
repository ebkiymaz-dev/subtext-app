# Subtext — mock build

> ## 2026-07-28 — re-skinned, and moved to a path URL
>
> **Serves at `https://neonjungletools.com/subtext/`**, not on a subdomain.
> `next.config.mjs` sets `basePath: "/subtext"`, so **`/` on :3103 is a 404** —
> the app answers on `/subtext/`. `subtext.neonjungletools.com` 301s to it.
> Hand-built URLs (service worker, manifest, raw `fetch`) go through
> `BASE_PATH` in `lib/basePath.ts`.
>
> **Brand: elegant.** Playfair Display · Inter · Pinyon Script, via
> `lib/fonts.ts`. **Pinyon Script is ornament only** — the header wordmark and
> nothing else; it fails at small sizes. Warm ink `#1F1D1A`, cream `#FAF7F2`,
> gold `#B08D3F`. The accent token was renamed `sbt-coral` → `sbt-gold`.
>
> ⚠ **Gold is a dark-ground colour.** On cream use `sbt-gold-700` (`#836524`),
> not `sbt-gold` (2.9:1).
>
> ⚠ The real Subtext logo has **not** been integrated — the supplied
> `Subtext_logo.png` is a screenshot of a Gmail inbox. The header is set
> typographically meanwhile (script "Sub" + serif "text").
>
> Full context: `Neon Jungle Tools/reports/DOMAIN_DEPLOY_2026-07-28_REBRAND.md`.


**Grammarly for conversations.** Paste a conversation → a category panel of confidence
percentages, the exact lines behind each one highlighted inline, and 3–5 competing readings that
always include the kindest one.

**Possibilities, never verdicts. Confidence, never fact.**

This build runs **entirely in mock mode**: no model key, no server, no account, no spend.

---

## Run it

```bash
cd subtext-app
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

> **Build note:** `next/font` downloads Spectral and Inter at *build time*, so the build machine
> needs access to `fonts.googleapis.com`. It is all in `lib/fonts.ts` — swap that one file for
> `next/font/local` if you build offline.

---

## The flow it demonstrates

1. **Intake** — paste a conversation (WhatsApp export, `Name: message` lines, or plain alternating
   lines), answer "which one is you?", pick a context chip (Dating / Work / Family / Friendship).
2. **The crisis-safety screen runs first** — before parsing effort, before any spend. See below.
3. **Analysis** — the category panel animates in: each category has a percentage, a calm
   sequential fill, a one-line read, its evidence count, and its caveat.
4. **Bidirectional highlight** — click a category and its driving lines light up coral inline in
   the transcript; hover a highlighted line and the panel focuses that category. This is the
   Grammarly mechanic, retargeted from grammar to subtext.
5. **Competing readings** — 3–5 weighted interpretations summing to 100, none above 60%, exactly
   one flagged as the most-charitable read (teal), each with a suggested next message.
6. **What wasn't said** — the absences, which are often the signal.
7. **Coach (Premium)** — 2–4 option-framed suggestions, blurred on Free.
8. **Free counter** — 3 analyses/month, then the Premium $8.99 gate. Mock checkout.

Four seeded showcase conversations ship with the app: the slow fade, the terse boss, the family
ask, and — deliberately last — the 2am message.

---

## The crisis-safety rule (hard, non-negotiable)

`lib/engine/distress.ts` runs **before** anything else. If the text carries acute self-harm or
suicidality markers, the app **does not analyse the conversation**. The entire surface is replaced
by a supportive resource card: 988, Crisis Text Line, Samaritans, findahelpline. No percentages, no
interpretations, no paywall, **and the free counter is not ticked** — a person in distress is not a
product use.

It is deliberately tuned to **over-trigger**: a false positive costs one dismissible screen, a false
negative is unacceptable. Verified 6/6 on the built-in cases (three that must trigger, two that must
not, one inside a transcript).

---

## The seven legitimacy laws

Encoded in `lib/legitimacy.ts`, including a **banned-lexicon check** (`checkLexicon`) — "is lying",
"lie detector", "has trauma", "narcissist", "definitely", "proves that" and friends are forbidden
output, not softened output. Every category read, caveat and interpretation in the app currently
passes it with **zero violations**.

A consequence you can see in the UI: scores are capped below certainty (92%), because 100%
confidence in a read of someone's text is never honest.

---

## What is real and what is mocked

| Real and local | Mocked |
|---|---|
| Segmentation (three paste formats) | The categories marked "inferred" |
| **The distress screen** | The interpretation prose |
| Every deterministic category: engagement, power/balance, reciprocity, investment, formal register | |
| All evidence extraction — the verbatim spans behind every score | |
| The interpretation schema: 3–5 reads, none >60%, summing to exactly 100, exactly one charitable | |
| The free counter, the paywall, the banned-lexicon check | |

In a live build, only the `inferred` scores and the prose come from **one structured model call per
analysis**. Steps 1–3 stay on-device forever — which is what makes "your conversation never touches
our server" literally true rather than a marketing line.

**Nothing but a month key and a count is ever persisted.** No raw text, no per-person profiles,
no history of who you analysed. That refusal is the moat, not a missing feature.

---

## Server + payment wiring TODO

### The model call
- [ ] `POST /api/analyze` — takes the deterministic metrics + the transcript, returns the inferred category scores and interpretations against a **strict schema**.
- [ ] Schema loop: reject and retry if fewer than 3 interpretations, if any single one exceeds ~60%, or if any score arrives without a cited evidence line.
- [ ] Corroborate the model against the deterministic signals — **on disagreement the lower-confidence honest read wins** (Law 6).
- [ ] Run the banned-lexicon check over model output too, not just static strings. Make it build-failing in CI.
- [ ] Build the **50-conversation calibration eval set** — this is the real gate. Without it you cannot tell a good prompt from a sycophantic one. Re-run it on every prompt change.
- [ ] Set `NEXT_PUBLIC_LLM_MODE=live`.

### Privacy (the central promise — verify, don't assume)
- [ ] **Body-scrub proving test:** conversation text must never reach a log line, an error tracker, or an analytics payload. Allowlist-based scrubbing, and a test that fails the build if raw text escapes.
- [ ] Keep the distress screen client-side. It must fire before anything leaves the device.
- [ ] Jurisdiction-aware crisis links (detect locale → local helpline) — **day one, not later**.

### Backend
- [ ] Supabase for auth + the entitlement row only. **Do not add a conversations table.** The impoverished data model is the product.
- [ ] Move the usage counter server-side so the cap cannot be cleared by wiping local storage.

### Payments
- [ ] Lemon Squeezy store: Premium monthly ($8.99), Premium annual ($47.88), Work ($14.99).
- [ ] `POST /api/checkout` → hosted URL; `POST /api/webhooks/lemon` → **HMAC-verified**, writes the entitlement server-side.
- [ ] Set `NEXT_PUBLIC_BILLING_MODE=lemonsqueezy`.

### Before store submission
- [ ] **Legal review** — message analysis, app-store policy, and the distress path.
- [ ] Then, and only then, the Expo native shell for the share-sheet + OCR.

**No keys exist anywhere in this repo.** Every mode flag defaults to mock.
