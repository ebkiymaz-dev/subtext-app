"use client";

import { CRISIS_RESOURCES } from "@/lib/engine/distress";

/**
 * THE OVERRIDE. When acute-distress markers are present the entire surface
 * becomes this card. No percentages. No interpretations. No paywall. No
 * "analysis" of any kind — because a person in distress is not a subject to
 * be scored, and the free counter is not ticked for this.
 */
export default function DistressCard({ onBack }: { onBack: () => void }) {
  return (
    <section className="animate-rise-in mx-auto max-w-2xl rounded-sbt border border-sbt-rose/25 bg-sbt-rose/[0.06] p-7 shadow-soft sm:p-9">
      <p className="font-display text-sm uppercase tracking-widest text-sbt-rose">
        Subtext has stopped here
      </p>

      <h1 className="mt-3 font-display text-2xl leading-snug text-sbt-ink sm:text-3xl">
        This conversation carries language often associated with acute distress.
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed text-sbt-dusk">
        We are not going to score it. Breaking a message like this into percentages would be the
        wrong response to it — and reading it as data would not help the person who wrote it.
      </p>

      <p className="mt-3 text-[15px] leading-relaxed text-sbt-dusk">
        If this is someone you care about, you do not need the right words. Asking directly and
        plainly — <span className="font-display italic">&ldquo;are you thinking about hurting yourself?&rdquo;</span>{" "}
        — is safe to ask and is often a relief to be asked. Staying with them matters more than
        saying the perfect thing. If it is urgent, contact your local emergency number.
      </p>

      <div className="mt-7 space-y-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-sbt-mute">
          People who can help, right now
        </h2>
        <ul className="space-y-2">
          {CRISIS_RESOURCES.map((r) => (
            <li key={r.name} className="rounded-sbt border border-sbt-linen bg-white/70 p-4">
              <p className="text-[11px] uppercase tracking-wider text-sbt-mute">{r.region}</p>
              <p className="mt-0.5 font-display text-base text-sbt-ink">{r.name}</p>
              <p className="text-sm text-sbt-dusk">{r.contact}</p>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-sbt-gold-700 underline underline-offset-2"
              >
                {r.href.replace("https://", "")}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-sbt-mute">
        This screen is not a diagnosis and Subtext is not a clinical tool. It ran entirely on your
        device, nothing was uploaded, nothing was stored, and this did not count against your free
        analyses.
      </p>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 rounded-sbt border border-sbt-linen px-4 py-2.5 text-sm text-sbt-dusk transition-colors hover:border-sbt-mute"
      >
        Back
      </button>
    </section>
  );
}
