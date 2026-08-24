import { createHash, createSign } from "node:crypto";

const PACKAGE_NAME = "com.neonjungle.subtext";
const PRODUCT_ID = "answer_coach_premium";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_AUD = "https://oauth2.googleapis.com/token";

interface ServiceAccount { client_email: string; private_key: string }
let cachedAccess: { token: string; until: number } | null = null;

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function serviceAccount(): ServiceAccount | null {
  const configured = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!configured) return null;
  try {
    const decoded = configured.startsWith("{") ? configured : Buffer.from(configured, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedAccess && cachedAccess.until > Date.now() + 60_000) return cachedAccess.token;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iss: account.client_email, scope: GOOGLE_SCOPE, aud: GOOGLE_AUD, iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${base64url(signer.sign(account.private_key))}`;
  const response = await fetch(GOOGLE_AUD, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google OAuth ${response.status}`);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google OAuth returned no access token");
  cachedAccess = { token: data.access_token, until: Date.now() + Math.max(300, data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

export interface EntitlementProof { packageName?: string; productId?: string; purchaseToken?: string }
export interface EntitlementResult { ok: boolean; reason?: "not_configured" | "invalid" | "inactive" | "unavailable"; subjectHash?: string }

export async function verifyPlayEntitlement(proof: EntitlementProof): Promise<EntitlementResult> {
  if (proof.packageName !== PACKAGE_NAME || proof.productId !== PRODUCT_ID || !proof.purchaseToken?.trim()) return { ok: false, reason: "invalid" };
  const account = serviceAccount();
  if (!account) return { ok: false, reason: "not_configured" };
  const subjectHash = createHash("sha256").update(proof.purchaseToken).digest("hex").slice(0, 24);
  try {
    const token = await accessToken(account);
    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(proof.purchaseToken)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (response.status === 404 || response.status === 400) return { ok: false, reason: "invalid" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const data = (await response.json()) as { subscriptionState?: string; lineItems?: { productId?: string; expiryTime?: string }[] };
    const activeState = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(data.subscriptionState ?? "");
    const activeLine = (data.lineItems ?? []).some((line) => line.productId === PRODUCT_ID && Date.parse(line.expiryTime ?? "") > Date.now());
    return activeState && activeLine ? { ok: true, subjectHash } : { ok: false, reason: "inactive", subjectHash };
  } catch {
    return { ok: false, reason: "unavailable", subjectHash };
  }
}
