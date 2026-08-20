import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/basePath";

// The manifest is GENERATED, not static.
//
// A file in public/ is copied verbatim, so a hardcoded "/subtext/icon-192.png"
// 404s on any deployment whose basePath is not "/subtext" — which is exactly what
// happened on the root-domain (Vercel) build: every icon missing, start_url and
// scope pointing at a path that does not exist, and the app not installable.
//
// Generating it here means the one seam that already knows the deployment shape
// (lib/basePath.ts) also decides these URLs, so root-domain and path-served
// builds are both correct from the same tree.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const p = (path: string) => `${BASE_PATH}${path}`;

  return {
    name: "Subtext \u2014 read between the lines, honestly",
    short_name: "Subtext",
    description: "Paste a conversation and see which markers the language carries, with the evidence and the competing readings underneath.",
    id: p("/"),
    start_url: p("/"),
    scope: p("/"),
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#FAF7F2",
    theme_color: "#FAF7F2",
    categories: ["productivity", "utilities"],
    share_target: {
      action: p("/"),
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: { title: "title", text: "text", url: "url" },
    },
    icons: [
      { src: p("/icon.svg"), sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: p("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: p("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: p("/icon-maskable.svg"), sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: p("/icon-maskable-192.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: p("/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  } as MetadataRoute.Manifest & {
    share_target: {
      action: string;
      method: "GET";
      enctype: "application/x-www-form-urlencoded";
      params: { title: string; text: string; url: string };
    };
  };
}
