# SUBTEXT — STATUS

**Latest:** 2026-07-29 · **engine v2 + a real LLM tier** · INNOVATOR (Opus) under MAESTRO · for mert
**Previous:** 2026-07-27 mock build · 2026-07-28 rebrand + path deploy

---

## 2026-07-29 — the brain, rewritten

### Why
mert tested the shipped build with a real two-line exchange:

```
You:  You looked amazing today
Them: thank you, good night!
```

v1 answered **Engagement 49% · Power 49% · Reciprocity 34%** and a generic paragraph. The verdict
was "the result could have been better — make Subtext's brain run deeper and more psychological",
and it was correct. v1 counted things: reply length, question marks, lexicon hits. Counting is why
it answered *about 49%* to almost everything. A conversation is not a bag of words; it is a
sequence of **moves**.

### What v2 reads instead

New module `lib/engine/signals.ts` sits between segmentation and scoring and extracts:

| Signal | What it catches |
|---|---|
| **Bids & responses** (Gottman) | bid detection by kind — compliment, affection, invitation, self-disclosure, question, news, request — then each reply classified **toward / minimal / away / against** |
| **`minimal`** | the fourth class the original frame folds into "toward". Acknowledged and *not* extended. This is where nearly all real-world hurt lives, because it looks identical to warmth to anything counting sentiment words |
| **Register asymmetry** | per-turn formality 0–1, and the **gap** between the two speakers. "thank you" vs "thanks", "good night" vs "night" — the same act at two social distances |
| **Closing vs continuing** | sign-offs and exits versus continuation bids, weighted toward the final turns; plus **mutual close** (both sides sign off = a finished conversation, not a withdrawal) |
| **Substantive word count** | words remaining once politeness and sign-offs are stripped. `"thank you, good night!"` → **0** |
| **Uptake rate** | toward/away applied to *every* turn, not just bids — because two people agreeing a time make no bids and are perfectly engaged |
| **Reciprocation** | was the compliment returned, the disclosure matched, the question asked back |
| **Style matching (LSM)** | Ireland & Pennebaker's method over nine function-word families. **Suppressed entirely below 25 words a side** rather than reported with a shrug |
| **Enthusiasm placement** | an exclamation mark on a sign-off is politeness; the same mark on the content is warmth. Position is the only thing that separates them |
| **Second-person reference** | measured after fixed politeness phrases are stripped, so "thank you" stops scoring as attentiveness |
| **Reply latency** | median per side, from WhatsApp timestamps, when the paste carried them |
| **Longest unanswered run** | so the engine can see **the user** piling on. An instrument that can only find fault with the other person is a flattery machine |

### New categories
`Closing vs continuing` · `Warmth vs distance` · `Bids met` · `Style matching`.
Rebuilt from signals: `Engagement`, `Reciprocity`, `Who is steering`, `How much is unsaid`,
`Formula over content`, `Investment signals`.

### Calibration
The v1 blanket `× 0.86` softener is gone. In its place:
**categorical signals are not shrunk** (a sign-off is a sign-off in two lines or two hundred);
**rate signals are shrunk by sample weight and suppressed below their support threshold**. The 92%
honesty ceiling stays. Percentages are independent readings and **do not sum to 100**.

### mert's example, now

> **A compliment was answered with a politeness token and a sign-off. Warm on the surface, closed
> underneath — and the closing is the part that carries information.**

| | |
|---|---|
| Closing vs continuing | **91%** — "good night!" is a sign-off, not a reply that expects one back |
| Warmth vs distance | **78%** — "thank you" rather than "thanks", "good night" rather than "night" |
| How much is unsaid | **65%** |
| Who is steering | **57%** — they decided when it stopped |
| Formula over content | **55%** — the whole reply is courtesy formula, 0 substantive words |
| Bids met | **30%** — one compliment, acknowledged and closed |
| Engagement | **25%** (was 49) |
| Reciprocity | **15%** (was 34) |

Competing readings: *They were going to bed* **37% (charitable)** · *The politeness is doing the
work of a step back* **34%** · *There genuinely isn't much here to read* **29%**.

---

## The LLM tier — now real

`POST /api/deep-read` · server-only · **one** call per analysis.

- **Provider seam** `resolveDeepProvider()` in `lib/providers.ts`, mirroring `nj_providers/llm.py`.
  **Gemini** uses the native endpoint because it is the only free option that enforces a response
  **schema**; Groq / OpenAI / Ollama go through the shared chat-completions path. The model ladder
  walks past 404/503, because Google retires ids out from under a pinned name.
- **Model:** `gemini-3.6-flash` → `gemini-flash-latest` → `gemini-2.0-flash`. Temperature **0.15**.
- **Order is the safety guarantee:** crisis screen (server-side, again) → segment → signals →
  one call → validate → **at most one repair retry** → honest failure.
- **The validator is the product.** Every quote is checked character-for-character against the
  paste; a claim that loses its last quote is deleted. Schema rules (3–5 readings, ≤60% each,
  exactly one charitable, weights renormalised to 100) are enforced **in code**, not requested.
  The banned lexicon applies to every rendered string. Repairs are **shown to the user**.
