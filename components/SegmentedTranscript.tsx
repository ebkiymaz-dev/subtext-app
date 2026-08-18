"use client";

import type { Analysis, CategoryId, Evidence } from "@/lib/engine/types";

/**
 * The transcript surface — speaker bubbles with INLINE CORAL HIGHLIGHTS on
 * the evidence spans. Click a category in the panel and its spans light up
 * here; hover a highlighted line and the panel focuses that category. That
 * bidirectional link is the Grammarly mechanic, retargeted from grammar to
 * subtext.
 */
export default function SegmentedTranscript({
  analysis,
  activeCategory,
  onFocusCategory,
  locked,
}: {
  analysis: Analysis;
  activeCategory: CategoryId | null;
  onFocusCategory: (id: CategoryId | null) => void;
  /** free tier: evidence is marked but the reason is withheld */
  locked: boolean;
}) {
  // messageId → the evidence hitting it, per category
  const map = new Map<string, { catId: CategoryId; label: string; ev: Evidence }[]>();
  for (const c of analysis.categories) {
    for (const ev of c.evidence) {
      const list = map.get(ev.messageId) ?? [];
      list.push({ catId: c.id, label: c.label, ev });
      map.set(ev.messageId, list);
    }
  }

  return (
    <div className="space-y-3">
      {analysis.transcript.messages.map((m) => {
        const hits = map.get(m.id) ?? [];
        const activeHit = activeCategory ? hits.find((h) => h.catId === activeCategory) : undefined;
        const isEvidence = hits.length > 0;
        const spotlit = Boolean(activeHit);
        const dimmed = Boolean(activeCategory) && !spotlit;

        return (
          <div
            key={m.id}
            className={`flex ${m.speaker === "you" ? "justify-end" : "justify-start"} transition-opacity duration-300 ${
              dimmed ? "opacity-35" : "opacity-100"
            }`}
          >
            <div className={`max-w-[86%] sm:max-w-[76%]`}>
              <p
                className={`mb-1 text-[11px] font-medium uppercase tracking-wider ${
                  m.speaker === "you" ? "text-right" : ""
                } ${m.speaker === "you" ? "text-emerald-700" : "text-sky-700"}`}
              >
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${m.speaker === "you" ? "bg-emerald-500" : "bg-sky-500"}`} />
                {m.name}{m.speaker === "you" ? " (you)" : " (them)"}
                {m.timestamp ? ` · ${m.timestamp}` : ""}
              </p>

              <div
                onMouseEnter={() => isEvidence && onFocusCategory(hits[0].catId)}
                onMouseLeave={() => isEvidence && onFocusCategory(null)}
                className={`rounded-sbt px-4 py-3 text-[15px] leading-relaxed transition-shadow ${
                  m.speaker === "you"
                    ? "border border-emerald-200 bg-emerald-50 text-sbt-ink"
                    : "border border-sky-200 bg-sky-50 text-sbt-ink"
                } ${spotlit ? "shadow-soft ring-1 ring-sbt-gold/50" : ""}`}
              >
                {isEvidence ? (
                  <Highlighted
                    text={m.text}
                    spans={hits.map((h) => h.ev.span)}
                    active={spotlit}
                  />
                ) : (
                  m.text
                )}
              </div>

              {isEvidence ? (
                <p
                  className={`mt-1 text-[11px] leading-relaxed text-sbt-mute ${
                    m.speaker === "you" ? "text-right" : ""
                  }`}
                >
                  {locked ? (
                    <span className="select-none blur-[3px]">{hits[0].ev.why}</span>
                  ) : (
                    <>
                      <span className="text-sbt-gold-700">{hits[0].label}</span> · {hits[0].ev.why}
                    </>
                  )}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Wrap each matched span in a coral margin-annotation mark. */
function Highlighted({
  text,
  spans,
  active,
}: {
  text: string;
  spans: string[];
  active: boolean;
}) {
  const unique = [...new Set(spans.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!unique.length) return <>{text}</>;

  const escaped = unique.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);

  return (
    <>
      {parts.map((part, i) =>
        unique.some((s) => s.toLowerCase() === part.toLowerCase()) ? (
          <mark
            key={i}
            className={`bg-transparent text-inherit evidence-mark ${active ? "evidence-mark-active" : ""}`}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
