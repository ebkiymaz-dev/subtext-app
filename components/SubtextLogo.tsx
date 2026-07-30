// ─────────────────────────────────────────────────────────────
// THE LANDING LOCKUP.
//
// The header wordmark is small on purpose — it is chrome. This is the other
// thing a wordmark has to do: land once, big, before anyone has read a word
// of copy. So the landing gets its own lockup rather than a scaled-up copy of
// the header one, and the gold is doing considerably more work in it.
//
// The two voices are the same as the header's and are load-bearing to the
// name: script "Sub" (the thing under), serif "text" (the thing on the
// surface). Pinyon Script has a tiny x-height and a wide right sidebearing,
// hence the size ratio and the negative margin closing the seam.
//
// Everything here is aria-hidden behind one aria-label, so a screen reader
// hears "Subtext" once rather than "Sub" then "text".
// ─────────────────────────────────────────────────────────────

export default function SubtextLogo() {
  return (
    <div className="relative flex flex-col items-center py-2 sm:py-4">
      {/* gold wash behind the lockup — the "more gold" without tinting text */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-40 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 50%, rgba(176,141,63,0.20) 0%, rgba(176,141,63,0.07) 45%, rgba(176,141,63,0) 78%)",
        }}
      />

      {/* flanking hairlines, fading out of the gold */}
      <div aria-hidden className="mb-4 flex w-full max-w-md items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-sbt-gold/45" />
        <span className="h-1.5 w-1.5 rotate-45 bg-sbt-gold" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-sbt-gold/45" />
      </div>

      <div className="flex items-baseline justify-center" aria-label="Subtext" role="img">
        <span
          aria-hidden
          className="font-script leading-none text-sbt-gold -mr-1 text-[68px] sm:text-[104px]"
          style={{ textShadow: "0 2px 22px rgba(176,141,63,0.34)" }}
        >
          Sub
        </span>
        <span
          aria-hidden
          className="font-display text-[42px] font-medium leading-none tracking-tight text-sbt-ink sm:text-[62px]"
        >
          text
        </span>
        <span aria-hidden className="mb-2 ml-2.5 h-2 w-2 rounded-full bg-sbt-gold sm:mb-3 sm:h-2.5 sm:w-2.5" />
      </div>

      {/* the gold rule the wordmark sits on */}
      <div
        aria-hidden
        className="mt-4 h-[2px] w-40 rounded-full bg-gradient-to-r from-sbt-gold/0 via-sbt-gold to-sbt-gold/0 sm:w-56"
      />

      <p className="mt-4 text-center font-display text-[13px] italic tracking-wide text-sbt-gold-700 sm:text-[15px]">
        What the words are doing, not what they say.
      </p>
    </div>
  );
}
