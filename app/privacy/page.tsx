export const metadata = {
  title: "Privacy policy — Subtext",
  description: "How Subtext handles conversations, device data, and optional AI-assisted reads.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 rounded-sbt border border-sbt-linen bg-white/70 p-5 shadow-soft sm:p-8">
      <header>
        <p className="text-[10px] uppercase tracking-widest text-sbt-mute">Effective 18 August 2026</p>
        <h1 className="mt-2 font-display text-3xl text-sbt-ink">Privacy policy</h1>
        <p className="mt-3 text-sm leading-relaxed text-sbt-dusk">
          This policy explains how Subtext, a Neon Jungle Tools product, handles information when
          you use the web app or its Android version.
        </p>
      </header>

      <PolicySection title="The short version">
        <p>
          The standard conversation analysis runs in your browser and does not upload the pasted
          conversation. The optional AI-assisted Deep Read is different: it sends the conversation
          to our server and the model provider named in the app, but only after you deliberately
          press its button. Subtext does not sell conversation data.
        </p>
      </PolicySection>

      <PolicySection title="Information handled on your device">
        <p>
          Your pasted conversation, speaker choice, relationship context, and the standard analysis
          are processed on your device. Subtext stores a month identifier, read count, and local plan
          state in browser storage. It does not create a conversation history or contact profile.
          You can remove this local information by clearing the app or browser storage.
        </p>
      </PolicySection>

      <PolicySection title="Optional AI-assisted Deep Read">
        <p>
          If you choose Deep Read, the conversation text and the context needed to analyse it are
          transmitted over HTTPS to the Subtext server and then to the model provider identified in
          the interface. This is used only to return that requested analysis. The Subtext application
          does not intentionally save the conversation or include it in application logs. The model
          provider and hosting providers process the data to deliver the request under their own
          terms and retention practices. Do not use Deep Read for text you do not want transmitted.
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
        <p>
          Information is shared only with service providers needed to host, secure, or deliver a
          feature you request, including the model provider for Deep Read. Subtext does not sell
          personal or sensitive information. Conversation content is not intentionally retained by
          the Subtext application after the response is returned. Standard infrastructure logs are
          kept only as long as reasonably needed for security and operations. Because this release
          has no user accounts or server-side conversation records, there is no account record to
          delete; local app data can be cleared on the device. You may contact us about a privacy or
          deletion request at any time.
        </p>
      </PolicySection>

      <PolicySection title="Children and safety">
        <p>
          Subtext is not directed to children under 13. It is a language-pattern tool, not a medical,
          mental-health, diagnostic, or emergency service. When acute-distress language is detected,
          Subtext stops the analysis and shows crisis resources instead.
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
