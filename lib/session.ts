// Stateless, edge-safe session crypto. Uses ONLY Web Crypto + TextEncoder globals
// so this module is importable from both edge middleware and node server actions.
// Do NOT import next/headers or node:* here.

export const COOKIE_NAME = "beanstalk_admin";
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string compare. Returns false on length mismatch (callers that
// must hide length compare fixed-length HMAC hex — see verifyPassword).
// For raw variable-length secrets in Node-runtime code use lib/auth.ts
// timingSafeEqualStr instead; this XOR loop is only safe because callers
// compare pre-hashed fixed-length hex.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toHex(sig);
}

// Cookie value = "<issuedAt>.<hmac(issuedAt)>". Stateless: no server-side store.
export async function createSessionValue(secret: string, issuedAt: number): Promise<string> {
  return `${issuedAt}.${await hmacHex(secret, String(issuedAt))}`;
}

// Never throws. Rejects missing/garbage, bad signatures, expired, and future-dated values.
export async function verifySessionValue(
  secret: string,
  value: string | undefined,
  maxAgeMs: number,
  now: number,
): Promise<boolean> {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const issuedAtStr = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^\d+$/.test(issuedAtStr)) return false;
  const issuedAt = Number(issuedAtStr);
  const age = now - issuedAt;
  if (age < 0 || age > maxAgeMs) return false;
  const expected = await hmacHex(secret, issuedAtStr);
  return timingSafeEqual(sig, expected);
}

// Compares HMACs (fixed 64-char hex) rather than raw strings so password length
// is not leaked by an early length-mismatch return.
export async function verifyPassword(
  secret: string,
  submitted: string,
  expected: string,
): Promise<boolean> {
  if (!expected) return false;
  const a = await hmacHex(secret, submitted);
  const b = await hmacHex(secret, expected);
  return timingSafeEqual(a, b);
}
