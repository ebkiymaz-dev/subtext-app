import { createHash, createHmac, randomBytes } from "node:crypto";
import { fetchWithTimeout } from "./boundedFetch";

export type RateLimitDecision = { allowed: boolean; retryAfterSeconds: number };
export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number, now?: number): RateLimitDecision;
}
type Bucket = { count: number; resetAt: number };

/** Local-development fallback only. Production never grants paid work from it. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly maxBuckets = 10_000) {}

  consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    for (const [id, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(id);
    const current = this.buckets.get(key);
    if (!current) {
      while (this.buckets.size >= this.maxBuckets) {
        const oldest = this.buckets.keys().next().value as string | undefined;
        if (!oldest) break;
        this.buckets.delete(oldest);
      }
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

type SharedState = { limiter: MemoryRateLimitStore; inFlight: Map<string, Promise<unknown>> };
const sharedKey = Symbol.for("subtext.request-control.v2");
const globalState = globalThis as typeof globalThis & { [sharedKey]?: SharedState };
const shared = globalState[sharedKey] ??= {
  limiter: new MemoryRateLimitStore(),
  inFlight: new Map<string, Promise<unknown>>(),
};

export class RequestControlUnavailableError extends Error {
  constructor(message = "Shared request control is unavailable") {
    super(message);
    this.name = "RequestControlUnavailableError";
  }
}

export class DuplicateRequestError extends Error {
  constructor(
    public readonly state: "in_progress" | "completed" | "failed",
    public readonly retryAfterSeconds = 0,
  ) {
    super(state === "in_progress" ? "An identical Coach request is already running" : "An identical Coach request recently finished");
    this.name = "DuplicateRequestError";
  }
}

type RemoteConfig = { url: string; secret: string };
function remoteConfig(): RemoteConfig | null {
  const url = (process.env.REQUEST_CONTROL_URL ?? "").trim().replace(/\/+$/, "");
  const secret = process.env.REQUEST_CONTROL_HMAC_SECRET ?? "";
  if (!url && !secret && process.env.NODE_ENV !== "production") return null;
  if (!url || secret.length < 32) throw new RequestControlUnavailableError("Shared request control is not configured");
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new RequestControlUnavailableError("Shared request-control URL is invalid"); }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new RequestControlUnavailableError("Shared request control requires HTTPS");
  }
  return { url, secret };
}

export function canonicalRemoteRequest(timestamp: string, nonce: string, method: string, path: string, body: string): string {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  return `${timestamp}\n${nonce}\n${method.toUpperCase()}\n${path}\n${bodyHash}`;
}

export function signRemoteRequest(secret: string, canonical: string): string {
  return `v1=${createHmac("sha256", secret).update(canonical).digest("hex")}`;
}

async function remotePost<T>(path: string, payload: object): Promise<T> {
  const config = remoteConfig();
  if (!config) throw new RequestControlUnavailableError("Remote request control is disabled in local development");
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = randomBytes(18).toString("hex");
  const signature = signRemoteRequest(config.secret, canonicalRemoteRequest(timestamp, nonce, "POST", path, body));
  let response: Response;
  try {
    response = await fetchWithTimeout(`${config.url}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NJT-Timestamp": timestamp,
        "X-NJT-Nonce": nonce,
        "X-NJT-Signature": signature,
      },
      body,
      cache: "no-store",
    }, 5_000);
  } catch (error) {
    throw new RequestControlUnavailableError(error instanceof Error ? error.message : undefined);
  }
  if (!response.ok) throw new RequestControlUnavailableError(`Shared request control returned HTTP ${response.status}`);
  try { return await response.json() as T; }
  catch { throw new RequestControlUnavailableError("Shared request control returned malformed JSON"); }
}

export async function consumeRequestLimit(scope: string, keyHash: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
  const config = remoteConfig();
  if (!config) return shared.limiter.consume(`${scope}:${keyHash}`, limit, windowMs);
  const result = await remotePost<{ allowed: boolean; retry_after_seconds: number }>(
    "/v1/request-control/rate-limit",
    { scope, key_hash: keyHash, limit, window_seconds: Math.max(1, Math.ceil(windowMs / 1_000)) },
  );
  return { allowed: result.allowed === true, retryAfterSeconds: Math.max(0, Number(result.retry_after_seconds) || 0) };
}

/** Coalesces identical concurrent work in local development. */
export function runSingleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = shared.inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = work().finally(() => {
    if (shared.inFlight.get(key) === pending) shared.inFlight.delete(key);
  });
  shared.inFlight.set(key, pending);
  return pending;
}

export async function runControlledIdempotent<T>(
  keyHash: string,
  work: () => Promise<T>,
  resultCode: (value: T) => string = () => "completed",
): Promise<T> {
  const config = remoteConfig();
  if (!config) return runSingleFlight(keyHash, work);

  const lease = await remotePost<{
    state: "acquired" | "in_progress" | "completed" | "failed";
    lease_token?: string;
    retry_after_seconds?: number;
  }>("/v1/request-control/idempotency/acquire", {
    key_hash: keyHash,
    lease_seconds: 45,
    result_ttl_seconds: 120,
  });
  if (lease.state !== "acquired" || !lease.lease_token) {
    throw new DuplicateRequestError(lease.state === "acquired" ? "in_progress" : lease.state, lease.retry_after_seconds ?? 0);
  }

  try {
    const value = await work();
    const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");
    await remotePost("/v1/request-control/idempotency/complete", {
      key_hash: keyHash,
      lease_token: lease.lease_token,
      outcome: "completed",
      result_code: resultCode(value),
      result_digest: digest,
      result_ttl_seconds: 120,
    });
    return value;
  } catch (error) {
    try {
      await remotePost("/v1/request-control/idempotency/complete", {
        key_hash: keyHash,
        lease_token: lease.lease_token,
        outcome: "failed",
        result_code: "upstream_failed",
        result_ttl_seconds: 30,
      });
    } catch {
      // Preserve the original failure; the lease expires and becomes recoverable.
    }
    throw error;
  }
}
