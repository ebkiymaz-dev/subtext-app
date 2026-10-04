import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { screenForDistress } from "@/lib/engine/distress";
import { segment, setYou } from "@/lib/engine/segment";
import {
  ANSWER_COACH_SCHEMA, buildAnswerCoachPrompt, validatePersonalizedCoach,
  type CoachGoalId, type CoachToneId, type PersonalizedCoachResult,
} from "@/lib/engine/answerCoach";
import type { ContextId, FamiliarityId } from "@/lib/engine/types";
import { resolveCoachProvider } from "@/lib/providers";
import { verifyPlayEntitlement, type EntitlementProof } from "@/lib/server/playEntitlement";
import { fetchWithTimeout } from "@/lib/server/boundedFetch";
import { readBoundedText, BodyTooLargeError } from "@/lib/server/boundedBody";
import { COACH_MODEL_TIMEOUT_MS } from "@/lib/coach-budget";
import { verifyFreeIdentity, freeAllowance } from "@/lib/server/freeAnswerAce";
import { paidWebEntitlement } from "@/lib/server/solanaCheckout";
import {
  consumeRequestLimit,
  DuplicateRequestError,
  RequestControlUnavailableError,
  runControlledIdempotent,
} from "@/lib/server/requestControl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_CHARS = 12_000;
const MAX_STAKES = 500;
const MAX_BODY_BYTES = 24_000;
const MODEL_TIMEOUT_MS = COACH_MODEL_TIMEOUT_MS;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;
const MAX_PRECHECKS = 60;
const json = (body: PersonalizedCoachResult, status = 200, retryAfterSeconds?: number) => NextResponse.json(body, {
  status,
  headers: {
    "Cache-Control": "no-store",
    ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
  },
});
const validGoal = (value: unknown): value is CoachGoalId => ["understand", "reply", "repair", "boundary", "decision", "end"].includes(String(value));
const validTone = (value: unknown): value is CoachToneId => ["warm", "direct", "brief"].includes(String(value));

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ ok: false, reason: "The coaching request is too large." }, 413);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  const precheckKey = createHash("sha256").update(forwarded).digest("hex");
  let precheck;
  try { precheck = await consumeRequestLimit("answer-coach-precheck", precheckKey, MAX_PRECHECKS, WINDOW_MS); }
  catch { return json({ ok: false, reason: "AnswerAce is temporarily unavailable because its shared safety controls could not be verified." }, 503); }
  if (!precheck.allowed) return json({ ok: false, reason: "Too many verification attempts. Try again later." }, 429, precheck.retryAfterSeconds);

  let body: Record<string, unknown>;
  try {
    const raw = await readBoundedText(request, MAX_BODY_BYTES);
    body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  }
  catch (error) { return json({ ok: false, reason: error instanceof BodyTooLargeError ? "The coaching request is too large." : "Malformed request." }, error instanceof BodyTooLargeError ? 413 : 400); }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return json({ ok: false, reason: "No conversation was sent." }, 400);
  if (text.length > MAX_CHARS) return json({ ok: false, reason: `Use the ${MAX_CHARS.toLocaleString()} most relevant characters so the advice stays focused.` }, 413);
  if (screenForDistress(text).triggered) return json({ ok: false, reason: "This conversation needs the care path, not generated coaching." }, 422);

  let guestSubject: string | null = null;
  try { guestSubject = verifyFreeIdentity(body.freeToken); }
  catch { return json({ ok: false, reason: "Free AnswerAce access is temporarily unavailable." }, 503); }
  let paidGuest = false;
  if (guestSubject && process.env.SUBTEXT_SOLANA_ENTITLEMENT_ENABLED === "true") {
    try { paidGuest = (await paidWebEntitlement(guestSubject)).active; }
    catch { return json({ ok: false, reason: "AnswerAce purchase verification is temporarily unavailable." }, 503); }
  }
  const entitlement = guestSubject ? null : await verifyPlayEntitlement((body.entitlement ?? {}) as EntitlementProof);
  if (entitlement && !entitlement.ok) {
    const reason = entitlement.reason === "not_configured"
      ? "Secure Google Play verification is not configured on the server yet. AnswerAce remains locked."
      : entitlement.reason === "inactive" ? "No active AnswerAce subscription was found. Restore purchases and try again."
        : entitlement.reason === "unavailable" ? "Google Play verification is temporarily unavailable. Try again shortly."
          : "The Google Play purchase proof was not accepted.";
    return json({ ok: false, reason }, entitlement.reason === "unavailable" ? 503 : 403);
  }

  const subject = guestSubject ?? (entitlement?.ok ? entitlement.subjectHash : null);
  if (!subject) return json({ ok: false, reason: "AnswerAce access could not be verified." }, 403);
  const rateKey = createHash("sha256").update(`${subject}:${forwarded}`).digest("hex");
  let coachLimit;
  try { coachLimit = await consumeRequestLimit("answer-coach-entitled", rateKey, MAX_REQUESTS, WINDOW_MS); }
  catch { return json({ ok: false, reason: "AnswerAce is temporarily unavailable because its shared safety controls could not be verified." }, 503); }
  if (!coachLimit.allowed) return json({ ok: false, reason: "You have reached the hourly Coach limit. Take a pause and return later." }, 429, coachLimit.retryAfterSeconds);

  const provider = resolveCoachProvider();
  if (!provider.configured) return json({ ok: false, reason: "The private coaching provider is not configured yet. No conversation was sent." }, 503);

  const context = typeof body.context === "string" ? body.context as ContextId : "other";
  const familiarity = typeof body.familiarity === "string" ? body.familiarity as FamiliarityId : "year";
  const goal = validGoal(body.goal) ? body.goal : "understand";
  const tone = validTone(body.tone) ? body.tone : "direct";
  const youName = typeof body.youName === "string" && body.youName.trim() ? body.youName.trim().slice(0, 80) : "You";
  const stakes = typeof body.stakes === "string" ? body.stakes.slice(0, MAX_STAKES) : "";
  const singleMessage = body.inputKind === "message";
  let transcript = segment(singleMessage ? `Sender: ${text.replace(/\r?\n/g, " ")}` : text);
  transcript = setYou(transcript, youName);
  if (transcript.messages.length < (singleMessage ? 1 : 2)) return json({ ok: false, reason: "Check the speaker labels, or select single email/post mode." }, 400);
  const prompt = buildAnswerCoachPrompt({ transcript, context, familiarity, goal, tone, youName, stakes }) + (singleMessage ? "\nOnly one incoming email or post was supplied. The user has not replied in this sample. Do not invent prior interactions, user contributions, mutual engagement, or a relationship history. Offer responses appropriate to this single message, including not replying if appropriate." : "");
  const requestKey = createHash("sha256").update(JSON.stringify({
    subject, text, context, familiarity, goal, tone, youName, stakes, singleMessage,
  })).digest("hex");

  try {
    const checked = await runControlledIdempotent(requestKey, async () => {
      let reservation: string | undefined;
      if (guestSubject && !paidGuest) {
        // Global and network caps bound cost even if installations are reset.
        const dailyBudget = provider.provider === "cloudflare" ? 8 : 100;
        const globalLimit = await consumeRequestLimit("answerace-free-budget", createHash("sha256").update(provider.provider).digest("hex"), dailyBudget, 86400000);
        const networkLimit = await consumeRequestLimit("answerace-free-network", precheckKey, 9, 86400000);
        if (!globalLimit.allowed || !networkLimit.allowed) throw new Error("FREE_BUDGET");
        const allowance = await freeAllowance(guestSubject, "reserve");
        if (!allowance.allowed || !allowance.token) throw new Error("FREE_EXHAUSTED");
        reservation = allowance.token;
      }
      try {
      let checked = validatePersonalizedCoach(await callModel(provider, prompt), transcript, context);
      for (let repair = 0; repair < (provider.provider === "cloudflare" ? 2 : 1) && !checked.coach; repair++) {
        const repairPrompt = `${prompt}\n\nA previous draft was rejected by the safety/evidence validator: ${checked.fatal}. Produce a new complete JSON object. Correct that exact issue. Copy quote substrings exactly from the messages, give two grounded possible readings, and give two safe replies with different style and exposure values. Keep all required fields complete and obey the protective-response decision gate.`;
        checked = validatePersonalizedCoach(await callModel(provider, repairPrompt), transcript, context);
      }
      if (reservation && guestSubject) {
        const settled = await freeAllowance(guestSubject, checked.coach ? "commit" : "release", reservation);
        if (!settled.allowed) throw new Error("ALLOWANCE_SETTLEMENT");
      }
      return checked;
      } catch (error) {
        if (reservation && guestSubject) {
          try { await freeAllowance(guestSubject, "release", reservation); } catch { /* reservation expires */ }
        }
        throw error;
      }
    }, (value) => value.coach ? "ok" : "validation_failed");
    if (!checked.coach) return json({ ok: false, reason: `The coaching draft failed its evidence checks (${checked.fatal}). Nothing unsupported was shown.`, repairs: checked.repairs }, 422);
    return json({ ok: true, coach: checked.coach, provider: provider.label, model: provider.model, repairs: checked.repairs });
  } catch (error) {
    if (error instanceof Error && error.message === "FREE_EXHAUSTED") return json({ ok: false, reason: "Your three free AnswerAce uses are used or currently running this month. Check again after they finish, or return next month." }, 429);
    if (error instanceof Error && error.message === "FREE_BUDGET") return json({ ok: false, reason: "Free AnswerAce is busy today. Your allowance has not been charged; try later." }, 429);
    if (error instanceof DuplicateRequestError) {
      const reason = error.state === "in_progress"
        ? "This same Coach request is already running. Wait a moment instead of starting another chargeable request."
        : "This same Coach request finished very recently. Change an option or wait briefly before running it again.";
      return json({ ok: false, reason }, 409, error.retryAfterSeconds || undefined);
    }
    if (error instanceof RequestControlUnavailableError) {
      return json({ ok: false, reason: "AnswerAce is temporarily unavailable because its shared safety controls could not be verified." }, 503);
    }
    const category = error instanceof Error ? error.message.slice(0, 100) : "provider error";
    console.error(`[answer-coach] ${provider.provider}: ${category}`);
    return json({ ok: false, reason: "The coaching service did not complete. Your conversation was not stored; try again shortly." }, 503);
  }
}

