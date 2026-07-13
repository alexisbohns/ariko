import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_NAME,
  MAX_AGE_MS,
  createSessionValue,
  verifySessionValue,
} from "@/lib/session";

// True when a valid, unexpired session cookie is present. Fail closed on missing env.
export async function isAuthenticated(): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return verifySessionValue(secret, value, MAX_AGE_MS, Date.now());
}

// For server actions: redirect to login unless authenticated (defense in depth —
// middleware already gates navigation, but a server-action POST must re-check).
export async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/admin/login");
}

// Mints and sets the signed session cookie. Call only from a server action.
export async function setSessionCookie(): Promise<void> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  const value = await createSessionValue(secret, Date.now());
  (await cookies()).set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(MAX_AGE_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
