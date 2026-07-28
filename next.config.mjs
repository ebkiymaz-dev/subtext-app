/** @type {import('next').NextConfig} */

// basePath is a property of the DEPLOYMENT, not of the code.
//
//   Vercel / one-app-per-domain  -> leave NEXT_PUBLIC_BASE_PATH unset -> basePath ""
//   apex reverse proxy (cloudflared, https://neonjungletools.com/subtext/)
//                                -> NEXT_PUBLIC_BASE_PATH=/subtext
//
// The path-served deployment sets it at build time in
// "Neon Jungle Tools/deploy/01_build_and_install.bat", so both deployment
// styles build from this same tree with no code edits.
//
// Next rewrites its own routes, <Link> hrefs and /_next/* asset URLs with this
// prefix automatically; the handful of places that build a URL by hand read
// NEXT_PUBLIC_BASE_PATH via lib/basePath.ts.
const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();

// Next requires basePath to be either "" or a leading slash with no trailing slash.
const basePath =
  raw === "" || raw === "/"
    ? ""
    : `/${raw.replace(/^\/+/, "").replace(/\/+$/, "")}`;

const nextConfig = {
  basePath,
  // Re-export the normalised value so client code sees "" rather than undefined
  // when the variable is not set at all.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  reactStrictMode: true,
};

export default nextConfig;
