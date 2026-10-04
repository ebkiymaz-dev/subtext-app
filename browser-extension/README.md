# Subtext Conversation Assist — testing preview

Updated 7 September: access is now through the pinned browser-toolbar icon, with tooltip **Use Subtext to analyze text**. No floating button or panel is injected while idle. Click the toolbar icon to open/close the panel.

Not published to Chrome Web Store or rolled out to production.

Build: `npm run build:extension`. In a dedicated Chrome/Edge test profile, open the browser's Extensions page, enable Developer mode, choose Load unpacked, and select this directory's `dist` folder. Reload an already-open supported site. Do not upload the Android APK to the extension store.

Pin Subtext from the browser's Extensions menu, then click its toolbar icon. The extension reads only the visible conversation or the text you selected. Review the text, choose the speakers and context, then run the local read. AnswerAce is separate, requires provider disclosure and consent, and never sends a message automatically. Unsaved text remains in the isolated panel's memory and is removed when it closes.

## Current coverage

- WhatsApp Web: explicit sender metadata; consecutive messages retain their author. Verified against synthetic HTML, not yet an authenticated live account.
- Gmail: one visible email body; choose single email/post mode. Several open emails are never silently combined.
- Instagram DMs, Messenger, Facebook messages, Outlook: a single visible semantic conversation log where present; otherwise select the text before opening Subtext. These site-specific adapters require live acceptance testing before advertising universal one-tap scanning.
- Separate Windows desktop applications are not supported by a browser extension.

## AnswerAce

Three successful free generations per UTC month per installation. The API, not local storage, enforces the allowance. Android Play subscribers can use their existing purchase proof in the Android panel. A PC subscription/account-linking flow is **not implemented**; do not market cross-device paid access yet.

The live service currently reports the provider disabled pending data-terms confirmation. The new allowance migration and API must also be deployed before the free quota works live. Local reading does not need the provider.

## Tests

`npm run test:companion` checks identity signature/expiry/fail-closed behavior. `scripts/companion-browser-test.mjs` uses Playwright in a separate Chromium profile, synthetic messages and mocked network responses. Supply `SUBTEXT_TEST_RUNTIME` pointing to a node_modules directory containing Playwright and `PLAYWRIGHT_BROWSERS_PATH` for the installed test browser. It does not test live Gemini quality or real social accounts.

Before public release: authenticated site tests, Android permission/rotation/protected-screen/keyboard/back-button tests, provider/account setup, paid entitlement tests, privacy/store disclosures and an independent security review.
