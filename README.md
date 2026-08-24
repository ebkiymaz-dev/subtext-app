# Subtext

> ## 2026-08-24 — commercial Coach architecture
>
> The free reader remains on-device. Paid Answer Coach is now a separate,
> goal-led structured model request with server-side Google Play entitlement
> verification, rate limiting, verbatim quote validation, competing readings,
> user-accountability analysis, and three meaningfully different editable
> replies. The consumer UI no longer presents psychological-looking
> percentages; evidence is weak, moderate, or strong with supporting moments.
> Result detail is collapsed behind progressive disclosure, and progress counts
> only when the user explicitly finishes a read—there are no streaks.
>
> Commercial deployment requires `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` plus one
> configured model provider. Without both, Coach fails closed and no
> conversation is sent.

> ## 2026-07-29 — historical engine-v2 note (superseded above)
>
> **The free tier got a new brain.** `lib/engine/signals.ts` reads conversational
> **moves** instead of counting words: bids for connection and whether each was
> met, the **register gap** between the two speakers ("thank you" vs "thanks"),
> closing moves vs continuation bids, what was not reciprocated, style matching,
> where the enthusiasm markers land, and reply latency. See §**Engine v2**.
>
> The legacy Deep Read route described in older notes below has been removed.
> Personalized paid coaching now uses only `POST /api/answer-coach`, with
> explicit consent and server-verified Google Play entitlement.
>
> **`npm run eval`** is the quality gate — 10 conversations with declared
> expectations, including the crisis invariant and a **spread** assertion that
> fails the run if the engine answers the same thing to different conversations.
> That assertion is what v1 would have failed.
>
> Full write-up: `STATUS.md`.

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

**Two tiers, labelled honestly wherever they appear:**

| | |
|---|---|
| **On-device (free)** | The whole panel, the headline, the evidence, the competing readings, the crisis screen. Runs in your browser. Nothing leaves the machine. No key, no server, no spend. |
| **AI-assisted (Premium)** | One structured server-side model call, opt-in per analysis, behind a consent line that appears **before** the button. This is the only part of Subtext that sends text anywhere. |

---

## Run it

