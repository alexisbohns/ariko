# Beanstalk Admin UI — Plan 2b-i: Auth + Capture + Inbox View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first admin-UI slice — a password-gated `/admin` zone with a zero-JS quick-capture bar and a read-only inbox table — reusing the Plan 2a ingestion seam and touching no new write paths.

**Architecture:** A stateless HMAC-signed session cookie (pure Web Crypto in `lib/session.ts`, so it runs in both edge middleware and node server actions) gates `/admin/*` via `middleware.ts`. The admin screen is a server component with native `<form>`s posting to Next.js **Server Actions**; the capture action maps the form into the exact raw payload `/api/inbox` accepts, runs it through the existing `validateInboxPayload`, and calls `createOrUpdateCapture`. No client JavaScript, no CSS.

**Tech Stack:** Next.js 15 App Router (server components, server actions, middleware), React 19, TypeScript, MongoDB (`mongodb` driver, via existing `lib/captures`), Web Crypto (`crypto.subtle`), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-07-13-beanstalk-admin-ui-2b-i-design.md`

**Conventions carried from Plans 1 & 2a:**
- Tests live under `lib/` and run via `npm test` = `node --import tsx --test "lib/**/*.test.ts"`. Pure `lib/*.test.ts` need no DB and must stay green in the default run.
- App code (under `app/`) imports lib via the `@/*` path alias (e.g. `@/lib/session`), matching existing pages like `app/page.tsx` (`import { getPublicDataset } from "@/lib/store"`). Lib **test** files import by relative path (`./session`).
- `middleware.ts` runs in the **edge runtime** — it must import only edge-safe modules. `lib/session.ts` therefore uses **only** globals (`crypto.subtle`, `TextEncoder`) and imports nothing from `next/headers` or `node:*`. The `cookies()`-based helpers live in a separate `app/admin/session.ts` that middleware never imports.
- Secrets go only in `.env.local` (gitignored). The Next dev/build process loads `.env.local` automatically.

---

## File Structure

- `lib/session.ts` — **create.** Pure, edge-safe session crypto: `hmacHex`, `timingSafeEqual`, `createSessionValue`, `verifySessionValue`, `verifyPassword`, and the `COOKIE_NAME` / `MAX_AGE_MS` constants. No `next/headers`, no `node:*`.
- `lib/session.test.ts` — **create.** Pure unit tests (round-trip, tamper, wrong-secret, expiry, future-dated, garbage, password match).
- `lib/capture-form.ts` — **create.** Pure `buildCaptureBody(form: FormData) → RawCaptureBody` mapping the capture form into the raw ingestion body shape.
- `lib/capture-form.test.ts` — **create.** Pure unit tests, including cross-checks that the output feeds `validateInboxPayload` correctly.
- `app/admin/session.ts` — **create.** Server-only `next/headers` wrappers: `isAuthenticated()`, `requireSession()`, `setSessionCookie()`, `clearSessionCookie()`. Imported by pages and actions, never by middleware.
- `app/admin/actions.ts` — **create.** `"use server"` module: `loginAction`, `logoutAction`, `createCaptureAction`.
- `app/admin/login/page.tsx` — **create.** Login form (server component).
- `app/admin/page.tsx` — **create.** The admin screen: capture bar + logout + read-only inbox table (server component).
- `middleware.ts` — **create.** Edge middleware gating `/admin/:path*` (except `/admin/login`).
- `.env.local` — **modify (local only, gitignored).** Add `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.
- `README.md` — **modify.** Document the admin zone, env vars, and the smoke test.

**Untouched:** `app/api/inbox/route.ts`, `app/api/upload/route.ts`, `lib/captures.ts`, `lib/inbox.ts`, `lib/embeds.ts`, `app/layout.tsx`, and the entire public zone.

---

## Task 0: Local env secrets

**Files:**
- Modify: `.env.local` (local only, gitignored)

- [ ] **Step 1: Add the two admin secrets**

Append to `.env.local` (NOT committed — it is gitignored). Use any opaque strings:
```
ADMIN_PASSWORD=change-me-to-a-real-password
ADMIN_SESSION_SECRET=a-long-random-hex-string-at-least-32-chars
```
`ADMIN_PASSWORD` is what you type at the login form. `ADMIN_SESSION_SECRET` signs the cookie — pick a long random value (e.g. `openssl rand -hex 32`).

- [ ] **Step 2: Confirm they load (no commit — env is gitignored)**

Run:
```bash
node --env-file=.env.local -e "console.log(!!process.env.ADMIN_PASSWORD, !!process.env.ADMIN_SESSION_SECRET)"
```
Expected: `true true`. Nothing to commit in this task.

---

## Task 1: Session crypto core — `lib/session.ts` (pure, TDD)

**Files:**
- Create: `lib/session.ts`
- Test: `lib/session.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/session.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hmacHex,
  timingSafeEqual,
  createSessionValue,
  verifySessionValue,
  verifyPassword,
  MAX_AGE_MS,
} from "./session";

const SECRET = "test-secret-abc";
const NOW = 1_700_000_000_000; // fixed clock for determinism

test("hmacHex is deterministic and hex-encoded", async () => {
  const a = await hmacHex(SECRET, "hello");
  const b = await hmacHex(SECRET, "hello");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/); // SHA-256 → 32 bytes → 64 hex chars
});

test("hmacHex differs for a different secret", async () => {
  const a = await hmacHex(SECRET, "hello");
  const b = await hmacHex("other-secret", "hello");
  assert.notEqual(a, b);
});

test("timingSafeEqual compares by content, false on length mismatch", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "abcd"), false);
});

test("createSessionValue / verifySessionValue round-trip", async () => {
  const value = await createSessionValue(SECRET, NOW);
  assert.match(value, /^\d+\.[0-9a-f]{64}$/);
  assert.equal(await verifySessionValue(SECRET, value, MAX_AGE_MS, NOW), true);
});

test("a tampered signature is rejected", async () => {
  const value = await createSessionValue(SECRET, NOW);
  const tampered = value.slice(0, -1) + (value.endsWith("0") ? "1" : "0");
  assert.equal(await verifySessionValue(SECRET, tampered, MAX_AGE_MS, NOW), false);
});

test("a tampered issuedAt (reused old signature) is rejected", async () => {
  const value = await createSessionValue(SECRET, NOW);
  const sig = value.slice(value.indexOf(".") + 1);
  const forged = `${NOW + 5000}.${sig}`;
  assert.equal(await verifySessionValue(SECRET, forged, MAX_AGE_MS, NOW + 5000), false);
});

test("a value signed with a different secret is rejected", async () => {
  const value = await createSessionValue("other-secret", NOW);
  assert.equal(await verifySessionValue(SECRET, value, MAX_AGE_MS, NOW), false);
});

test("an expired value is rejected", async () => {
  const value = await createSessionValue(SECRET, NOW);
  assert.equal(await verifySessionValue(SECRET, value, MAX_AGE_MS, NOW + MAX_AGE_MS + 1), false);
});

test("a future-dated value is rejected", async () => {
  const value = await createSessionValue(SECRET, NOW + 10_000);
  assert.equal(await verifySessionValue(SECRET, value, MAX_AGE_MS, NOW), false);
});

test("garbage / missing values are rejected, never throw", async () => {
  assert.equal(await verifySessionValue(SECRET, undefined, MAX_AGE_MS, NOW), false);
  assert.equal(await verifySessionValue(SECRET, "", MAX_AGE_MS, NOW), false);
  assert.equal(await verifySessionValue(SECRET, "no-dot", MAX_AGE_MS, NOW), false);
  assert.equal(await verifySessionValue(SECRET, "123", MAX_AGE_MS, NOW), false);
  assert.equal(await verifySessionValue(SECRET, "abc.def", MAX_AGE_MS, NOW), false);
});

test("verifyPassword matches only the correct password (length-hidden)", async () => {
  assert.equal(await verifyPassword(SECRET, "hunter2", "hunter2"), true);
  assert.equal(await verifyPassword(SECRET, "hunter2", "hunter3"), false);
  assert.equal(await verifyPassword(SECRET, "", "hunter2"), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `./session` cannot be found.

- [ ] **Step 3: Implement `lib/session.ts`**

Create `lib/session.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all `session` tests green; existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/session.ts lib/session.test.ts
git commit -m "feat: stateless HMAC session crypto (edge-safe)"
```

---

## Task 2: Capture-form mapping — `lib/capture-form.ts` (pure, TDD)

**Files:**
- Create: `lib/capture-form.ts`
- Test: `lib/capture-form.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/capture-form.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCaptureBody } from "./capture-form";
import { validateInboxPayload } from "./inbox";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("maps title + en note into the raw ingestion body", () => {
  const body = buildCaptureBody(form([["title", "Hi"], ["note", "hello"], ["lang", "en"]]));
  assert.equal(body.title, "Hi");
  assert.deepEqual(body.body, { en: "hello" });
  assert.deepEqual(body.media, []);
  assert.deepEqual(body.source, { kind: "manual" });
});

test("routes the note into the fr locale when lang=fr", () => {
  const body = buildCaptureBody(form([["title", "Salut"], ["note", "bonjour"], ["lang", "fr"]]));
  assert.deepEqual(body.body, { fr: "bonjour" });
});

test("defaults lang to en when the field is missing or unexpected", () => {
  const body = buildCaptureBody(form([["title", "Hi"], ["note", "hello"]]));
  assert.deepEqual(body.body, { en: "hello" });
});

test("omits body entirely when the note is blank", () => {
  const body = buildCaptureBody(form([["title", "Hi"], ["note", "   "]]));
  assert.equal(body.body, undefined);
});

test("trims the title", () => {
  const body = buildCaptureBody(form([["title", "  Hi  "]]));
  assert.equal(body.title, "Hi");
});

test("turns each non-blank link into a bare embed and drops blanks", () => {
  const body = buildCaptureBody(
    form([
      ["title", "Hi"],
      ["link", "https://youtu.be/abc123"],
      ["link", "   "],
      ["link", "https://example.com/x"],
    ]),
  );
  assert.deepEqual(body.media, [
    { kind: "embed", url: "https://youtu.be/abc123" },
    { kind: "embed", url: "https://example.com/x" },
  ]);
});

test("output of a valid form passes validateInboxPayload with providers detected", () => {
  const body = buildCaptureBody(form([["title", "Hi"], ["link", "https://youtu.be/abc123"]]));
  const r = validateInboxPayload(body);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.media[0].kind, "embed");
    if (r.value.media[0].kind === "embed") {
      assert.equal(r.value.media[0].provider, "youtube");
      assert.equal(r.value.media[0].embedId, "abc123");
    }
  }
});

test("a blank title yields a body that validateInboxPayload rejects", () => {
  const body = buildCaptureBody(form([["title", "   "]]));
  assert.equal(body.title, "");
  assert.equal(validateInboxPayload(body).ok, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `./capture-form` cannot be found.

- [ ] **Step 3: Implement `lib/capture-form.ts`**

Create `lib/capture-form.ts`:
```ts
import type { LocalizedText } from "./data";

// The raw body shape /api/inbox accepts. Embeds are bare (no provider) — provider
// detection happens later in validateInboxPayload → normalizeMedia → detectEmbed.
export interface RawCaptureBody {
  title: string;
  body?: LocalizedText;
  media: Array<{ kind: "embed"; url: string }>;
  source: { kind: "manual" };
}

// Pure. Maps the admin capture <form> into the raw ingestion body. Empty note ⇒
// no body; blank link fields dropped; title trimmed (may be "" — the downstream
// validateInboxPayload guard rejects an empty title).
export function buildCaptureBody(form: FormData): RawCaptureBody {
  const title = String(form.get("title") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  const lang = form.get("lang") === "fr" ? "fr" : "en";
  const media = form
    .getAll("link")
    .map((v) => String(v).trim())
    .filter((url) => url.length > 0)
    .map((url) => ({ kind: "embed" as const, url }));

  return {
    title,
    ...(note ? { body: { [lang]: note } as LocalizedText } : {}),
    media,
    source: { kind: "manual" },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all `capture-form` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/capture-form.ts lib/capture-form.test.ts
git commit -m "feat: pure capture-form to raw-ingestion-body mapping"
```

---

## Task 3: Server-only session helpers — `app/admin/session.ts`

**Files:**
- Create: `app/admin/session.ts`

This module wraps `lib/session.ts` with `next/headers` cookie access + redirect. It is imported by pages and server actions, **never by middleware** (importing `next/headers` into edge middleware is not allowed).

- [ ] **Step 1: Implement `app/admin/session.ts`**

Create `app/admin/session.ts`:
```ts
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
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no type errors. (No unit test — this is thin `next/headers` glue, covered by the Task 7 smoke test.)

- [ ] **Step 3: Commit**

```bash
git add app/admin/session.ts
git commit -m "feat: server-only admin session cookie helpers"
```

---

## Task 4: Server actions — `app/admin/actions.ts`

**Files:**
- Create: `app/admin/actions.ts`

- [ ] **Step 1: Implement `app/admin/actions.ts`**

Create `app/admin/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword } from "@/lib/session";
import { buildCaptureBody } from "@/lib/capture-form";
import { validateInboxPayload } from "@/lib/inbox";
import { createOrUpdateCapture } from "@/lib/captures";
import {
  requireSession,
  setSessionCookie,
  clearSessionCookie,
} from "./session";

// Verify the password, mint a session, land on /admin. Wrong password → back to
// login with an error flag. Fail closed if either secret is unset.
export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const secret = process.env.ADMIN_SESSION_SECRET;
  const expected = process.env.ADMIN_PASSWORD;
  if (!secret || !expected || !(await verifyPassword(secret, password, expected))) {
    redirect("/admin/login?error=1");
  }
  await setSessionCookie();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await requireSession();
  await clearSessionCookie();
  redirect("/admin/login");
}

// Map the form → raw body → the SAME validate + persist seam /api/inbox uses.
export async function createCaptureAction(formData: FormData): Promise<void> {
  await requireSession();
  const raw = buildCaptureBody(formData);
  const parsed = validateInboxPayload(raw);
  if (!parsed.ok) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error)}`);
  }
  await createOrUpdateCapture(parsed.value);
  revalidatePath("/admin");
  redirect("/admin");
}
```

Note: `redirect()` throws internally to interrupt execution, so the `!parsed.ok` branch needs no `return` — control never reaches `createOrUpdateCapture` after it. `parsed.value` is safely narrowed because that line is only reachable when `parsed.ok` is true.

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/actions.ts
git commit -m "feat: admin server actions (login, logout, capture)"
```

---

## Task 5: Login page — `app/admin/login/page.tsx`

**Files:**
- Create: `app/admin/login/page.tsx`

- [ ] **Step 1: Implement the login page**

Create `app/admin/login/page.tsx`:
```tsx
import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <article>
      <h1>Beanstalk admin</h1>
      <form action={loginAction}>
        <p>
          <label>
            Password <input type="password" name="password" required />
          </label>
        </p>
        <p>
          <button type="submit">Log in</button>
        </p>
      </form>
      {error ? <p role="alert">Incorrect password.</p> : null}
    </article>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/login/page.tsx
git commit -m "feat: admin login page"
```

---

## Task 6: Admin screen — `app/admin/page.tsx`

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Implement the admin screen**

Create `app/admin/page.tsx`. Bare semantic HTML — no CSS. Capture bar + logout on top, read-only inbox table below. Renders an error line from `?error=`, and a "couldn't load inbox" fallback if the DB read throws.
```tsx
import type { Capture } from "@/lib/data";
import { listCaptures } from "@/lib/captures";
import { createCaptureAction, logoutAction } from "./actions";

export const dynamic = "force-dynamic";

function noteSnippet(body: Capture["body"]): string {
  const text = body?.en ?? body?.fr ?? "";
  if (!text) return "—";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function mediaLabel(media: Capture["media"]): string {
  if (media.length === 0) return "—";
  if (media.length === 1) return `1 ${media[0].kind}`;
  return `${media.length} items`;
}

function ageLabel(createdAt: string, now: number): string {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let captures: Capture[] | null = null;
  try {
    captures = await listCaptures({ status: "inbox" });
  } catch {
    captures = null; // rendered as a load-failure line below
  }

  const now = Date.now();

  return (
    <article>
      <form action={logoutAction}>
        <button type="submit">Log out</button>
      </form>

      <h1>Capture</h1>
      {error ? <p role="alert">Could not save: {error}</p> : null}
      <form action={createCaptureAction}>
        <p>
          <label>
            Title <input type="text" name="title" required />
          </label>
        </p>
        <p>
          <label>
            Note <textarea name="note" rows={2} />
          </label>
        </p>
        <fieldset>
          <legend>Note language</legend>
          <label>
            <input type="radio" name="lang" value="en" defaultChecked /> en
          </label>
          <label>
            <input type="radio" name="lang" value="fr" /> fr
          </label>
        </fieldset>
        <p>
          <label>
            Link <input type="url" name="link" placeholder="paste a URL" />
          </label>
        </p>
        <p>
          <label>
            Link <input type="url" name="link" placeholder="another URL (optional)" />
          </label>
        </p>
        <p>
          <button type="submit">Add to inbox</button>
        </p>
      </form>

      <h2>Inbox {captures ? `(${captures.length})` : ""}</h2>
      {captures === null ? (
        <p role="alert">Couldn&apos;t load the inbox.</p>
      ) : captures.length === 0 ? (
        <p>Inbox empty.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>source</th>
              <th>title</th>
              <th>note</th>
              <th>media</th>
              <th>age</th>
            </tr>
          </thead>
          <tbody>
            {captures.map((c) => (
              <tr key={c.id}>
                <td>{c.source.kind}</td>
                <td>{c.title}</td>
                <td>{noteSnippet(c.body)}</td>
                <td>{mediaLabel(c.media)}</td>
                <td>{ageLabel(c.createdAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: admin capture bar + read-only inbox view"
```

---

## Task 7: Edge middleware — `middleware.ts`

**Files:**
- Create: `middleware.ts` (repo root, sibling of `app/`)

- [ ] **Step 1: Implement the middleware**

Create `middleware.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, MAX_AGE_MS, verifySessionValue } from "@/lib/session";

// Gate /admin/* on a valid session cookie. /admin/login is exempt (it mints the
// session). Runs in the edge runtime — only imports edge-safe lib/session.
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }
  const secret = process.env.ADMIN_SESSION_SECRET;
  const value = request.cookies.get(COOKIE_NAME)?.value;
  if (secret && (await verifySessionValue(secret, value, MAX_AGE_MS, Date.now()))) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: edge middleware gating the /admin zone"
```

---

## Task 8: Smoke test end-to-end + README note

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full test suite (no DB) — green or skipped**

Run:
```bash
npm test && npx tsc --noEmit
```
Expected: all pure tests PASS (including the new `session` and `capture-form` suites); DB-guarded tests skip; no type errors.

- [ ] **Step 2: Start the dev server**

Run:
```bash
npm run dev
```

- [ ] **Step 3: Auth gate — redirect when unauthenticated**

In a browser (or with curl following redirects), visit `http://localhost:3000/admin`.
Expected: redirected to `http://localhost:3000/admin/login`. Verify with curl:
```bash
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/admin
```
Expected: `307 http://localhost:3000/admin/login` (or `308`/`302` — any redirect to `/admin/login`).

- [ ] **Step 4: Wrong password is rejected**

At `/admin/login`, submit a wrong password.
Expected: back at `/admin/login` showing "Incorrect password." (URL has `?error=1`), no session cookie set.

- [ ] **Step 5: Correct password logs in and lands on /admin**

Submit the `ADMIN_PASSWORD` from your `.env.local`.
Expected: redirected to `/admin`; the capture bar and an (initially empty) inbox render; a `beanstalk_admin` cookie is set (httpOnly).

- [ ] **Step 6: Capture a title + a YouTube link**

In the capture bar, enter a title (e.g. `Smoke test capture`) and paste `https://youtu.be/dQw4w9WgXcQ` into a Link field, then submit.
Expected: page reloads on `/admin`; the new row appears in the inbox table with source `manual`, the title, `1 embed` in the media column, and a fresh age. Confirm the embed provider was detected:
```bash
node --env-file=.env.local -e "const {MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const db=c.db(process.env.MONGODB_DB);const d=await db.collection('captures').findOne({title:'Smoke test capture'});console.log(JSON.stringify(d.media));await c.close();})()"
```
Expected: media shows `"provider":"youtube"` and `"embedId":"dQw4w9WgXcQ"`.

- [ ] **Step 7: Log out re-gates the zone**

Click "Log out".
Expected: redirected to `/admin/login`; visiting `/admin` again redirects back to login (cookie cleared).

- [ ] **Step 8: Clean up the smoke-test capture**

Run:
```bash
node --env-file=.env.local -e "const {MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const db=c.db(process.env.MONGODB_DB);await db.collection('captures').deleteMany({title:'Smoke test capture'});await c.close();})()"
```

- [ ] **Step 9: Document the admin zone in the README**

Add a section to `README.md` describing:
- The new env vars: `ADMIN_PASSWORD` (login password) and `ADMIN_SESSION_SECRET` (HMAC signing key; use a long random value).
- `/admin` — the password-gated admin zone: quick-capture bar (title + en/fr note + link embeds) and a read-only inbox view. Zero client JS, bare functional HTML (no styling yet — artistic direction is deferred).
- `/admin/login` — the login gate; sets an httpOnly signed session cookie; middleware protects `/admin/*`.
- A note that triage/promote/publish (2b-ii) and the vault browser + revalidation (2b-iii) are the next slices.

- [ ] **Step 10: Commit**

```bash
git add README.md
git commit -m "docs: document the admin zone, auth env, and capture flow"
```

---

## Done — what Plan 2b-i delivers

- A password-gated `/admin` zone: login/logout with a stateless HMAC-signed httpOnly cookie, middleware protecting `/admin/*`, and defense-in-depth `requireSession()` on every mutating action.
- An always-present quick-capture bar (title + optional en/fr note + link embeds) that reuses the exact 2a ingestion seam (`validateInboxPayload` → `createOrUpdateCapture`) via a Server Action — zero client JavaScript.
- A read-only inbox table listing `status:"inbox"` captures newest-first.
- Pure, unit-tested session crypto and capture-form mapping; `/api/inbox`, `/api/upload`, and the public zone untouched.
- Bare functional HTML with no CSS — no design debt ahead of the project's artistic direction.

## Deferred to later 2b slices

- **2b-ii:** two-pane triage workspace; promote a capture → Version (first writes to `molecules`/`atoms`/`versions`); molecule/atom search-or-create; publish → the visibility cascade (pure `publishCascade`); `name`/`description` `string→Text` widening; capture-bar image attach + "media pending" UX; optional capture-form input-preservation on validation error.
- **2b-iii:** vault browser (browse/filter everything) + public-zone revalidation wired to the publish action.

## Notes / small risks to watch during execution

- **Node version / Web Crypto:** `lib/session.ts` relies on the global `crypto.subtle` and `TextEncoder`, and the tests use a global `FormData`. All are stable globals in Node 20+. If `npm test` errors with `crypto is not defined`, the runner is on an older Node — upgrade to Node ≥ 20.
- **`cookies()` is async in Next 15** — every call is `await cookies()`. The helpers already do this; keep it if editing.
- **Middleware import hygiene:** never import `app/admin/session.ts` (or anything pulling `next/headers`/`node:*`) into `middleware.ts` — it must stay edge-safe on `lib/session.ts` only.
