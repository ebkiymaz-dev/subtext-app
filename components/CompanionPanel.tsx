"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyze, type AnalyzeResult } from "../lib/engine/analyze";
import { segment } from "../lib/engine/segment";
import { focusedTranscript } from "../lib/group-chat";
import { adaptAnalysisForPost } from "../lib/engine/post";
import { assessEnglishReadiness } from "../lib/language-support";
import { screenForDistress } from "../lib/engine/distress";
import { CONTEXTS } from "../lib/engine/relationship";
import type { ContextId } from "../lib/engine/types";
import type { PersonalizedCoachResult } from "../lib/engine/answerCoach";
import type { PlayEntitlementProof } from "../lib/playBilling";

export interface CompanionTransport {
  disclosure(): Promise<{ configured?: boolean; label?: string; privacy?: string }>;
  session(): Promise<{ ok: boolean; token?: string; remaining?: number; reason?: string; entitlement?: PlayEntitlementProof }>;
  coach(body: Record<string, unknown>): Promise<PersonalizedCoachResult>;
  copy(text: string): Promise<void>;
}

/** Same local engine and reviewed transcript for the browser and Android panel. */
export default function CompanionPanel({ initialText = "", source = "Shared conversation", transport, onScan, onClose, status = "" }: {
  initialText?: string; source?: string; transport: CompanionTransport;
  onScan?: () => void; onClose?: () => void; status?: string;
}) {
  const [text, setText] = useState(initialText);
  const [you, setYou] = useState("");
  const [focus, setFocus] = useState("");
  const [context, setContext] = useState<ContextId>("other");
  const [post, setPost] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [english, setEnglish] = useState(false);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [coach, setCoach] = useState<PersonalizedCoachResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("direct");
  const [provider, setProvider] = useState<{ label: string; privacy: string } | null>(null);
  useEffect(() => {
    let active = true;
    transport.disclosure().then(value => {
      if (active && value?.configured && value.label) setProvider({ label: value.label, privacy: value.privacy || "" });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [transport]);
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => () => { generation.current += 1; }, []);
  const transcript = useMemo(() => segment(text), [text]);
  const identified = transcript.format === "named" || transcript.format === "whatsapp";
  const ready = confirmed && text.trim().length > 0 && (post || (identified && you !== focus && transcript.names.includes(you) && transcript.names.includes(focus)));
  const prepared = post ? text : focusedTranscript(transcript, {}, {}, you, focus);

  function invalidate() {
    generation.current += 1;
    setResult(null); setCoach(null); setMessage(""); setConsent(false);
  }
  async function read() {
    const ticket = generation.current;
    const distress = screenForDistress(text);
    if (distress.triggered) { setResult({ kind: "distress", distress }); return; }
    const language = await assessEnglishReadiness(prepared);
    if (ticket !== generation.current) return;
    if (language.status === "non_english" || (!english && language.status !== "english")) {
      setMessage(language.status === "non_english" ? "The local interpretation currently supports English. Names can use any script. Use the full reader for language options." : "This sample is short. Confirm the messages are English below, then read again.");
      return;
    }
    const next = analyze(prepared, context, you || undefined, "days");
    if (next.kind === "analysis" && post) next.analysis = adaptAnalysisForPost(next.analysis);
    setMessage(""); setResult(next);
  }
  async function generate() {
    if (!ready || !consent || !provider || result?.kind !== "analysis" || inFlight.current) return;
    inFlight.current = true; setBusy(true); setCoach(null);
    const ticket = generation.current;
    try {
      const session = await transport.session();
      if (ticket !== generation.current) return;
      if (!session.ok || (!session.token && !session.entitlement)) { setMessage(session.reason || "AnswerAce is unavailable."); return; }
      setRemaining(session.remaining ?? null);
      if (session.remaining === 0) { setMessage("Your three free uses are used or currently running this month. Your local reads remain free."); return; }
      const answer = await transport.coach({ text: prepared, context, familiarity: "days", youName: post ? "You" : you, inputKind: post ? "message" : "conversation", goal: "reply", tone, freeToken: session.token, entitlement: session.entitlement });
      if (ticket !== generation.current) return;
      setCoach(answer);
      const refreshed = await transport.session();
      if (ticket === generation.current && refreshed.ok) setRemaining(refreshed.remaining ?? null);
    } catch { if (ticket === generation.current) setMessage("Could not reach AnswerAce. Your local read is still here."); }
    finally { inFlight.current = false; if (ticket === generation.current) setBusy(false); }
  }
  return <section className="sbt-companion" aria-label="Subtext conversation assistant">
    <header><strong>Subtext</strong><span>Right here with you</span>{onClose && <button aria-label="Close Subtext panel" onClick={onClose}>×</button>}</header>
    <main>
      <p className="sbt-caption">{source} · Only the text you review is analyzed.</p>
      {onScan && <button className="sbt-primary" onClick={onScan} disabled={busy}>Scan conversation</button>}
      {status && <p role="status">{status}</p>}
      <label>Review the captured text<textarea value={text} maxLength={12000} rows={7} placeholder="Name: Message…" disabled={busy} onChange={e => { invalidate(); setText(e.target.value); setConfirmed(false); setYou(""); setFocus(""); }} /></label>
      <p className="sbt-caption">Correct names using “Name: message”. Consecutive messages may belong to the same person.</p>
      {!post && text.trim() && !identified && <p role="status">Speaker names were not identified. Add “Name:” before each message, or choose single email/post. Subtext will not guess speakers by alternating lines.</p>}
      <label><input type="checkbox" checked={post} disabled={busy} onChange={e => { invalidate(); setPost(e.target.checked); setConfirmed(false); }} /> A single email or post</label>
      {!post && <div className="sbt-pair"><label>Your name<select value={you} disabled={busy} onChange={e => { invalidate(); setYou(e.target.value); setConfirmed(false); }}><option value="">Choose…</option>{transcript.names.map(name => <option key={name}>{name}</option>)}</select></label><label>Reading whose side?<select value={focus} disabled={busy} onChange={e => { invalidate(); setFocus(e.target.value); setConfirmed(false); }}><option value="">Choose…</option>{transcript.names.filter(name => name !== you).map(name => <option key={name}>{name}</option>)}</select></label></div>}
      {transcript.names.length > 2 && !post && <p className="sbt-caption">Group detected. This compact read compares the selected two people; other messages are excluded. Use the full reader for complete group context.</p>}
      <label>Context<select value={context} disabled={busy} onChange={e => { invalidate(); setContext(e.target.value as ContextId); }}>{Object.entries(CONTEXTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      <label><input type="checkbox" disabled={busy} checked={confirmed} onChange={e => { invalidate(); setConfirmed(e.target.checked); }} /> I checked the text{post ? "" : " and speakers"}.</label>
      <label><input type="checkbox" checked={english} onChange={e => setEnglish(e.target.checked)} /> The message text is English</label>
      <button className="sbt-primary" disabled={!ready || busy} onClick={read}>Read this conversation · Free</button>
      {message && <p role="status">{message}</p>}
      {result?.kind === "distress" && <div role="alert" className="sbt-card"><h2>Pause here</h2><p>{result.distress.mode === "interpersonal_danger" ? "These messages may involve threats or coercion. You do not owe a reply. Preserve evidence if safe and contact someone you trust or local support." : "These messages may involve immediate distress. Reach out to someone you trust or local crisis support. If someone is in immediate danger, contact local emergency services."}</p></div>}
      {result?.kind === "analysis" && <>
        <article className="sbt-card"><h2>Your short read</h2><p>{result.analysis.headline}</p></article>
        <section className="sbt-ace"><h2>✦ AnswerAce</h2><p>Get 2–3 editable reply options.</p><p className="sbt-caption">3 free generations each calendar month per installation. {remaining !== null ? `${remaining} available now.` : "Availability is checked when you request a reply."} Failed generations do not use your allowance.</p>
          <>
          <label>Reply tone<select value={tone} disabled={busy} onChange={e => setTone(e.target.value)}><option value="direct">Direct and calm</option><option value="warm">Warm</option><option value="brief">Brief</option></select></label>
          <p className="sbt-caption">{provider ? `${provider.label}: ${provider.privacy}` : "AnswerAce is unavailable until its provider and data terms can be verified."}</p>
          <label><input type="checkbox" disabled={busy || !provider} checked={consent} onChange={e => setConsent(e.target.checked)} /> Send this reviewed text to Subtext and {provider?.label || "its AI provider"} for AnswerAce. The local read does not upload it.</label>
          <button className="sbt-primary" onClick={generate} disabled={!consent || !provider || busy}>{busy ? "Preparing replies…" : "Generate my AnswerAce replies"}</button>
          <a href="https://neonjungletools.com/subtext/plans/" target="_blank" rel="noreferrer">See AnswerAce plans</a>
          </>
          {coach?.reason && <p role="status">{coach.reason}</p>}
          {coach?.coach && <><p>{coach.coach.recommendedApproach}</p>{coach.coach.replies.map((reply, i) => <article className="sbt-card" key={i}><strong>{reply.exposure}</strong><p>{reply.text}</p><button onClick={async () => { try { await transport.copy(reply.text); setMessage("Reply copied. Review it before sending."); } catch { setMessage("Copy was unavailable. Select the reply text and copy it manually."); } }}>Copy reply</button></article>)}<p>{coach.coach.actionPlan.after}</p></>}
        </section>
        <details><summary>See the conversation signals</summary><p className="sbt-caption">{post ? "The author's wording" : `${you} → ${focus}: signals describe ${focus}'s messages`}. These are language markers, not probabilities of feelings.</p>{result.analysis.categories.filter(c => !c.thin).slice(0, 5).map(c => <div className="sbt-card" key={c.id}><strong>{c.label}: {c.percent}%</strong><p>{c.read}</p></div>)}</details>
      </>}
      <a href="https://neonjungletools.com/subtext/" target="_blank" rel="noreferrer">Open full Subtext</a>
    </main>
  </section>;
}
