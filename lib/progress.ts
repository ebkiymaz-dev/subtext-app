export interface ReflectionProgress {
  activeDays: string[];
  totalReads: number;
}

export interface ReflectionSnapshot extends ReflectionProgress {
  streak: number;
  weekCount: number;
  weekGoal: number;
}

const KEY = "subtext.reflection-progress.v1";
const WEEK_GOAL = 3;

function dayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDay(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(later: string, earlier: string): number {
  const ms = parseDay(later).getTime() - parseDay(earlier).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function snapshot(progress: ReflectionProgress): ReflectionSnapshot {
  const activeDays = [...new Set(progress.activeDays)].sort();
  const today = dayKey();
  const last = activeDays.length ? activeDays[activeDays.length - 1] : undefined;
  let streak = 0;

  if (last && daysBetween(today, last) <= 1) {
    streak = 1;
    for (let index = activeDays.length - 1; index > 0; index -= 1) {
      if (daysBetween(activeDays[index], activeDays[index - 1]) !== 1) break;
      streak += 1;
    }
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const weekCount = activeDays.filter((key) => parseDay(key) >= start).length;

  return {
    activeDays,
    totalReads: progress.totalReads,
    streak,
    weekCount,
    weekGoal: WEEK_GOAL,
  };
}

export function readReflectionProgress(): ReflectionSnapshot {
  if (typeof window === "undefined") return snapshot({ activeDays: [], totalReads: 0 });
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ReflectionProgress>) : {};
    return snapshot({
      activeDays: Array.isArray(parsed.activeDays)
        ? parsed.activeDays.filter((value): value is string => typeof value === "string").slice(-90)
        : [],
      totalReads: Number.isFinite(parsed.totalReads) ? Math.max(0, Number(parsed.totalReads)) : 0,
    });
  } catch {
    return snapshot({ activeDays: [], totalReads: 0 });
  }
}

export function recordReflection(): ReflectionSnapshot {
  const current = readReflectionProgress();
  const next: ReflectionProgress = {
    activeDays: [...new Set([...current.activeDays, dayKey()])].slice(-90),
    totalReads: current.totalReads + 1,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Progress is optional. A storage failure must never block the analysis.
  }
  return snapshot(next);
}