type Provider = ReturnType<typeof resolveCoachProvider>;
async function callModel(provider: Provider, prompt: string): Promise<unknown> {
  const controller = new AbortController();
  const totalTimer = setTimeout(
    () => controller.abort(new DOMException("Model request timed out", "TimeoutError")),
    MODEL_TIMEOUT_MS,
  );
  try {
    if (provider.kind === "gemini") {
      let last = "No configured model responded.";
      for (const model of provider.ladder) {
        const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": provider.apiKey },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 4096, responseMimeType: "application/json", responseSchema: ANSWER_COACH_SCHEMA,
            ...(model === "gemini-3.6-flash" ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
          } }),
        }, MODEL_TIMEOUT_MS);
        if (response.status === 404 || response.status === 503) { last = `${model} unavailable`; continue; }
        if (!response.ok) throw new Error(`provider HTTP ${response.status}`);
        const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const output = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
        if (!output.trim()) { last = `${model} returned no content`; continue; }
        provider.model = model;
        return JSON.parse(stripFence(output));
      }
      throw new Error(last);
    }

    const cloudflareSchema = JSON.parse(JSON.stringify(ANSWER_COACH_SCHEMA, (key, value) =>
      key === "type" && typeof value === "string" ? value.toLowerCase() : value,
    ));
    const isCloudflare = provider.provider === "cloudflare";
    const cloudflarePrompt = isCloudflare
      ? `${prompt}\n\nFor evidenceQuotes, observations.quote, and possibleReadings.quotes, copy an exact substring of at least five characters from the message text. Do not add speaker labels or paraphrase inside quotes. Supply two possible readings and two replies with different style and exposure values. For short excerpts, explicitly acknowledge uncertainty. Fill each required field with analysis, not placeholders.`
      : prompt;
    const response = await fetchWithTimeout(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}) },
      body: JSON.stringify({ model: provider.model, temperature: isCloudflare ? 0 : 0.2, max_tokens: 4096,
        response_format: isCloudflare ? { type: "json_schema", json_schema: cloudflareSchema } : { type: "json_object" },
        messages: [{ role: "system", content: isCloudflare
          ? "Return a complete JSON answer that follows the requested schema and the user instructions. Fill every field with actual analysis, never schema definitions. For a short exchange, give two plausible readings without inventing history, two distinct safe replies, and quote only exact substrings of the messages."
          : "Return only one JSON object matching the requested shape." }, { role: "user", content: cloudflarePrompt }] }),
    }, MODEL_TIMEOUT_MS);
    if (!response.ok) throw new Error(`provider HTTP ${response.status}`);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const output = data.choices?.[0]?.message?.content ?? "";
    if (!output.trim()) throw new Error("provider returned no content");
    return JSON.parse(stripFence(output));
  } finally {
    clearTimeout(totalTimer);
  }
}

function stripFence(value: string): string {
  const text = value.trim();
  return text.startsWith("```") ? text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim() : text;
}
