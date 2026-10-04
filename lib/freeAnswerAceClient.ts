import { withBase } from "./basePath";

interface FreeSession { ok: boolean; token?: string; remaining?: number; reason?: string }
let pending: Promise<FreeSession> | null = null;
let memoryToken: string | undefined;
let generation = 0;
export function clearFreeAnswerAceIdentity() { generation++; memoryToken = undefined; }
/** A bearer recovery code for a paid web pass; never send it to analytics or logs. */
export async function getFreeAnswerAceRecoveryCode(): Promise<string | null> {
  const session = await getFreeAnswerAceSession();
  return session.ok ? session.token ?? null : null;
}
export async function restoreFreeAnswerAceIdentity(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{48}\.\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const response = await fetch(withBase("/api/answer-ace-session"), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json() as FreeSession;
  if (!response.ok || !result.ok || result.token !== token) return false;
  // A valid free-installation token is not necessarily a paid recovery code.
  // Check the candidate before replacing this browser's current identity.
  const accessResponse = await fetch(withBase("/api/solana-checkout"), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "entitlement", token }),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const access = await accessResponse.json() as { ok?: boolean; active?: boolean };
  if (!accessResponse.ok || !access.ok || !access.active) return false;
  generation++;
  memoryToken = token;
  try { localStorage.setItem("subtext.answerace.identity.v1", token); } catch { /* memory-only fallback */ }
  return true;
}
export function getFreeAnswerAceSession(): Promise<FreeSession> {
  if (pending) return pending;
  pending = (async () => {
    const ticket = generation;
    let token = memoryToken;
    try { token = localStorage.getItem("subtext.answerace.identity.v1") || token; } catch { /* memory-only fallback */ }
    const response = await fetch(withBase("/api/answer-ace-session"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as FreeSession;
    if (ticket !== generation) return { ok: false, reason: "Local Subtext data was erased. Start again when ready." };
    if (result.ok && result.token) {
      memoryToken = result.token;
      try { localStorage.setItem("subtext.answerace.identity.v1", result.token); } catch { /* no conversation is stored */ }
    }
    return result;
  })().finally(() => { pending = null; });
  return pending;
}
