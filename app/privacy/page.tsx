import EraseSubtextData from "@/components/EraseSubtextData";

export const metadata = {
  title: "Privacy policy — Subtext",
  description: "How Subtext handles conversations, device data, and optional AI-assisted reads.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 rounded-sbt border border-sbt-linen bg-white/70 p-5 shadow-soft sm:p-8">
      <header>
        <p className="text-[10px] uppercase tracking-widest text-sbt-mute">Effective 26 August 2026</p>
        <h1 className="mt-2 font-display text-3xl text-sbt-ink">Privacy policy</h1>
        <p className="mt-3 text-sm leading-relaxed text-sbt-dusk">
          This policy explains how Subtext, a Neon Jungle Tools product, handles information when
          you use the web app or its Android version.
        </p>
      </header>

      <PolicySection title="The short version">
        <p>
          The free conversation reader and screenshot recognition process conversation content on
          your device. Subtext does not automatically save a free read. If you choose the optional
          local archive, the selected conversation is saved in this device&apos;s browser storage. Answer
          Coach is different: after you deliberately request it, the app sends the information described
          below to the Subtext server and its configured model provider. Subtext does not sell conversation data.
        </p>
      </PolicySection>

      <PolicySection title="Information handled on your device">
        <p>
          Your pasted conversation, speaker choice, relationship context, and the standard analysis
          are processed on your device. Subtext stores a month identifier, read count,
          explicitly completed-read count, and aggregate feature-completion counters in browser storage. The
          counters contain event names and totals only—never conversation text, names, or URLs.
          If you press “Save to archive,” Subtext creates a private on-device archive if needed and stores
          that selected conversation and its read in this device&apos;s browser storage. Saving is never
          automatic and Subtext does not sync the archive to its server. A saved conversation remains
          until you delete it, delete the local profile, use “Erase all Subtext data” below, or clear
          the app or browser storage. Unsaved reads remain in page memory only and disappear when the
          active read is cleared or the app process ends.
        </p>
      </PolicySection>

      <PolicySection title="Answer Coach and Google Play billing">
        <p>
          In the Android app, Answer Coach is an optional Google Play subscription. Google Play
          handles checkout, payment details, renewals, cancellation, and purchase restoration.
          Subtext does not receive or store your card or bank details. When you request coaching,
          the Android app supplies a purchase token to the Subtext server. The server verifies it with
          Google Play before allowing the model request. Subtext does not use that token for advertising
          or include it in application logs.
        </p>
      </PolicySection>

      <PolicySection title="Optional AI-assisted Answer Coach">
        <p>
          If you choose Answer Coach, the conversation text, relationship context, stated goal, preferred
          tone, speaker name, and any optional stakes or non-negotiable you entered are transmitted over
          HTTPS to the Subtext server and then to the configured model provider. This is used to return
          the coaching you requested. The application code does not write that request content to a
          conversation database or intentionally include it in application logs. It is handled in memory
          for the request and response. Hosting and model providers may handle it under their then-current
          terms and retention practices; Subtext does not claim a shorter provider retention period unless
          it is shown in the in-app disclosure. Do not use Answer Coach for text you do not want transmitted.
        </p>
      </PolicySection>

      <PolicySection title="Technical information">
        <p>
          Hosting and network providers may receive standard request information such as IP address,
          device or browser type, request time, requested URL, and diagnostic or security logs. This
          information is used to operate, secure, and troubleshoot the service. Subtext does not use
          advertising trackers or request contacts, location, microphone, camera, SMS, or call-log
          permissions in this release.
        </p>
      </PolicySection>

      <PolicySection title="Sharing, retention, and deletion">
        <div className="space-y-3">
          <p>
          Information is transmitted only to vendors needed to host, secure, bill for, or deliver a
          feature you request, including the configured model provider for Answer Coach. Whether a
          vendor qualifies as a processor or service provider depends on its then-current contract and
          practices; this policy does not assume a status that has not been confirmed. Subtext does not
          sell personal or sensitive information. Answer Coach conversation content is not intentionally
          persisted by the Subtext application after the response is returned.
          </p>
          <p>
          For abuse prevention, the application keeps one-way hashes derived from request network
          information—and, after successful purchase verification, the verified subscription subject—in
          volatile server memory for no more than one hour. The application does not persist the raw
          purchase token. Standard hosting and security logs may be retained under the configured hosting
          providers&apos; policies; their exact period is not set by the Subtext application and must not be
          inferred from this policy.
          </p>
          <p>
          Because this release
          has no server-side user accounts or conversation records, there is no cloud account record
          to delete. A local profile and individual archived conversations can be deleted inside the
          Archive screen. The control below removes all Subtext-owned browser storage, cached Subtext pages,
          and Subtext offline service-worker state from this device without clearing other Neon Jungle apps.
          You may contact
          us about a privacy or deletion request at any time.
          </p>
          <EraseSubtextData />
        </div>
      </PolicySection>

      <PolicySection title="Children and safety">
        <p>
          Subtext is intended only for adults aged 18 or older. It is a language-pattern tool, not a
          medical, mental-health, diagnostic, or emergency service. Its English-language safety screen
          may stop an analysis when recognised acute-distress wording is present and show crisis resources,
          but automated screening can miss context or language and is not a substitute for emergency help.
        </p>
      </PolicySection>

      <PolicySection title="Changes and contact">
        <p>
          We will update this page when the app&apos;s data practices change. Privacy questions and
          requests can be sent to{" "}
          <a
            href="mailto:partnerslocalmaps@gmail.com"
            className="text-sbt-gold-700 underline underline-offset-2"
          >
            partnerslocalmaps@gmail.com
          </a>
          .
        </p>
      </PolicySection>

      <p className="border-t border-sbt-linen pt-5 text-xs leading-relaxed text-sbt-mute">
        This operational policy is prepared for transparency and Google Play disclosure. It should
        be reviewed for the laws that apply where Subtext is offered before commercial release.
      </p>
    </article>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-sbt-ink">{title}</h2>
      <div className="mt-2 text-sm leading-7 text-sbt-dusk">{children}</div>
    </section>
  );
}