```bash
cd subtext-app
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run typecheck    # tsc --noEmit
npm run eval         # the quality gate — 10 conversations, assertions, spread check
npm run eval:deep    # …plus the AI tier, against a running dev server
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
3. **Analysis** — the category panel shows plain-language evidence strength, a one-line read,
   its evidence count, and its caveat.
4. **Bidirectional highlight** — click a category and its driving lines light up coral inline in
   the transcript; hover a highlighted line and the panel focuses that category. This is the
   Grammarly mechanic, retargeted from grammar to subtext.
5. **Competing readings** — a most-supported interpretation plus a plausible alternative,
   both tied to evidence rather than pseudo-precise percentages.
6. **What wasn't said** — the absences, which are often the signal.
7. **Answer Coach (Premium)** — explicit opt-in personalized coaching based on the user's goal,
   desired tone and stakes, with three editable reply options and trade-offs.
8. **Healthy completion** — a read counts only after the user explicitly marks it done; there are
   no streaks, anxiety loops or recheck rewards.

Five seeded showcase conversations ship with the app: **two lines** (a compliment and a polite
goodbye — the clearest demonstration of what v2 does that a word-counter cannot), the slow fade,
the terse boss, the family ask, and — deliberately last — the 2am message.

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

## Engine v2 — what the free tier actually reads

v1 counted things: reply length, question marks, lexicon hits. That is why it answered *about 49%*
to almost every conversation. v2 reads **moves** — what a turn did to the one before it.

`lib/engine/signals.ts` extracts, all on-device:

- **Bids and responses (Gottman).** A bid is any turn inviting connection — a compliment, an
  expression of affection, an invitation, a disclosure, a question, shared news, a request. Each
  reply is classified **toward / minimal / away / against**.
  **`minimal` is the class that matters**: acknowledged and not extended. Polite, correct, closed.
  It is where almost all real-world hurt lives, because it looks identical to warmth to anything
  counting sentiment words.
- **Register asymmetry.** Per-turn formality, and the **gap** between the two speakers. "thank you"
  and "thanks" mean the same thing and do different work; so do "good night" and "night". Answering
  an intimate register in a formal one is one of the quieter ways distance appears in text.
- **Closing vs continuing.** Sign-offs and stated exits against continuation bids, weighted toward
  the final turns — plus **mutual close**, because both people saying "see you then" is a finished
  conversation, not a withdrawal.
- **Substantive word count.** Words left once politeness and sign-offs are stripped.
  `"thank you, good night!"` → **0**.
- **Uptake.** Toward/away applied to every turn, not just bids — two people agreeing a time make no
  bids at all and are perfectly engaged.
- **Reciprocation.** Was the compliment returned, the disclosure matched, the question asked back.
- **Style matching (LSM).** Ireland & Pennebaker's method across nine function-word families.
  **Not reported at all below 25 words a side** — a metric that cannot be supported is hidden,
  not hedged.
- **Enthusiasm placement.** An exclamation mark on a sign-off is politeness; the same mark on the
  content is warmth. Position is the only thing that tells them apart.
- **Reply latency**, from WhatsApp timestamps, when the paste carried them.
- **Longest unanswered run** — so the engine can see *you* piling on. An instrument that can only
  find fault with the other person is a flattery machine.

**Calibration.** No blanket softener. Categorical signals are not shrunk (a sign-off is a sign-off
in two lines or two hundred); rate signals are shrunk by sample weight and suppressed below their
support threshold. The 92% ceiling stays. **Percentages do not sum to 100** — they are independent
readings of independent questions.

---

## Answer Coach (Premium) — goal-led and purchase verified

`POST /api/answer-coach` is server-only, rate-limited and requires a live Google Play entitlement.

**The order is the safety guarantee:**

1. **Crisis screen, server-side**, on the raw text, before anything else — the client already ran
   it, and running it again means a stale or tampered client still cannot get a distressed message
   to a model. Returns the resource path and spends nothing.
2. Google Play verifies package, product, purchase state and expiry server-side.
3. One structured call. Gemini uses its native endpoint; Groq / OpenAI / Ollama share the
   chat-completions path.
4. **Validation.** This is the product:
   - **Grounding** — every quote must appear verbatim in the pasted text. A quote that does not
     match is deleted, and a claim that loses its last quote is deleted with it. This is the one
     check that stops the model inventing evidence, which is the thing it most wants to do.
   - **Schema** — summary, recommended approach, competing readings, user contribution, three
     distinct editable replies with reasons and trade-offs, and an uncertainty label.
   - **Lexicon** — the banned-phrase list applied to every rendered string.
5. Invalid output fails closed. Missing coaching is a smaller problem than a fluent invented one.

**Provider seam:** `resolveCoachProvider()` in `lib/providers.ts`.
Model ladder `gemini-3.6-flash` → `gemini-flash-latest` → `gemini-2.0-flash`, walking past 404/503
because Google retires ids out from under a pinned name. Set `GEMINI_API_KEY` **server-side** — a
key in a `NEXT_PUBLIC_` variable is a published key.

---

## What is on-device and what is AI

| On-device, always (free) | AI-assisted (Premium, opt-in per analysis) |
|---|---|
| Segmentation (paste, export and screenshot formats) | Goal-led response coaching |
| **The crisis screen** | Multiple possible readings and user-accountability check |
| Every evidence-strength category, from the signal layer | Three editable replies with trade-offs |
| The headline, competing readings and "what wasn't said" | |
| All evidence extraction — verbatim supporting spans | |
| The interpretation schema and the banned-lexicon check | |
| The free counter and the paywall | |

**Nothing but a month key and a count is ever persisted.** No raw text, no per-person profiles,
no history of who you analysed. That refusal is the moat, not a missing feature.

---

## Server + payment wiring TODO

### The model call
- [x] `POST /api/answer-coach` — server-side, one structured call, schema-constrained.
- [x] Schema enforced in code: grounded summary, alternative readings, user contribution and three distinct replies.
- [x] Grounding check — every quote validated character-for-character against the input; unsupported claims deleted.
- [x] Banned-lexicon check applied to model output, not just static strings.
- [x] Crisis screen runs server-side **before** the call as well as client-side.
- [x] Calibration eval set started — `npm run eval`, 10 cases, with a **spread** assertion.
- [ ] Grow it to the **50 conversations** `DESIGN_BUILD.md` names as the real go-live gate. Re-run on every prompt change.
- [ ] Spot-check the configured production model on the deployment before promoting beyond internal testing.
- [ ] Corroboration rule (Law 6): on disagreement between the model and the on-device signals, surface the lower-confidence honest read. Currently both are shown side by side and labelled.

### Privacy (the central promise — verify, don't assume)
- [ ] **Body-scrub proving test:** conversation text must never reach a log line, an error tracker, or an analytics payload. Add a test that fails the build if raw text escapes.
- [x] Distress screen runs client-side before anything leaves the device, **and** server-side before the model call.
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
