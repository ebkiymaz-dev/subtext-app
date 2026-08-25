import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchWithTimeout, type FetchImplementation } from "../lib/server/boundedFetch";
import { MemoryRateLimitStore, runSingleFlight } from "../lib/server/requestControl";

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
}

async function main(): Promise<void> {
  await verifyTimeout();
  verifyRateLimit();
  await verifySingleFlight();
  verifyReleaseDriftGuards();
  verifySecurityAndRecoverySeams();
  console.log("reliability-eval: timeouts, request controls, release drift, headers, and native recovery passed");
}

void main();
