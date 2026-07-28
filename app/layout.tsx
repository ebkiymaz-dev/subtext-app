import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { fontClass } from "@/lib/fonts";
import { BASE_PATH } from "@/lib/basePath";

export const metadata: Metadata = {
  title: "Subtext — read between the lines, honestly",
  description:
    "Paste a conversation and see which markers the language carries, with the evidence and the competing readings underneath. Possibilities, never verdicts.",
  manifest: `${BASE_PATH}/manifest.json`,
  applicationName: "Subtext",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Subtext" },
  icons: { icon: [{ url: `${BASE_PATH}/icon.svg`, type: "image/svg+xml" }], apple: [{ url: `${BASE_PATH}/icon.svg` }] },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontClass}>
      <body className="font-body antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
