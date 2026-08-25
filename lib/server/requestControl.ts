export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number, now?: number): RateLimitDecision;
}

type Bucket = { count: number; resetAt: number };

/**
 * A bounded, process-local fallback. The interface is intentionally small so a
 * durable Redis/KV implementation can replace it without changing API routes.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly maxBuckets = 10_000) {}

  consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    this.prune(now);
    const current = this.buckets.get(key);
    if (!current) {
      this.makeRoom();
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
      };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  private makeRoom(): void {
    while (this.buckets.size >= this.maxBuckets) {
      const oldest = this.buckets.keys().next().value as string | undefined;
      if (!oldest) break;
      this.buckets.delete(oldest);
    }
  }
}

type SharedState = {
  limiter: MemoryRateLimitStore;
  inFlight: Map<string, Promise<unknown>>;
};

const sharedKey = Symbol.for("subtext.request-control.v1");
const globalState = globalThis as typeof globalThis & { [sharedKey]?: SharedState };
const shared = globalState[sharedKey] ??= {
  limiter: new MemoryRateLimitStore(),
  inFlight: new Map<string, Promise<unknown>>(),
};

export function consumeRequestLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitDecision {
  return shared.limiter.consume(key, limit, windowMs);
}

/** Coalesces identical concurrent work. Completed responses are never cached. */
export function runSingleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = shared.inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const pending = work().finally(() => {
    if (shared.inFlight.get(key) === pending) shared.inFlight.delete(key);
  });
  shared.inFlight.set(key, pending);
  return pending;
}
