export const metadata = {
  title: "Terms of use — Subtext",
  description: "Consumer terms for the Subtext web and Android apps.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 rounded-sbt border border-sbt-linen bg-white/70 p-5 shadow-soft sm:p-8">
      <header>
        <p className="text-[10px] uppercase tracking-widest text-sbt-mute">Effective 26 August 2026</p>
        <h1 className="mt-2 font-display text-3xl text-sbt-ink">Terms of use</h1>
        <p className="mt-3 text-sm leading-relaxed text-sbt-dusk">
          These terms apply when you use Subtext, a Neon Jungle Tools product, on the web or Android.
          By using Subtext, you agree to these terms. If you do not agree, do not use the service.
        </p>
      </header>

      <TermsSection title="Adults only">
        Subtext is intended for people aged 18 or older. It is not designed for children.
      </TermsSection>

      <TermsSection title="What Subtext provides">
        Subtext identifies language and conversation patterns and offers possible readings. Results are
        possibilities, not facts about another person&apos;s thoughts, feelings, honesty, diagnosis, or intent.
        Answer Coach provides editable communication suggestions and does not guarantee a response or outcome.
      </TermsSection>

      <TermsSection title="Not professional or emergency advice">
        Subtext is not therapy and does not provide medical, mental-health, legal, financial, employment,
        safeguarding, or emergency advice. Do not rely on it for urgent or high-risk decisions. Contact an
        appropriate qualified professional or local emergency service when the situation requires one.
      </TermsSection>

      <TermsSection title="Conversations you provide">
        You remain responsible for the text and screenshots you use. Only provide material you are lawfully
        allowed to process, and avoid unnecessary identifying, financial, health, workplace-confidential, or
        other sensitive information. Do not use Subtext to harass, threaten, deceive, exploit, discriminate,
        invade privacy, facilitate unlawful activity, or control another person.
      </TermsSection>

      <TermsSection title="Answer Coach and subscriptions">
        Answer Coach is an optional subscription sold through Google Play in the Android app. The checkout
        screen shows the current local price and billing period before purchase. Subscriptions renew
        automatically unless cancelled through Google Play. Cancellation stops future renewal; access may
        continue until the end of the paid period. Billing, cancellation, restoration, and refund eligibility
        are handled under Google Play&apos;s terms and applicable consumer law. The free reader remains available
        after cancellation.
      </TermsSection>

      <TermsSection title="Availability and changes">
        We may maintain, change, suspend, or discontinue features, including model-backed features, when needed
        for security, reliability, law, or product operation. We do not promise uninterrupted or error-free
        availability. Material changes to these terms will be published here with a revised effective date.
      </TermsSection>

      <TermsSection title="Ownership and permitted use">
        Subtext&apos;s software, branding, interface, and original content belong to Neon Jungle Tools or its
        licensors. You may use the service for personal, lawful purposes. You may not copy, resell, interfere
        with, reverse engineer where prohibited, or attempt to bypass purchase verification, security, or usage limits.
      </TermsSection>

      <TermsSection title="Responsibility and consumer rights">
        You decide whether and how to use a result or suggested reply and remain responsible for communications
        you send. To the extent permitted by applicable law, Subtext is provided without guarantees beyond those
        expressly stated. Nothing in these terms excludes rights or remedies that applicable consumer law does
        not allow us to exclude.
      </TermsSection>

      <TermsSection title="Contact">
        Questions about these terms can be sent to{" "}
        <a href="mailto:partnerslocalmaps@gmail.com" className="text-sbt-gold-700 underline underline-offset-2">
          partnerslocalmaps@gmail.com
        </a>.
      </TermsSection>

      <p className="border-t border-sbt-linen pt-5 text-xs leading-relaxed text-sbt-mute">
        These operational terms should be reviewed for the laws and launch regions that apply before commercial release.
      </p>
    </article>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-sbt-ink">{title}</h2>
      <div className="mt-2 text-sm leading-7 text-sbt-dusk">{children}</div>
    </section>
  );
}
