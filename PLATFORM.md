# SUBTEXT — platform decision

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


**Decision: one responsive PWA — desktop is the Grammarly-style paste-and-analyze surface, mobile
is the same app with the paste path. Native (Expo) is a later step, deliberately not built tonight.**

**Reasoning (one line):** the moment of need is on a phone holding the message, but the *mechanic*
(transcript on one side, category panel on the other, bidirectional highlight between them) is
identical on both — so one responsive PWA serves both, validates willingness-to-pay without a
two-week store review, and keeps the "your text never leaves your device" promise literally true.

## What that means concretely
| Viewport | Layout |
|---|---|
| ≥1024px | Two columns: transcript surface left with inline coral evidence highlights, category panel + interpretations + Coach in the right rail. Click a category → its lines light up. Hover a highlighted line → the panel focuses that category. |
| <1024px | Single column, **panel first** (it is the headline), transcript below. Same highlight link, tap-driven. |

## Deferred to native v2 — noted, not built
- **Share-sheet target** ("Share to Subtext") accepting a WhatsApp / Telegram / Discord **chat export**. This is the only genuinely clean "connection" that exists.
- **Screenshot → on-device OCR**, because people screenshot texts, they don't copy them.

Both are *acquisition* features, not capability features. The honest position, stated in the UI:
**there is no API that lets a third party read your personal DMs** — not iMessage, not WhatsApp
personal chats, not Instagram. Android notification-listener scraping *could* technically work and
is explicitly out of scope: it is invasive, brittle, against store policy, and hostile to the
no-surveillance promise that is this product's moat.

**Consequence:** paste is not a fallback. It is the design.
