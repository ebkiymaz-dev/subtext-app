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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_CHARS = 12_000;
const MAX_STAKES = 500;
const MAX_BODY_BYTES = 24_000;
const TIMEOUT_MS = 45_000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;
const MAX_PRECHECKS = 60;
type RateBucket = { count: number; reset: number };
const coachBuckets = new Map<string, RateBucket>();
const precheckBuckets = new Map<string, RateBucket>();

const json = (body: PersonalizedCoachResult, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const validGoal = (value: unknown): value is CoachGoalId => ["understand", "reply", "repair", "boundary", "decision", "end"].includes(String(value));
const validTone = (value: unknown): value is CoachToneId => ["warm", "direct", "brief"].includes(String(value));

function allowed(buckets: Map<string, RateBucket>, key: string, limit: number): boolean {
  const now = Date.now();
  for (const [id, bucket] of buckets) if (bucket.reset <= now) buckets.delete(id);
  const bucket = buckets.get(key);
  if (!bucket) { buckets.set(key, { count: 1, reset: now + WINDOW_MS }); return true; }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ ok: false, reason: "The coaching request is too large." }, 413);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  const precheckKey = createHash("sha256").update(forwarded).digest("hex");
  if (!allowed(precheckBuckets, precheckKey, MAX_PRECHECKS)) return json({ ok: false, reason: "Too many verification attempts. Try again later." }, 429);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, reason: "Malformed request." }, 400); }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return json({ ok: false, reason: "No conversation was sent." }, 400);
  if (text.length > MAX_CHARS) return json({ ok: false, reason: `Use the ${MAX_CHARS.toLocaleString()} most relevant characters so the advice stays focused.` }, 413);
  if (screenForDistress(text).triggered) return json({ ok: false, reason: "This conversation needs the care path, not generated coaching." }, 422);

  const entitlement = await verifyPlayEntitlement((body.entitlement ?? {}) as EntitlementProof);
  if (!entitlement.ok) {
    const reason = entitlement.reason === "not_configured"
      ? "Secure Google Play verification is not configured on the server yet. Answer Coach remains locked."
      : entitlement.reason === "inactive" ? "No active Answer Coach subscription was found. Restore purchases and try again."
        : entitlement.reason === "unavailable" ? "Google Play verification is temporarily unavailable. Try again shortly."
          : "The Google Play purchase proof was not accepted.";
    return json({ ok: false, reason }, entitlement.reason === "unavailable" ? 503 : 403);
  }

  const rateKey = createHash("sha256").update(`${entitlement.subjectHash}:${forwarded}`).digest("hex");
  if (!allowed(coachBuckets, rateKey, MAX_REQUESTS)) return json({ ok: false, reason: "You have reached the hourly Coach limit. Take a pause and return later." }, 429);

  const provider = resolveCoachProvider();
  if (!provider.configured) return json({ ok: false, reason: "The private coaching provider is not configured yet. No conversation was sent." }, 503);

  const context = typeof body.context === "string" ? body.context as ContextId : "other";
  const familiarity = typeof body.familiarity === "string" ? body.familiarity as FamiliarityId : "year";
  const goal = validGoal(body.goal) ? body.goal : "understand";
  const tone = validTone(body.tone) ? body.tone : "direct";
  const youName = typeof body.youName === "string" && body.youName.trim() ? body.youName.trim().slice(0, 80) : "You";
  const stakes = typeof body.stakes === "string" ? body.stakes.slice(0, MAX_STAKES) : "";
  let transcript = segment(text);
  transcript = setYou(transcript, youName);
  if (transcript.messages.length < 2) return json({ ok: false, reason: "Coach needs at least two identifiable messages." }, 400);
  const prompt = buildAnswerCoachPrompt({ transcript, context, familiarity, goal, tone, youName, stakes });

  try {
    const parsed = await callModel(provider, prompt);
    const checked = validatePersonalizedCoach(parsed, transcript);
    if (!checked.coach) return json({ ok: false, reason: `The coaching draft failed its evidence checks (${checked.fatal}). Nothing unsupported was shown.`, repairs: checked.repairs }, 422);
    return json({ ok: true, coach: checked.coach, provider: provider.label, model: provider.model, repairs: checked.repairs });
  } catch (error) {
    const category = error instanceof Error ? error.message.slice(0, 100) : "provider error";
    console.error(`[answer-coach] ${provider.provider}: ${category}`);
    return json({ ok: false, reason: "The coaching service did not complete. Your conversation was not stored; try again shortly." }, 503);
  }
}

type Provider = ReturnType<typeof resolveCoachProvider>;
async function callModel(provider: Provider, prompt: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (provider.kind === "gemini") {
      let last = "No configured model responded.";
      for (const model of provider.ladder) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": provider.apiKey },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 4096, responseMimeType: "application/json", responseSchema: ANSWER_COACH_SCHEMA } }),
        });
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

    const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}) },
      body: JSON.stringify({ model: provider.model, temperature: 0.2, max_tokens: 4096, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return only one JSON object matching the requested shape." }, { role: "user", content: prompt }] }),
    });
    if (!response.ok) throw new Error(`provider HTTP ${response.status}`);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const output = data.choices?.[0]?.message?.content ?? "";
    if (!output.trim()) throw new Error("provider returned no content");
    return JSON.parse(stripFence(output));
  } finally { clearTimeout(timer); }
}

function stripFence(value: string): string {
  const text = value.trim();
  return text.startsWith("```") ? text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim() : text;
}
