export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Bounds an upstream request even when the caller does not supply a signal.
 * The caller's signal is preserved, and listeners/timers are always released.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 5_000,
  fetcher: FetchImplementation = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const abortFromCaller = () => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted) abortFromCaller();
  else upstreamSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    Math.max(1, timeoutMs),
  );

  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", abortFromCaller);
  }
}
