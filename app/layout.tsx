import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { fontClass } from "@/lib/fonts";
import { BASE_PATH } from "@/lib/basePath";

export const metadata: Metadata = {
  title: "Subtext — read between the lines, honestly",
  description:
    "Paste a conversation and see which markers the language carries, with the evidence and the competing readings underneath. Possibilities, never verdicts.",
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  applicationName: "Subtext",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Subtext" },
  // iOS ignores an SVG apple-touch-icon, so ship a real 180px PNG for it.
  icons: {
    icon: [
      { url: `${BASE_PATH}/icon.svg`, type: "image/svg+xml" },
      { url: `${BASE_PATH}/favicon-32.png`, sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: `${BASE_PATH}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Subtext",
  description:
    "A private browser tool that analyzes the language and structure of a conversation and shows the evidence behind multiple possible readings.",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  url: "https://neonjungletools.com/subtext/",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "On-device conversation analysis",
    "Speaker-side highlighting",
    "Evidence-backed alternative readings",
    "No account required",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontClass}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
      </head>
      <body className="font-body antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
