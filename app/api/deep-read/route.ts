// ═════════════════════════════════════════════════════════════
// POST /api/deep-read  —  THE PREMIUM TIER. One real model call.
//
// SERVER-ONLY, AND THAT IS THE POINT. The provider key is read from
// process.env here and never crosses to the browser. The client posts text
// and receives structured JSON; it never sees a key, a base URL or a header.
//
// ORDER OF OPERATIONS — this ordering IS the safety guarantee:
//
//   1. the crisis screen runs HERE too, on the raw text, before anything
//      else. The client already ran it; running it again server-side means a
//      client that has been tampered with, cached, or is simply out of date
//      still cannot get a distressed message sent to a language model. The
//      request returns the resource path and spends nothing.
//   2. segmentation + signal extraction (the same on-device code, run again)
//   3. ONE model call, temperature 0.15, JSON-schema constrained
//   4. validation — every quote checked against the pasted text, schema
//      rules enforced in code, banned lexicon applied
//   5. at most ONE repair retry, then honest failure
//
// PRIVACY, STATED PLAINLY. Unlike every other part of Subtext, this endpoint
// does receive message text — that is unavoidable for a hosted model, and
// the UI says so before the user presses the button. What this endpoint does
// NOT do is persist any of it: nothing is written to disk, nothing is logged,
// and the catch blocks below deliberately log a category rather than an
// error object, because error objects in this codebase would contain the
// conversation.
// ═════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { screenForDistress } from "@/lib/engine/distress";
import { segment, setYou } from "@/lib/engine/segment";
import { extractSignals } from "@/lib/engine/signals";
import {
  DEEP_READ_SCHEMA, REPAIR_SUFFIX, buildDeepPrompt, validateDeepRead,
  type DeepReadResult,
} from "@/lib/engine/deepRead";
import { resolveDeepProvider } from "@/lib/providers";
import type { ContextId, FamiliarityId } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TEMPERATURE = 0.15; // low, on purpose: this is a reading task, not a writing one
const TIMEOUT_MS = 45_000;
const MAX_CHARS = 12_000;

const json = (body: DeepReadResult, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  let text = "";
  let context: ContextId = "other";
  let youName: string | undefined;
  let familiarity: FamiliarityId = "year";

  try {
    const body = (await req.json()) as {
      text?: unknown; context?: unknown; youName?: unknown; familiarity?: unknown;
    };
    text = typeof body.text === "string" ? body.text : "";
    context = (typeof body.context === "string" ? body.context : "other") as ContextId;
    youName = typeof body.youName === "string" ? body.youName : undefined;
    familiarity = (typeof body.familiarity === "string" ? body.familiarity : "year") as FamiliarityId;
  } catch {
    return json({ ok: false, reason: "Malformed request." }, 400);
  }

  if (!text.trim()) return json({ ok: false, reason: "No conversation was sent." }, 400);
  if (text.length > MAX_CHARS) {
    return json({
      ok: false,
      reason: `That conversation is ${text.length.toLocaleString()} characters. The deep read is capped at ${MAX_CHARS.toLocaleString()} — paste the part you actually want read.`,
    });
  }

  // ── 1. THE HARD RULE, enforced server-side as well as client-side ──
  if (screenForDistress(text).triggered) {
    return json({
      ok: false,
      reason: "This conversation contains acute-distress markers. Subtext does not analyse those, on any tier.",
    });
  }

  const provider = resolveDeepProvider();
  if (!provider.configured) {
    return json({
      ok: false,
      reason: `No model provider is configured. Set ${provider.missingEnv.join(" or ")} on the server to enable the AI-assisted read. The on-device analysis is unaffected.`,
    });
  }

  // ── 2. the same on-device layer, recomputed here ──
  let transcript = segment(text);
  if (youName) transcript = setYou(transcript, youName);
  if (!transcript.messages.length) return json({ ok: false, reason: "Nothing parseable in that paste." });
  const signals = extractSignals(transcript);
  const prompt = buildDeepPrompt(transcript, context, signals, youName ?? "You", familiarity);

  // ── 3-5. call, validate, repair once, then give up honestly ──
  for (let attempt = 0; attempt < 2; attempt++) {
    let parsed: unknown;
    try {
      parsed = await callModel(provider, attempt === 0 ? prompt : prompt + REPAIR_SUFFIX);
    } catch (e) {
      // Deliberately not logging the error object: it would carry the prompt,
      // and the prompt is the user's conversation.
      const kind = e instanceof Error ? e.message.slice(0, 120) : "unknown";
      console.error(`[deep-read] provider call failed (${provider.provider}): ${kind}`);
      return json({
        ok: false,
        reason: `The ${provider.label} call did not complete (${kind}). Your on-device analysis is unaffected.`,
      });
    }

    const { read, repairs, fatal } = validateDeepRead(parsed, transcript);
    if (read) {
      return json({ ok: true, read, model: provider.model, provider: provider.label, repairs });
    }
    if (attempt === 1) {
      console.error(`[deep-read] validation failed twice: ${fatal}`);
      return json({
        ok: false,
        reason: `The model's answer failed grounding checks twice (${fatal}). Rather than show you an unsupported reading, Subtext is showing you nothing. The on-device analysis above stands.`,
        repairs,
      });
    }
  }

  return json({ ok: false, reason: "Unreachable." });
}

// ─────────────────────────────────────────────────────────────

type Provider = ReturnType<typeof resolveDeepProvider>;

async function callModel(p: Provider, prompt: string): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const raw = p.kind === "gemini" ? await callGemini(p, prompt, ctl.signal) : await callOpenAiCompatible(p, prompt, ctl.signal);
    return JSON.parse(stripFence(raw));
  } finally {
    clearTimeout(timer);
  }
}

/** Models like to wrap JSON in ```json fences even when told not to. */
function stripFence(s: string): string {
  const t = s.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/**
 * Gemini's native endpoint, because it is the only one of the free options
 * that will enforce a response SCHEMA rather than merely promise JSON. A
 * schema-constrained answer is one fewer class of failure for the validator
 * to catch.
 *
 * The model ladder is perishable by design — Google retires ids out from
 * under a pinned name — so a 404 or 503 walks to the next rung rather than
 * failing the request.
 */
async function callGemini(p: Provider, prompt: string, signal: AbortSignal): Promise<string> {
  let lastError = "no model responded";
  for (const model of p.ladder) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": p.apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: TEMPERATURE,
            topP: 0.9,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            responseSchema: DEEP_READ_SCHEMA,
          },
        }),
      }
    );

    if (res.status === 404 || res.status === 503) {
      lastError = `${model} → HTTP ${res.status}`;
      continue; // retired or unavailable: next rung
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${model}`);

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const out = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
    if (!out.trim()) {
      lastError = `${model} returned an empty candidate`;
      continue;
    }
    p.model = model;
    return out;
  }
  throw new Error(lastError);
}

/**
 * Groq / OpenAI / Ollama all speak the OpenAI chat-completions wire format,
 * which is what lets one provider seam cover four of them. Only json_object
 * is available here, not a schema — so the validator does more of the work.
 */
async function callOpenAiCompatible(p: Provider, prompt: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: p.model,
      temperature: TEMPERATURE,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You return ONLY a single JSON object matching the requested shape. No prose, no markdown fence, no commentary.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${p.label}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const out = data.choices?.[0]?.message?.content ?? "";
  if (!out.trim()) throw new Error(`${p.label} returned an empty completion`);
  return out;
}
