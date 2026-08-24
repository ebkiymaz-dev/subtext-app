export interface ReflectionSnapshot { totalReads: number }

const KEY = "subtext.healthy-closure.v2";
const LEGACY_KEY = "subtext.reflection-progress.v1";

export function readReflectionProgress(): ReflectionSnapshot {
  if (typeof window === "undefined") return { totalReads: 0 };
  try {
    const current = window.localStorage.getItem(KEY);
    if (current) {
      const parsed = JSON.parse(current) as Partial<ReflectionSnapshot>;
      return { totalReads: Number.isFinite(parsed.totalReads) ? Math.max(0, Number(parsed.totalReads)) : 0 };
    }
    // Preserve prior completions without preserving streak mechanics.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    const parsed = legacy ? JSON.parse(legacy) as { totalReads?: unknown } : {};
    return { totalReads: Number.isFinite(parsed.totalReads) ? Math.max(0, Number(parsed.totalReads)) : 0 };
  } catch {
    return { totalReads: 0 };
  }
}

export function recordReflection(): ReflectionSnapshot {
  const next = { totalReads: readReflectionProgress().totalReads + 1 };
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* optional progress */ }
  return next;
}