- **Privacy, stated before the button, not after.** This is the only part of Subtext that sends
  text off the device. The UI says so and the button is a deliberate press.

### Verified (sandbox, Node 22, next 14.2.35)
| Case | Result |
|---|---|
| No provider configured | honest refusal, on-device analysis unaffected |
| **Crisis text with a provider live** | **blocked server-side, zero model spend** |
| Well-formed model answer | validated and rendered |
| Model invents quotes | **rejected**, itemised repairs returned |
| Model uses banned phrasing | **rejected** |

**Not verified live:** the Gemini wire format specifically — this sandbox's proxy blocks
`googleapis.com`. The endpoint shape and model ladder are copied from the call-verified Python
implementation in `nj_providers/llm.py` (verified against the live API 2026-07-29). The first real
call should be spot-checked on the deployment box.

---

## The quality gate — `npm run eval`

`lib/evalSet.ts` — 10 cases with declared expectations. `npm run eval` fails on any violation.
Compiles standalone via `tsconfig.eval.json`; the engine has zero runtime dependencies on purpose,
so the gate is cheap enough to actually run on every change.

Three tiers of check, ascending in importance:
1. per-case ranges and required/forbidden phrases
2. **the crisis invariant** — every distress case must produce no analysis object at all
3. **spread** — the same category must not answer near-identically across different conversations.
   *This is the assertion that would have caught v1.*

```
engagement:       25, 79, 19, 71, 14, 58, 76, 0    range 79, sd 29.5   ok
closure:          91,  0,  5,  0, 76, 81,  0, 0    range 91, sd 39.8   ok
warmth_distance:  78, 12, 28,  4, 33, 20, 20, 16   range 74, sd 21.2   ok
bid_response:     30, 92, 13, 92, 11, 92,  5       range 87, sd 38.9   ok
reciprocity:      15, 92,  0,  0,  0, 50, 70, 0    range 92, sd 34.7   ok

All assertions passed.
```

Two cases exist specifically to stop the engine finding menace everywhere:
`ordinary-logistics` (nothing is happening, and the engine must say so) and `over-texting`
(the user is the one pushing, and the engine must say **that**). Both caught real bugs.

### Bugs the eval caught and fixed
1. A healthy logistics exchange scored **44% engagement** because it contained no bids and no
   questions. Fixed by adding **uptake**, and by splitting engagement into a base (bids met, turns
   taken up, words invested) and a **bonus** (asking back, second-person reference) — the absence
   of the second proves nothing.
2. `"this week is insane"` counted as a **future commitment**, so a slow fade read as investment.
   Fixed with a `FUTURE_ANCHOR` lexicon that requires a real point in time, plus damping by closure.
3. Reciprocity measured *their share* of questions, so one side asking everything scored **92%**.
   It now measures **balance**.
4. A mutual `"see you then"` / `"see you then"` read as one-sided withdrawal.
5. The work sample got the dating fade headline. Headlines are now context-gated.
6. A reading asserted "questions were raised and not engaged with" about an exchange containing
   **no questions**. Gate tightened — a reading that describes something that did not happen is
   worse than no reading.
7. Four categories could score above the render threshold with **no evidence line** (Law 2). Each
   now names the turn its structure was computed from, and the filter drops anything that still
   cannot cite.

---

## Verification, this pass
- `tsc --noEmit` — **clean, 0 errors.**
- `next build` — **succeeds, 5 routes** (`/`, `/plans`, `/api/capabilities`, `/api/deep-read`,
  `_not-found`). 129 kB first load on the main route.
- `npm run eval` — **all assertions pass**, spread healthy.
- Banned lexicon — **0 violations** across every rendered string in all 8 analysable cases.
- Crisis screen — **2/2 distress cases stop the app**, including one buried mid-thread; **0 false
  positives** across the 8 ordinary cases; the free counter is not ticked.
- **Honest caveat:** the sandbox blocks `fonts.googleapis.com`, so `next build` was run with
  `lib/fonts.ts` stubbed *in the sandbox copy only*. The committed file is the real one and is the
  only unverified piece of the build.

---

## Still to do
- **Deployment not rebuilt by this pass.** `%LOCALAPPDATA%\njt-build` is a Windows path and the
  rebuild is a `.bat`; neither is reachable from this Linux sandbox. Run
  `Neon Jungle Tools/deploy/01_build_and_install.bat` and restart the service to serve v2 at
  `neonjungletools.com/subtext/`.
- **`GEMINI_API_KEY` must be present in the server environment** for the deep read. Confirm the
  deployment's service environment picks up `.env.local`.
- Spot-check one live Gemini call and confirm the ladder lands on a working model.
- Grow the eval set toward the 50 conversations `DESIGN_BUILD.md` names as the real go-live gate.
- Jurisdiction-aware crisis links · body-scrub proving test · legal review · Lemon Squeezy.

## OneDrive safety
Source only — no `node_modules`, no `.next`, no `.eval-out`. All installs and builds ran in `/tmp`,
never in OneDrive. **No keys in the repo**; `.env` and `.env*.local` are gitignored.
