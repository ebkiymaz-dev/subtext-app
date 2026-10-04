import { remotePost } from "./requestControl";
import { verifyFreeIdentity } from "./freeAnswerAce";
import { resolveCoachProvider } from "../providers";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOLANA_PASS_DAYS = 30;

type Asset = "USDC" | "SOL";
interface Config { recipient: string; asset: Asset; amount: string; amountMinor: number }
export interface Order { order_id: string; reference: string; recipient: string; asset: Asset; mint: string | null; amount_minor: number; expires_at: string }
export interface PaymentStatus { status: "pending" | "expired" | "paid"; signature?: string | null }

function parseAmount(raw: string, places: number): number | null {
  if (!/^[1-9]\d{0,6}(?:\.\d{1,9})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.length > places) return null;
  const amount = Number(whole) * 10 ** places + Number(fraction.padEnd(places, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function solanaConfig(): Config | null {
  if (process.env.SUBTEXT_SOLANA_CHECKOUT_ENABLED !== "true" || process.env.SUBTEXT_SOLANA_ENTITLEMENT_ENABLED !== "true") return null;
  // Do not accept payment when AnswerAce cannot deliver the paid service.
  if (!resolveCoachProvider().configured) return null;
  const recipient = process.env.SUBTEXT_SOLANA_RECEIVING_WALLET ?? "";
  const asset = process.env.SUBTEXT_SOLANA_ASSET === "SOL" ? "SOL" : "USDC";
  const amount = process.env.SUBTEXT_SOLANA_AMOUNT ?? "";
  const amountMinor = parseAmount(amount, asset === "USDC" ? 6 : 9);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(recipient) || !amountMinor) return null;
  return { recipient, asset, amount, amountMinor };
}

export function subjectForToken(value: unknown): string | null {
  return verifyFreeIdentity(value);
}

export function paymentUrl(order: Order): string {
  const places = order.asset === "USDC" ? 6 : 9;
  const whole = Math.floor(order.amount_minor / 10 ** places);
  const fractional = String(order.amount_minor % 10 ** places).padStart(places, "0").replace(/0+$/, "");
  const amount = fractional ? `${whole}.${fractional}` : String(whole);
  const params = new URLSearchParams({ amount, reference: order.reference, label: "Subtext AnswerAce", message: "30-day AnswerAce web pass" });
  if (order.asset === "USDC") params.set("spl-token", USDC_MINT);
  return `solana:${order.recipient}?${params.toString()}`;
}

export async function createPaymentOrder(subject: string, config: Config): Promise<Order> {
  return remotePost<Order>("/v1/subtext-solana/order", {
    subject_hash: subject, recipient: config.recipient, asset: config.asset, amount_minor: config.amountMinor,
  });
}

export function checkPaymentOrder(subject: string, orderId: string, settle = false): Promise<PaymentStatus> {
  return remotePost<PaymentStatus>(settle ? "/v1/subtext-solana/settle" : "/v1/subtext-solana/status", {
    subject_hash: subject, order_id: orderId,
  });
}

export function paidWebEntitlement(subject: string): Promise<{ active: boolean; paid_until: string | null }> {
  return remotePost("/v1/subtext-solana/entitlement", { subject_hash: subject });
}
