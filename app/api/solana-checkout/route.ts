import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { readBoundedText } from "@/lib/server/boundedBody";
import { consumeRequestLimit } from "@/lib/server/requestControl";
import { checkPaymentOrder, createPaymentOrder, paidWebEntitlement, paymentUrl, solanaConfig, subjectForToken } from "@/lib/server/solanaCheckout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const config = solanaConfig();
  const recoveryEnabled = process.env.SUBTEXT_SOLANA_ENTITLEMENT_ENABLED === "true";
  return reply(config ? { enabled: true, recoveryEnabled, asset: config.asset, amount: config.amount, days: 30 } : { enabled: false, recoveryEnabled });
}

export async function POST(request: Request) {
  const config = solanaConfig();
  const entitlementsAvailable = process.env.SUBTEXT_SOLANA_ENTITLEMENT_ENABLED === "true";
  if (!config && !entitlementsAvailable) return reply({ ok: false, reason: "Solana checkout is not available yet." }, 503);
  try {
    const body = JSON.parse(await readBoundedText(request, 1024)) as { action?: string; token?: string; orderId?: string };
    const subject = subjectForToken(body.token);
    if (!subject) return reply({ ok: false, reason: "Your Subtext session could not be verified." }, 403);
    const client = createHash("sha256").update(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").digest("hex");
    const limit = await consumeRequestLimit("subtext-solana-checkout", createHash("sha256").update(`${client}:${subject}`).digest("hex"), 30, 3600000);
    if (!limit.allowed) return reply({ ok: false, reason: "Too many payment checks. Try again later." }, 429);

    if (body.action === "entitlement") {
      return reply({ ok: true, ...await paidWebEntitlement(subject) });
    }
    if (body.action === "create") {
      if (!config) return reply({ ok: false, reason: "New Solana payments are paused." }, 503);
      const order = await createPaymentOrder(subject, config);
      return reply({ ok: true, orderId: order.order_id, url: paymentUrl(order), recipient: order.recipient,
        reference: order.reference, asset: order.asset, amount: config.amount, expiresAt: order.expires_at });
    }
    if ((body.action === "status" || body.action === "settle") && typeof body.orderId === "string" && /^[0-9a-f-]{36}$/.test(body.orderId)) {
      return reply({ ok: true, ...await checkPaymentOrder(subject, body.orderId, body.action === "settle") });
    }
    return reply({ ok: false, reason: "Invalid payment request." }, 400);
  } catch {
    return reply({ ok: false, reason: "Payment verification is temporarily unavailable. No access was changed." }, 503);
  }
}
