import type { ReflectionSnapshot } from "@/lib/progress";

export default function ReflectionProgress({
  progress,
  compact = false,
}: {
  progress: ReflectionSnapshot;
  compact?: boolean;
}) {
  const next = progress.totalReads === 0 ? "Close a read when you have chosen your next step" : `${progress.totalReads} conversation${progress.totalReads === 1 ? "" : "s"} closed thoughtfully`;

  return (
    <section
      className={`rounded-sbt border border-sbt-gold/25 bg-sbt-gold/[0.055] ${compact ? "px-4 py-3" : "p-4"}`}
      aria-label="Reflection progress"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-sbt-gold-700">
            Healthy closure
          </p>
          <p className="mt-0.5 text-[12px] text-sbt-dusk">{next}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-center">
          <Metric value={`${progress.totalReads}`} label="completed" />
        </div>
      </div>
      {!compact ? (
        <p className="mt-2 text-[10.5px] leading-relaxed text-sbt-mute">
          Progress counts only when you explicitly finish a read. There are no streaks, reminders to recheck someone, or rewards for repeated analysis. Conversation text is never saved here.
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
