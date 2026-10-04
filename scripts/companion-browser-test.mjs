import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir } from "node:fs/promises";
import path from "node:path";

const requireRuntime = createRequire(path.join(process.env.SUBTEXT_TEST_RUNTIME, "package.json"));
const { chromium } = requireRuntime("playwright");
await mkdir(".eval-out", { recursive: true });
const profile = await mkdtemp(path.resolve(".eval-out/companion-browser-"));
const extension = path.resolve("browser-extension/dist");
const context = await chromium.launchPersistentContext(profile, { headless: true, channel: "chromium", viewport: { width: 1365, height: 900 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
const errors = [];
let cloudRequests = 0;
const fixture = `<!doctype html><html><body><main id="main">
<div data-pre-plain-text="[10:01, 07/09/2026] Alex: ">I enjoyed talking yesterday. Would you like to meet for a coffee on Saturday? I can come around eleven if that works for you.</div>
<div data-pre-plain-text="[10:02, 07/09/2026] Alex: ">No rush to answer. Let me know when you have checked your plans.</div>
<div data-pre-plain-text="[10:03, 07/09/2026] Sam: ">Thank you for asking! Saturday sounds good. I will check my schedule tonight and confirm the time tomorrow morning.</div>
<div hidden data-pre-plain-text="[10:04, 07/09/2026] Hidden: ">HIDDEN_PRIVATE_HISTORY</div>
</main></body></html>`;
try {
  await context.route("**/*", async route => {
    const url = route.request().url();
    if (url.startsWith("chrome-extension://")) return route.continue();
    if (url.startsWith("https://web.whatsapp.com/")) return route.fulfill({ contentType: "text/html", body: fixture });
    if (url.includes("/api/capabilities")) return route.fulfill({ json: { coachProvider: { configured: true, label: "Test-only provider", privacy: "Synthetic test; no external generation." } } });
    if (url.includes("/api/answer-ace-session")) return route.fulfill({ json: { ok: true, token: "test-session", remaining: 3 } });
    if (url.includes("/api/answer-coach")) { cloudRequests++; return route.fulfill({ status: 429, json: { ok: false, reason: "Synthetic allowance exhausted" } }); }
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") console.error("BROWSER", message.text()); });
  await page.goto("https://web.whatsapp.com/");
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  // No idle floating control, panel or cloud request before toolbar dispatch.
  assert.equal(page.frames().filter(frame => frame.url().includes("panel.html")).length, 0);
  assert.equal(await page.locator("html > div").count(), 0, "no idle injected host, including closed-shadow controls");
  assert.equal(cloudRequests, 0);
  assert.equal(await page.getByRole("button", { name: /Subtext/ }).count(), 0);
  assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().action.default_title), "Use Subtext to analyze text");
  assert.equal(await worker.evaluate(() => chrome.action.onClicked.hasListeners()), true);
  const framePromise = page.waitForEvent("framenavigated", { predicate: frame => frame.url().includes("panel.html") });
  // Headless Chromium has no clickable toolbar chrome: exercise its private dispatch.
  await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    await chrome.tabs.sendMessage(tabs[0].id, { type: "SUBTEXT_OPEN" }, { frameId: 0 });
  });
  const panel = await framePromise;
  await panel.waitForSelector("textarea");
  await panel.waitForFunction(() => document.querySelector("textarea")?.value.includes("Saturday"));
  const captured = await panel.locator("textarea").inputValue();
  assert(!captured.includes("HIDDEN_PRIVATE_HISTORY"));
  assert.equal((captured.match(/Alex:/g) || []).length, 2);
  await panel.getByLabel("Your name").selectOption("Alex");
  await panel.getByLabel("Reading whose side?").selectOption("Sam");
  await panel.getByLabel("I checked the text and speakers.").check();
  await panel.getByLabel("The message text is English").check();
  await panel.getByRole("button", { name: "Read this conversation · Free" }).click();
  await panel.getByRole("heading", { name: "Your short read" }).waitFor();
  assert.equal(cloudRequests, 0);
  assert(await panel.getByRole("button", { name: "Generate my AnswerAce replies" }).isDisabled());
  await panel.getByLabel(/Send this reviewed text/).check();
  await panel.getByRole("button", { name: "Generate my AnswerAce replies" }).click();
  await panel.getByText("Synthetic allowance exhausted").waitFor();
  assert.equal(cloudRequests, 1);
  // Closing removes the frame/transcript, not the host chat.
  await page.screenshot({ path: "../FOUNDRY/reports/subtext-companion-browser.png" });
  await panel.getByRole("button", { name: "Close Subtext panel" }).click();
  await page.waitForFunction(() => !document.querySelector("html > div"));
  assert.equal(await page.locator("#main").count(), 1);
  assert.deepEqual(errors, []);
  console.log(`PASS: real extension capture, consecutive speakers, hidden-text exclusion, local read, consent gate, optional cloud action, error recovery, close; worker ${new URL(worker.url()).host}`);
} catch (error) {
  console.error("Page errors:", errors);
  for (const page of context.pages()) for (const frame of page.frames()) console.error("FRAME", frame.url(), await frame.locator("body").innerText().catch(() => "unavailable"));
  throw error;
} finally { await context.close(); }
