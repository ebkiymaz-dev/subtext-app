import { withBase } from "./basePath";
import { getFreeAnswerAceSession } from "./freeAnswerAceClient";

export interface SolanaOrder { ok: true; orderId: string; url: string; recipient: string; reference: string; asset: "USDC" | "SOL"; amount: string; expiresAt: string }
export interface SolanaCheckoutState { enabled: boolean; recoveryEnabled?: boolean; asset?: "USDC" | "SOL"; amount?: string; days?: number }

export async function checkoutState(): Promise<SolanaCheckoutState> {
  const response = await fetch(withBase("/api/solana-checkout"), { cache: "no-store" });
  return await response.json() as SolanaCheckoutState;
}

export async function checkoutAction<T>(action: "create" | "status" | "settle" | "entitlement", orderId?: string): Promise<T> {
  const session = await getFreeAnswerAceSession();
  if (!session.ok || !session.token) throw new Error(session.reason || "Subtext session is unavailable.");
  const response = await fetch(withBase("/api/solana-checkout"), {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ action, orderId, token: session.token }), signal: AbortSignal.timeout(20000),
  });
  const value = await response.json() as T & { ok?: boolean; reason?: string };
  if (!response.ok || !value.ok) throw new Error(value.reason || "The payment could not be verified.");
  return value;
}
