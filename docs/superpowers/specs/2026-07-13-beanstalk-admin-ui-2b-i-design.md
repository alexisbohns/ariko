# Beanstalk — Admin UI (Slice 2b-i): Auth + Capture + Inbox View — Design Spec

**Date:** 2026-07-13
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md` (Plan 2 = Ingestion & Capture; §5 Admin UX, §6.1 ingestion)
**Predecessor plan:** `2026-07-13-beanstalk-vault-spine-02a-ingestion-spine.md` (Plan 2a — done, PR #3 merged)

---

## 1. Context

Plan 2a built the headless ingestion spine: an authenticated `POST /api/inbox`, the
`captures` collection, embed detection, Cloudinary upload, and the `lib/captures` data layer —
all exercisable only from a terminal. Plan 2b is the **admin UI** that sits on top of that spine.

Plan 2b is large (auth, quick-capture, triage/promote, publish cascade, vault browser,
revalidation). Per the brainstorming scope-decomposition guidance it is **sliced into three
shippable PRs**:

- **2b-i (this spec)** — auth gate + quick-capture bar + read-only inbox view. Introduces the
  admin zone and lets the browser replace curl for capture. Touches **no new write paths** to the
  atomic model.
- **2b-ii (next)** — the two-pane triage workspace: promote a capture into the atomic model
  (first-ever writes to `molecules`/`atoms`/`versions`, molecule/atom search-or-create, the
  `name`/`description` `string→Text` widening), publish → the visibility cascade (pure
  `publishCascade` fn), and image attach on the capture bar.
- **2b-iii (later)** — vault browser (browse/filter everything) + public-zone revalidation wired
  to the publish action.

Each slice gets its own brainstorm → plan → PR.

### Decisions locked during brainstorming (2b-i)

| Decision | Choice |
|---|---|
| Slicing | Three slices; build auth + capture + inbox view (2b-i) first. |
| Auth | **Password gate** — one env secret, a stateless HMAC-signed httpOnly cookie, middleware over `/admin/*`. No OAuth app, no auth library. (GitHub OAuth rejected as against the minimalism grain.) |
| Interaction model | **Zero client JS.** Server components + native `<form>`s + Next.js **Server Actions**. Full-page reload per capture. No `fetch`, no client bundle. |
| Capture bar contents | **Text + links only** — title, optional note (en/fr), one-or-more paste-a-link fields → embeds. Image attach deferred to 2b-ii. |
| Ingestion reuse | The capture bar does **not** call `/api/inbox`; it calls `lib/captures` directly via a server action, through the same `validateInboxPayload` guard the API uses. `/api/inbox` stays the untouched bearer-token connector plug-point. |
| Styling | **Bare functional HTML** — semantic native tags, no CSS framework, no polish. No visual design debt before the project's artistic direction is chosen. |

---

## 2. Scope

**In scope (2b-i):**
- Password auth gate: login/logout, stateless signed session cookie, middleware protection of `/admin/*`.
- The admin screen at `/admin`: an always-present quick-capture bar (title + optional en/fr note + link fields) and a read-only inbox table below it.
- A pure `buildCaptureBody(formData)` mapping the form into the raw ingestion payload shape.
- Reuse of the existing `validateInboxPayload` + `createOrUpdateCapture` seam for the write.

**Out of scope (→ 2b-ii / 2b-iii or later):**
- The two-pane triage workspace; promote → Version; molecule/atom search-or-create.
- Publish flow and the **publish visibility cascade** (`publishCascade`).
- The atomic-model `name`/`description` `string→Text` widening (happens at promotion, 2b-ii).
- Image attach on the capture bar + the "media pending" degradation UX (2b-ii).
- Vault browser and public-zone revalidation (2b-iii).
- Any change to the public zone (`/`, `/timeline`, `/atom/[id]`) — untouched in 2b-i.
- Any change to `/api/inbox` or `/api/upload` — untouched in 2b-i.

---

## 3. Architecture — the admin zone

One app, two zones (parent spec §3). 2b-i introduces the **admin zone** behind a login gate; the
public zone is unchanged.

**New files:**
- `middleware.ts` (repo root) — matches `/admin/:path*` except `/admin/login`; verifies the
  session cookie via `lib/session`; redirects to `/admin/login` when missing/invalid.
- `lib/session.ts` — dependency-free stateless session. `createSessionValue()` and
  `verifySessionValue(value)` built on **Web Crypto HMAC** (`crypto.subtle`), so the identical
  code runs in both the edge middleware runtime and the node server-action runtime. Plus a
  `requireSession()` helper that reads the cookie via `next/headers` and enforces it.
- `lib/capture-form.ts` — pure `buildCaptureBody(formData)`: maps the capture form into the raw
  ingestion body `{ title, body?, media, source }`.
- `app/admin/login/page.tsx` — server component; a plain `<form action={loginAction}>` with one
  password field and a conditional error line.
- `app/admin/page.tsx` — server component; the capture bar plus the read-only inbox table.
- `app/admin/actions.ts` — server actions: `loginAction`, `logoutAction`, `createCaptureAction`.

**Untouched:** `app/api/inbox/route.ts`, `app/api/upload/route.ts`, `lib/captures.ts` (consumed
as-is), `lib/inbox.ts` (consumed as-is), and the entire public zone.

---

## 4. Auth — stateless password gate

**Env (new, `.env.local`, gitignored):**
- `ADMIN_PASSWORD` — the gate password.
- `ADMIN_SESSION_SECRET` — HMAC signing key for the cookie.

**Login (`loginAction`).** Reads the submitted `password`, **constant-time** compares it to
`ADMIN_PASSWORD`. On success, sets an httpOnly, `SameSite=Lax`, `Secure`-in-production cookie
(`beanstalk_admin`) whose value is `issuedAt.HMAC(issuedAt)`, then redirects to `/admin`. On
failure, redirects back to `/admin/login` with an error flag.

**Verify (`verifySessionValue`).** Recomputes the HMAC over `issuedAt`, **constant-time** compares
the signature, and rejects a value older than a fixed max age (30 days). Rejects missing/garbage
values. Pure and synchronous-shaped (Web Crypto is async) → fully unit-testable with no request
context.

**Two layers of enforcement:**
1. **Middleware** gates navigation to `/admin/*` (redirect to login) — good UX, one place.
2. **Every mutating server action** (`createCaptureAction`, `logoutAction`) *also* calls
   `requireSession()` at its top. Middleware alone does not secure a server action's POST, so the
   action re-checks — defense in depth.

`loginAction` is the only `/admin`-adjacent action exempt from `requireSession` (it is what mints
the session). It lives at `/admin/login`, which the middleware matcher excludes.

**Fail closed.** A missing `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` makes login unable to
succeed and middleware deny, with a clear server-log line. Secrets never leave `.env.local`.

---

## 5. The admin screen (`/admin`)

A single server-rendered page, bare semantic HTML, full-page reload per action.

**Quick-capture bar (top).** A native `<form action={createCaptureAction}>`:
- `title` — text input, `required`.
- `note` — optional `<textarea>`, with an en/fr `<radio>` (default `en`) selecting which
  `LocalizedText` locale it lands in.
- `link` — one or more URL inputs; each non-blank value becomes an embed (`{ kind: "embed", url }`),
  provider auto-detected downstream. (Extra empty link fields are ignored.)
- Submit: "Add to inbox".

**Log out (top).** A small `<form action={logoutAction}>` with a submit button; clears the cookie
and redirects to `/admin/login`.

**Inbox table (below).** `listCaptures({ status: "inbox" })` (exists, sorts newest-first) rendered
as a native `<table>`: columns **source** (`source.kind`), **title**, **note** (body snippet),
**media** (count / kind), **age** (relative to `createdAt`). Read-only in 2b-i — promote/discard
actions arrive in 2b-ii. A total count is shown.

---

## 6. Data flow — capture write

The browser capture path and the connector path converge on the same functions; no ingestion
logic is duplicated.

1. The capture `<form>` posts to `createCaptureAction(formData)`.
2. Action calls `requireSession()` (fail closed).
3. Pure `buildCaptureBody(formData)` → raw body:
   `{ title, body?: { [lang]: note }, media: links.map(url => ({ kind: "embed", url })), source: { kind: "manual" } }`.
   Empty note → `body` omitted; blank link fields dropped.
4. The raw body passes through the **existing** `validateInboxPayload` (same validation + embed
   auto-detection `/api/inbox` uses) → `createOrUpdateCapture(parsed.value)`.
5. `revalidatePath("/admin")` so the inbox table reflects the new capture on reload.

---

## 7. Error handling ("nothing gets lost", parent spec §7)

- **Wrong password** → redirect back to `/admin/login` with an error flag; render "Incorrect
  password." No lockout (single-user personal tool); constant-time compare.
- **Invalid capture** (e.g. empty title) → `required` stops most; server-side `validateInboxPayload`
  is the real guard. On failure, re-render the capture bar with the error and preserve typed input.
- **Missing auth env** → fail closed (§4), clear server-log line.
- **DB unreachable when listing the inbox** → the page catches and renders a plain "couldn't load
  inbox" line instead of crashing; the capture bar still renders so capture is not blocked.

---

## 8. Testing

Preserve the 2a pattern: pure functions get real unit tests; request/DB-bound glue stays thin and
is verified by a manual smoke checklist.

**Unit tests (no DB, no network; default `npm test`):**
- **`lib/session.test.ts`** (security-critical) — sign/verify round-trip; tampered value rejected;
  value signed with a different secret rejected; expired (older-than-max-age) value rejected;
  missing/garbage value rejected.
- **`lib/capture-form.test.ts`** — `buildCaptureBody`: title + note under the chosen locale; empty
  note omits `body`; multiple link fields → multiple embeds; blank link fields dropped; missing
  title yields a body that `validateInboxPayload` then rejects.

**Reused coverage (already green from 2a):** `validateInboxPayload`, `normalizeMedia` /
`detectEmbed`, `createOrUpdateCapture`. The capture action is thin glue over these and inherits
their coverage.

**Not unit-tested (documented seam):** the server actions and middleware depend on `next/headers`
/ request context that `node:test` cannot cleanly provide. Rather than build fake request
scaffolding, they are verified by a **manual smoke checklist** in the plan:
1. Wrong password → rejected; correct password → cookie set, lands on `/admin`.
2. `/admin` with no/edited cookie → redirected to `/admin/login`.
3. Capture a title + a YouTube link → appears in the inbox table with the embed detected.
4. Log out → cookie cleared; `/admin` redirects to login again.

(Mirrors how 2a smoke-tested its route handlers with curl.)

---

## 9. What 2b-i delivers

A private admin zone behind a password gate, with an always-present quick-capture bar (text +
auto-detected embeds) and a read-only inbox view — all as bare functional HTML with zero client
JavaScript and zero styling debt. The browser now replaces curl for capture, sharing the exact
ingestion seam built in 2a. The triage/promote/publish workspace (2b-ii) and the vault browser +
revalidation (2b-iii) plug onto this zone next, each as its own spec → plan → PR.
