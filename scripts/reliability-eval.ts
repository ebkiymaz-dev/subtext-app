import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchWithTimeout, type FetchImplementation } from "../lib/server/boundedFetch";
import { MemoryRateLimitStore, runSingleFlight } from "../lib/server/requestControl";
import { analyze } from "../lib/engine/analyze";
import { readArchive, saveArchivedConversation, deleteArchivedConversation, type LocalProfile } from "../lib/archive";
import { keepActiveRead, readActiveRead, clearActiveRead } from "../lib/active-read";
import { COACH_MODEL_TIMEOUT_MS, COACH_CLIENT_TIMEOUT_MS, COACH_LEASE_SECONDS } from "../lib/coach-budget";

function verifyArchiveAndOrdinaryRead(): void {
  const raw = "Alex: Are we still meeting tomorrow?\nSam: Yes, noon works for me.\nAlex: Great, see you at the cafe.\nSam: Looking forward to it!";
  const result = analyze(raw, "friendship", "Alex", "year");
  assert.equal(result.kind, "analysis");
  if (result.kind !== "analysis") throw new Error("ordinary conversation incorrectly blocked");
  assert.doesNotMatch(result.analysis.headline, /more formal|indicate distance|loss of momentum/i);
  assert.match(result.analysis.interpretations.find((item) => item.charitable)?.suggestedNext ?? "", /no further reply/);
  assert((result.analysis.categories.find((c) => c.id === "warmth_distance")?.percent ?? 0) < 40);
  const storage = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } } });
  try {
    const profile: LocalProfile = { id: "test-profile", name: "Private archive", createdAt: "2026-08-26" };
    const input = { raw, title: "Lunch", otherName: "Sam", context: "friendship" as const, familiarity: "year" as const, headline: result.analysis.headline, categories: [] };
    const saved = saveArchivedConversation(profile, input);
    assert.equal(saveArchivedConversation(profile, input).id, saved.id, "repeat save created a new ID");
    assert.equal(readArchive().length, 1, "repeat save duplicated archive");
    const refreshed = saveArchivedConversation(profile, { ...input, headline: "Updated engine read" });
    assert.equal(refreshed.id, saved.id);
    assert.equal(readArchive()[0].headline, "Updated engine read", "explicit save retained a stale analysis");
    keepActiveRead({ raw, analyzedRaw: raw, context: "friendship", familiarity: "year", youName: "Alex", focusName: "Sam", otherName: "Sam", speakerAssignments: {}, excludedMessages: {}, customParticipants: [], analysis: result.analysis, savedArchiveId: saved.id });
    assert.equal(readActiveRead()?.savedArchiveId, saved.id, "saved label cannot survive tab navigation");
    saveArchivedConversation(profile, { ...input, raw: raw + "\nAlex: Thanks!" });
    saveArchivedConversation(profile, { ...input, context: "work" });
    saveArchivedConversation({ ...profile, id: "different-profile" }, input);
    assert.equal(readArchive().length, 4, "distinct reads were incorrectly merged");
    deleteArchivedConversation(saved.id);
    assert(!readArchive().some((item) => item.id === readActiveRead()?.savedArchiveId), "deleted read still shown saved");
    for (let i = 0; i < 105; i++) saveArchivedConversation(profile, { ...input, raw: `${raw}\nAlex: ${i}` });
    assert.equal(readArchive().length, 100, "archive retention bound changed");
    window.localStorage.setItem = () => { throw new Error("storage full"); };
    assert.throws(() => saveArchivedConversation(profile, { ...input, raw: "new unsaved conversation" }), /storage full/);
  } finally {
    clearActiveRead();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

async function verifyTimeout(): Promise<void> {
  const neverCompletes: FetchImplementation = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  });
  const started = Date.now();
  await assert.rejects(
    fetchWithTimeout("https://example.invalid", {}, 20, neverCompletes),
    (error: unknown) => error instanceof DOMException && error.name === "TimeoutError",
  );
  assert(Date.now() - started < 500, "bounded fetch did not abort promptly");
}

function verifyRateLimit(): void {
  const limiter = new MemoryRateLimitStore(2);
  assert.equal(limiter.consume("a", 2, 1_000, 10).allowed, true);
  assert.equal(limiter.consume("a", 2, 1_000, 20).allowed, true);
  const blocked = limiter.consume("a", 2, 1_000, 30);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(limiter.consume("a", 2, 1_000, 1_011).allowed, true, "expired window did not reset");
}

