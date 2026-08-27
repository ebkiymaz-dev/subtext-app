# Subtext — Google Play listing package

Updated: 2026-08-26

This copy is intentionally limited to behavior present in the current release candidate. Do not describe AnswerAce as available in production until its Google Play entitlement and model-provider launch gates pass.

## Console fields

- **App name (30 characters maximum):** Subtext
- **Default language:** English (United States)
- **App or game:** App
- **Free or paid:** Free
- **Category:** Productivity
- **Contact email:** ebkiymaz@gmail.com
- **Website:** https://neonjungletools.com/subtext/
- **Privacy policy:** https://neonjungletools.com/subtext/privacy

## Short description

Paste a chat or screenshot. Separate speakers and see evidence-based readings.

## Full description

Subtext helps you examine the language and structure of a conversation without pretending to know what another person secretly meant.

Paste conversation text, a WhatsApp-style export, or upload a screenshot. Check the detected speakers before analysis, then choose which person you want to focus on in a group conversation.

The free conversation reader runs on your device and shows:

• A concise summary of what stands out
• Clearly separated speakers
• Evidence linked to the original lines
• More than one possible reading, including a charitable alternative
• Plain-language explanations of conversational patterns
• An optional private archive stored only on that device

Subtext accepts names written in many scripts. Screenshot OCR assistance supports English, Chinese, Japanese, and Russian text. The current analysis and guidance are written in English; Subtext is not a translation app.

The Android app also includes optional paid AnswerAce access when available through Google Play. AnswerAce considers the conversation, your stated goal, preferred tone, and anything your reply should protect. It provides editable reply options with reasons and tradeoffs. The free reader remains available without a subscription.

The privacy boundary is clear: standard conversation analysis happens on your device. Nothing is added to the private archive unless you choose to save it. When you deliberately request AnswerAce, the selected conversation and the context you provide are sent securely to the disclosed model provider for that requested analysis. Subtext does not intentionally retain the conversation.

Subtext is not a lie detector, therapist, diagnostic service, or emergency service. It cannot prove intent or guarantee an outcome. It reads language patterns, presents alternatives, and helps you decide what fits your situation.

No account is required for the free reader. No advertising.

## Screenshot order and captions

Use current Android captures only. The existing screenshots dated 2026-08-18 show an obsolete interface and must not be uploaded unchanged.

1. **Paste or upload** — `Paste a chat. Get a clearer read.`
   - Show the empty intake screen with Paste, screenshot upload, sample conversation, and the local-analysis trust line.
2. **Confirm speakers** — `See who said what — clearly.`
   - Show speaker names and colors, including a realistic three-person group example.
3. **Core result** — `Evidence first. No mind-reading.`
   - Show the short result, evidence-strength wording, and at least one alternative reading. Do not show psychological percentages.
4. **Full evidence** — `Trace every reading back to the words.`
   - Show highlighted lines and the expanded evidence section.
5. **Private archive** — `Save privately on this device — or not at all.`
   - Show the optional archive and its local-only explanation.
6. **AnswerAce** — `Optional replies shaped around your goal.`
   - Include only after a real Google Play purchase, entitlement verification, and Coach generation pass on the release candidate. Mark it `Optional paid feature` in the artwork.

Screenshot overlay rules:

- Keep overlay copy under eight words where possible.
- Use the beige Subtext palette and the final square logo.
- Show real shipped screens; do not composite controls that are absent from the app.
- Do not show real personal conversations, phone numbers, profile photos, or contact details.
- Do not imply translation, mind-reading, diagnosis, lie detection, or guaranteed psychological accuracy.

## Release notes

### Next closed-test release

```text
<en-US>
Improves the mobile reading flow, speaker confirmation, group-chat handling, evidence-based explanations, private local archive, and optional AnswerAce purchase and restore paths. Core conversation analysis remains free and runs on your device.
</en-US>
```

### First production release

```text
<en-US>
First public release of Subtext: paste a conversation or upload a screenshot, confirm the speakers, and review evidence-based readings and alternatives. Includes an optional private local archive and optional paid AnswerAce on supported Android devices.
</en-US>
```

Use the production notes only after AnswerAce passes its production gate. If AnswerAce is not enabled at submission time, remove the final clause beginning `and optional paid AnswerAce`.

## Reviewer note

Subtext is a Trusted Web Activity for the developer-owned app at `https://neonjungletools.com/subtext/`. No account is required. Reviewers can choose the included sample conversation instead of entering personal text. The free reader runs locally in the browser. Multilingual speaker names and OCR-assisted English, Chinese, Japanese, and Russian screenshot text are supported, but analysis is currently written in English. Group conversations allow the reviewer to confirm participants and choose a focus person. Acute-distress language replaces interpretation with a safety-oriented care path.

If AnswerAce is enabled for review, provide an active Google Play license-test account and exact purchase/restore instructions in App access. If it is not enabled, do not ask the reviewer to test or accept claims about the paid feature.

## App-content answers

- **Contains ads:** No.
- **App access:** No login is required for the free reader. If paid Coach review requires a licensed test account, disclose that under App access.
- **Target audience:** Adults, 18 and over. The app is not directed to children.
- **News app:** No.
- **Government app:** No.
- **Financial features:** None.
- **Health features:** None. Subtext is not medical, diagnostic, therapeutic, mental-health, or emergency software.
- **User-generated content:** Users enter private text for local analysis. There is no public posting, messaging, or community.
- **Permissions:** Reconfirm against the final Android manifest before submission; do not copy this answer from an earlier build.

## Data-safety working draft

Answer from the final deployed behavior and vendor contracts, not this draft alone.

- **Does the app collect or share user data?** Answer conservatively. Standard analysis remains on-device, but selected conversation text leaves the device when a user deliberately requests AnswerAce.
- **Other user-generated content:** Optional for AnswerAce; purpose: app functionality; encrypted in transit; Subtext does not intentionally retain it. Confirm whether Google treats the model provider as collection, sharing, or a service provider under the current Data Safety definitions.
- **Diagnostics/security:** Declare any hosting, fraud-prevention, billing, or server logs actually retained in production.
- **Purchase data:** Google Play handles payment details. The Subtext server receives purchase proof for entitlement verification; declare it if required by the final implementation and Google policy.
- **Device or other IDs:** Do not declare “none” if launch analytics introduces a persistent installation identifier.
- **Account creation:** None for the free reader. The private profile is local and is not a Subtext account.
- **Data deletion:** Users can delete locally archived data inside the app or clear app storage. Reconfirm the support email and provider-side deletion/retention terms before submission.
- **Encryption in transit:** HTTPS; verify on the final production path.
- **Independent security review:** No, unless one is completed and documented before submission.

## Asset and launch gates

- Final icon: `store-assets/app-icon-512.png`.
- Feature graphic: refresh if it does not match the final beige brand and shipped value proposition.
- Replace all screenshots dated 2026-08-18 with captures from the final release candidate.
- Rebuild the signed AAB after final icon or runtime changes; do not assume the older v6 bundle contains later assets.
- Do not publish Coach claims until production model configuration, server-side Google Play verification, real purchase/restore tests, and the human safety evaluation pass.
- Do not claim multilingual analysis. Current analysis is English; multilingual support applies to speaker names and OCR assistance.
