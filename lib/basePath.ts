// ── BASE PATH (single seam) ───────────────────────────────────
// next.config.mjs sets `basePath: "/subtext"`. Next handles <Link>, the router
// and /_next/* asset URLs on its own. It does NOT rewrite strings we build by
// hand — service-worker registration, the manifest URL and raw fetch() calls —
// so those import BASE_PATH from here rather than hardcoding the prefix.
// Empty string in dev when the env var is unset, so `next dev` still works.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix an app-absolute path ("/api/x") with the base path. */
export const withBase = (path: string) => `${BASE_PATH}${path}`;
