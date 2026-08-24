export const metadata = {
  title: "Privacy policy — Subtext",
  description: "How Subtext handles conversations, device data, and optional AI-assisted reads.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 rounded-sbt border border-sbt-linen bg-white/70 p-5 shadow-soft sm:p-8">
      <header>
        <p className="text-[10px] uppercase tracking-widest text-sbt-mute">Effective 24 August 2026</p>
        <h1 className="mt-2 font-display text-3xl text-sbt-ink">Privacy policy</h1>
        <p className="mt-3 text-sm leading-relaxed text-sbt-dusk">
          This policy explains how Subtext, a Neon Jungle Tools product, handles information when
          you use the web app or its Android version.
        </p>
      </header>

      <PolicySection title="The short version">
        <p>
          The standard conversation analysis runs in your browser and does not upload the pasted
          conversation. The optional Answer Coach is different: it sends the conversation
          to our server and the model provider named in the app, but only after you deliberately
          press its button. Subtext does not sell conversation data.
        </p>
      </PolicySection>

      <PolicySection title="Information handled on your device">
        <p>
          Your pasted conversation, speaker choice, relationship context, and the standard analysis
          are processed on your device. Subtext stores a month identifier, read count,
          explicitly completed-read count, and aggregate feature-completion counters in browser storage. The
          counters contain event names and totals only—never conversation text, names, or URLs.
          If you deliberately create a local profile and press “Save privately,” Subtext stores
          that selected conversation and its read in this device&apos;s browser storage. It is never
          created automatically and does not sync to a server.
          You can remove this local information by clearing the app or browser storage.
        </p>
      </PolicySection>

      <PolicySection title="Answer Coach and Google Play billing">
        <p>
          In the Android app, Answer Coach is an optional Google Play subscription. Google Play
          handles checkout, payment details, renewals, cancellation, and purchase restoration.
          feature; it does not receive or store your card or bank details. When you request coaching,
          the Android app supplies a purchase token to the Subtext server. The server verifies it with
          Google Play before allowing the model request. Subtext does not use that token for advertising
          or include it in application logs.
        </p>
      </PolicySection>

      <PolicySection title="Optional AI-assisted Answer Coach">
        <p>
          If you choose Answer Coach, the conversation text, relationship context, stated goal, preferred
          tone, and any optional non-negotiable you entered are
          transmitted over HTTPS to the Subtext server and then to the model provider identified in
          the interface. This is used only to return that requested analysis. The Subtext application
          does not intentionally save the conversation or include it in application logs. The model
          provider and hosting providers process the data to deliver the request under their own
          terms and retention practices. Do not use Answer Coach for text you do not want transmitted.
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
          feature you request, including the model provider for Answer Coach. Subtext does not sell
          personal or sensitive information. Conversation content is not intentionally retained by
          the Subtext application after the response is returned. Standard infrastructure logs are
          kept only as long as reasonably needed for security and operations. Because this release
          has no server-side user accounts or conversation records, there is no cloud account record
          to delete. A local profile and individual archived conversations can be deleted inside the
          Archive screen, and all local app data can also be cleared from the device. You may contact
          us about a privacy or deletion request at any time.
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
