// ═════════════════════════════════════════════════════════════
// USAGE + PAYMENTS SEAM.
//
// Free = 3 analyses per calendar month. That cap is LOAD-BEARING: every
// analysis (including free ones) costs a model call in a live build, so
// the cap is the cost control, not a growth lever.
//
// Usage stores only a month key and count. The separate optional local archive
// stores raw text only after an explicit user action and never changes billing.
// ═════════════════════════════════════════════════════════════

import { config } from "./config";

export type PlanId = "free" | "premium" | "work";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  annual?: string;
  blurb: string;
  bullets: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "3 analyses / month",
    blurb: "The full percentage panel and the competing interpretations. Evidence lines stay blurred.",
    bullets: [
      "Full category panel",
      "Weighted interpretations",
      "One suggested next message",
      "Evidence drawer blurred",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$8.99",
    cadence: "/month",
    annual: "or $3.99/mo billed annually",
    blurb: "Unlimited reads, the evidence behind every score, and Coach.",
    bullets: [
      "Unlimited analyses",
      "Evidence drawer — the lines behind every score",
      "Coach: 2–4 option-framed suggestions",
      "Trend over time",
    ],
  },
  {
    id: "work",
    name: "Work",
    price: "$14.99",
    cadence: "/month",
    blurb: "Premium, tuned for client, boss and negotiation threads.",
    bullets: [
      "Everything in Premium",
      "Work-context category pools",
      "Comparison mode",
      "Longer threads",
    ],
  },
];

export const FREE_LIMIT = 3;

export interface Usage {
  month: string; // YYYY-MM
  count: number;
  plan: PlanId;
}

const KEY = "subtext.usage.v1";
const monthKey = () => new Date().toISOString().slice(0, 7);

export function readUsage(): Usage {
  const fresh: Usage = { month: monthKey(), count: 0, plan: "free" };
  if (typeof window === "undefined") return fresh;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fresh;
    const u = JSON.parse(raw) as Usage;
    // a new month resets the counter
    return u.month === monthKey() ? u : { ...fresh, plan: u.plan };
  } catch {
    return fresh;
  }
}

export function writeUsage(u: Usage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* storage disabled — counter lives for the session only */
  }
}

export const isPaid = (u: Usage) => u.plan !== "free";

export function remaining(u: Usage): number {
  return isPaid(u) ? Infinity : Math.max(FREE_LIMIT - u.count, 0);
}

export function canAnalyse(u: Usage): boolean {
  return isPaid(u) || u.count < FREE_LIMIT;
}

/** Count an analysis. The care path is NEVER counted — it is not a product use. */
export function recordAnalysis(): Usage {
  const u = readUsage();
  const next = { ...u, month: monthKey(), count: u.count + 1 };
  writeUsage(next);
  return next;
}

export interface CheckoutResult {
  url: string | null;
  mock: boolean;
  message: string;
}

/**
 * MOCK CHECKOUT — grants locally, takes no money.
 * LIVE: POST /api/checkout → Lemon Squeezy hosted URL → HMAC-verified
 * webhook writes the entitlement server-side. The client never grants itself.
 */
export async function checkout(plan: PlanId): Promise<CheckoutResult> {
  if (config.billingMode !== "mock") {
    throw new Error(
      "Lemon Squeezy is not wired yet. Add /api/checkout + /api/webhooks/lemon, then set NEXT_PUBLIC_BILLING_MODE=lemonsqueezy."
    );
  }
  const u = readUsage();
  writeUsage({ ...u, plan });
  return {
    url: null,
    mock: true,
    message: `Mock unlock — ${plan === "free" ? "Free" : plan === "premium" ? "Premium" : "Work"} active on this device. No payment was taken.`,
  };
}
