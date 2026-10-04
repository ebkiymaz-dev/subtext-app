import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { issueFreeIdentity, verifyFreeIdentity, freeAllowance } from "@/lib/server/freeAnswerAce";
import { consumeRequestLimit } from "@/lib/server/requestControl";
import { resolveCoachProvider } from "@/lib/providers";
import { readBoundedText, BodyTooLargeError } from "@/lib/server/boundedBody";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const raw = await readBoundedText(request, 512);
    const body = JSON.parse(raw);
    let token = body.token;
    let subject = verifyFreeIdentity(token);
    const ip = createHash("sha256").update(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").digest("hex");
    const rate = await consumeRequestLimit("answerace-session", ip, 60, 3600000);
    if (!rate.allowed) return reply({ ok: false, reason: "Try again later." }, 429);
    if (!resolveCoachProvider().configured) return reply({ ok: false, reason: "AnswerAce is not available yet. Your free local read still works." }, 503);
    if (!subject) {
      const issued = await consumeRequestLimit("answerace-identity", ip, 3, 86400000);
      if (!issued.allowed) return reply({ ok: false, reason: "The free-access setup limit has been reached for this network. Try later." }, 429);
      token = issueFreeIdentity();
      subject = verifyFreeIdentity(token)!;
    }
    const status = await freeAllowance(subject, "status");
    return reply({ ok: true, token, remaining: status.remaining, month: status.month, limit: 3 });
  } catch (error) {
    if (error instanceof BodyTooLargeError || error instanceof SyntaxError) return reply({ ok: false, reason: "Invalid session request." }, 400);
    return reply({ ok: false, reason: "Free AnswerAce access is temporarily unavailable. No conversation was sent." }, 503);
  }
}
