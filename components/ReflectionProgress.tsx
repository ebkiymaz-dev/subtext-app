import type { ReflectionSnapshot } from "@/lib/progress";

export default function ReflectionProgress({
  progress,
  compact = false,
}: {
  progress: ReflectionSnapshot;
  compact?: boolean;
}) {
  const complete = Math.min(progress.weekCount, progress.weekGoal);
  const percent = Math.round((complete / progress.weekGoal) * 100);
  const next = progress.totalReads === 0
    ? "Complete your first thoughtful read"
    : progress.weekCount >= progress.weekGoal
      ? "Weekly reflection goal complete"
      : `${progress.weekGoal - progress.weekCount} thoughtful read${progress.weekGoal - progress.weekCount === 1 ? "" : "s"} to this week’s goal`;

  return (
    <section
      className={`rounded-sbt border border-sbt-gold/25 bg-sbt-gold/[0.055] ${compact ? "px-4 py-3" : "p-4"}`}
      aria-label="Reflection progress"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-sbt-gold-700">
            Reflection rhythm
          </p>
          <p className="mt-0.5 text-[12px] text-sbt-dusk">{next}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-center">
          <Metric value={`${progress.weekCount}`} label="this week" />
          <Metric value={`${progress.totalReads}`} label="reads" />
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sbt-linen" aria-hidden="true">
        <div
          className="h-full rounded-full bg-sbt-gold transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {!compact ? (
        <p className="mt-2 text-[10.5px] leading-relaxed text-sbt-mute">
          A read counts once per day toward the weekly goal. There is no streak to lose, and conversation text is never saved.
        </p>
      ) : null}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-12">
      <p className="font-display text-xl leading-none text-sbt-ink">{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-wider text-sbt-mute">{label}</p>
    </div>
  );
}
