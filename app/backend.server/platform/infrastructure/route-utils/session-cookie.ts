import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "scholasticSession";

export interface SessionTokenPayload {
  userId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
}

export interface SessionCookieOptions {
  isProduction: boolean;
  ttlSeconds: number;
}

export interface ClearCookieOptions {
  isProduction: boolean;
}

function base64UrlEncode(data: Buffer | string): string {
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buffer.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string): Buffer | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
}

function computeSignature(payloadSegment: string, secret: string): Buffer {
  const hmac = createHmac("sha256", secret);
  hmac.update(payloadSegment);
  return hmac.digest();
}

export function signSessionToken(payload: SessionTokenPayload, secret: string): string {
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signature = computeSignature(payloadSegment, secret);
  return `${payloadSegment}.${base64UrlEncode(signature)}`;
}

export function verifySessionToken(token: string, secret: string): SessionTokenPayload | null {
  if (typeof token !== "string" || token.length === 0) return null;

  const segments = token.split(".");
  if (segments.length !== 2) return null;

  const [payloadSegment, signatureSegment] = segments;
  const providedSignature = base64UrlDecode(signatureSegment);
  if (!providedSignature) return null;

  const expectedSignature = computeSignature(payloadSegment, secret);
  if (providedSignature.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null;

  const payloadBuffer = base64UrlDecode(payloadSegment);
  if (!payloadBuffer) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(payloadBuffer.toString("utf8"));
  } catch {
    return null;
  }

  if (!isSessionTokenPayload(payload)) return null;
  if (payload.expiresAt <= Date.now()) return null;

  return payload;
}

function isSessionTokenPayload(value: unknown): value is SessionTokenPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number"
  );
}

function commonAttributes(isProduction: boolean): string {
  const attrs = ["HttpOnly", "SameSite=Lax", "Path=/"];
  if (isProduction) attrs.push("Secure");
  return attrs.join("; ");
}

export function serializeSessionCookie(token: string, opts: SessionCookieOptions): string {
  return `${SESSION_COOKIE_NAME}=${token}; ${commonAttributes(opts.isProduction)}; Max-Age=${opts.ttlSeconds}`;
}

export function serializeClearCookie(opts: ClearCookieOptions): string {
  return `${SESSION_COOKIE_NAME}=; ${commonAttributes(opts.isProduction)}; Max-Age=0`;
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;

  const cookies = header.split(";");
  for (const raw of cookies) {
    const trimmed = raw.trim();
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const name = trimmed.slice(0, eqIndex);
    if (name === SESSION_COOKIE_NAME) {
      return trimmed.slice(eqIndex + 1);
    }
  }
  return null;
}
