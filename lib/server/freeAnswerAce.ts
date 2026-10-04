import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { remotePost } from "./requestControl";

function secret() {
  const key = process.env.REQUEST_CONTROL_HMAC_SECRET ?? "";
  if (key.length < 32) throw new Error("AnswerAce identity is not configured");
  return key;
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(`subtext-free-answerace-v1:${value}`).digest("hex");
}
export function issueFreeIdentity(now = Date.now()): string {
  const payload = `${randomBytes(24).toString("hex")}.${Math.floor(now / 1000)}`;
  return `${payload}.${sign(payload)}`;
}
export function verifyFreeIdentity(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string" || !/^[a-f0-9]{48}\.\d{10}\.[a-f0-9]{64}$/.test(value)) return null;
  const [id, issued, signature] = value.split(".");
  const age = now / 1000 - Number(issued);
  if (age < -60 || age > 366 * 86400) return null;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(`${id}.${issued}`), "hex"))) return null;
  return createHash("sha256").update(`answerace-install:${id}`).digest("hex");
}
export interface FreeAllowance { allowed: boolean; remaining: number; month: string; token?: string }
export function freeAllowance(subject: string, operation: "status" | "reserve" | "commit" | "release", token?: string) {
  return remotePost<FreeAllowance>("/v1/request-control/answerace-allowance", { subject_hash: subject, operation, ...(token ? { token } : {}) });
}