async function verifySingleFlight(): Promise<void> {
  let calls = 0;
  let release: ((value: string) => void) | undefined;
  const work = () => {
    calls += 1;
    return new Promise<string>((resolve) => { release = resolve; });
  };
  const first = runSingleFlight("same-request", work);
  const second = runSingleFlight("same-request", work);
  assert.equal(calls, 1, "identical concurrent work was not coalesced");
  release?.("ok");
  assert.deepEqual(await Promise.all([first, second]), ["ok", "ok"]);
  await runSingleFlight("same-request", async () => { calls += 1; return "new"; });
  assert.equal(calls, 2, "completed single-flight work remained cached");
}

function verifyReleaseDriftGuards(): void {
  const release = JSON.parse(readFileSync("android-twa/release-version.json", "utf8")) as {
    versionCode: number;
    versionName: string;
  };
  const twa = JSON.parse(readFileSync("android-twa/twa-manifest.json", "utf8")) as {
    appVersionCode: number;
    appVersionName: string;
    startUrl: string;
    minSdkVersion: number;
  };
  assert.equal(twa.appVersionCode, release.versionCode);
  assert.equal(twa.appVersionName, release.versionName);
  assert.equal(twa.startUrl, `/subtext/?app=${release.versionCode}`);
  assert.equal(twa.minSdkVersion, 23);

  const appGradle = readFileSync("android-twa/app/build.gradle", "utf8");
  const rootGradle = readFileSync("android-twa/build.gradle", "utf8");
  const mainActivity = readFileSync("android-twa/app/src/main/java/com/neonjungle/subtext/MainActivity.java", "utf8");
  const signer = readFileSync("android-twa/create-signed-release.ps1", "utf8");
  assert.match(appGradle, /versionCode releaseVersion\.versionCode/);
  assert.match(appGradle, /app=\$\{releaseVersion\.versionCode\}/);
  assert.match(rootGradle, /build-v\$\{releaseVersion\.versionCode\}/);
  assert.match(mainActivity, /BuildConfig\.VERSION_CODE/);
  assert.match(mainActivity, /BuildConfig\.VERSION_NAME/);
  assert.match(signer, /build-v\$versionCode/);
  assert.match(signer, /subtext-v\$versionCode-play\.aab/);
}

function verifySecurityAndRecoverySeams(): void {
  assert(COACH_MODEL_TIMEOUT_MS <= 60_000, "model work must remain bounded");
  assert(COACH_CLIENT_TIMEOUT_MS >= COACH_MODEL_TIMEOUT_MS + 20_000, "UI must allow verification and completion time");
  assert(COACH_LEASE_SECONDS * 1_000 >= COACH_MODEL_TIMEOUT_MS + 10_000, "lease must not expire during model work");
  const nextConfig = readFileSync("next.config.mjs", "utf8");
  const mainActivity = readFileSync("android-twa/app/src/main/java/com/neonjungle/subtext/MainActivity.java", "utf8");
  const coachRoute = readFileSync("app/api/answer-coach/route.ts", "utf8");
  for (const directive of ["Content-Security-Policy", "frame-ancestors 'none'", "Referrer-Policy", "Permissions-Policy"]) {
    assert(nextConfig.includes(directive), `missing security header/directive: ${directive}`);
  }
  for (const callback of ["onReceivedError", "onReceivedHttpError", "onReceivedSslError", "onRenderProcessGone"]) {
    assert(mainActivity.includes(callback), `missing native recovery callback: ${callback}`);
  }
  assert(coachRoute.includes("runControlledIdempotent"));
  assert(coachRoute.includes("consumeRequestLimit"));
  assert(coachRoute.includes("fetchWithTimeout"));
  assert(coachRoute.includes('thinkingLevel: "low"'));
}

async function main(): Promise<void> {
  verifyArchiveAndOrdinaryRead();
  await verifyTimeout();
  verifyRateLimit();
  await verifySingleFlight();
  verifyReleaseDriftGuards();
  verifySecurityAndRecoverySeams();
  console.log("reliability-eval: timeouts, request controls, release drift, headers, and native recovery passed");
}

void main();
