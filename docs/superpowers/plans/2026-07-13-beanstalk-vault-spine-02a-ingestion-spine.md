# Beanstalk Vault Spine — Plan 2a: Ingestion Spine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headless ingestion spine — a `captures` collection, an authenticated `POST /api/inbox` with dedup/validation/embed-normalization, pure embed detection, Cloudinary image upload via `POST /api/upload`, DB-side validators, and a dev-safe Mongo singleton — all exercisable from a terminal with no UI.

**Architecture:** Keep the logic-heavy parts as small pure modules in `lib/` (`embeds`, `auth`, `inbox`, `storage` helpers) that are unit-tested in isolation, plus a Mongo-backed `captures` data layer. The App Router route handlers (`app/api/inbox/route.ts`, `app/api/upload/route.ts`) are thin adapters: parse the `Request`, call the pure lib, build a `Response`. The pure `buildDataset`/`filterPublic` core from Plan 1 is untouched.

**Tech Stack:** Next.js 15 (App Router route handlers), TypeScript, MongoDB (`mongodb` driver), Cloudinary Node SDK (`cloudinary` v2), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-07-13-beanstalk-ingestion-spine-2a-design.md`

**Conventions carried from Plan 1:**
- Tests live under `lib/` and are run by `npm test` = `node --import tsx --test "lib/**/*.test.ts"`. Route-handler tests therefore live in `lib/` and import the handler by **relative path** (`../app/api/...`), and route handlers import lib by **relative path** too — this keeps everything resolvable under `tsx` without depending on the `@/*` alias.
- Env-dependent integration tests are guarded with `{ skip: !process.env.MONGODB_URI }` so the default `npm test` run stays green with no DB.
- Standalone scripts run via `node --env-file=.env.local --import tsx <script>` (Next loads `.env.local` for the app automatically; a bare `tsx` run does not).

---

## File Structure

- `lib/data.ts` — **modify.** Add `CaptureStatus`, `CaptureSuggestion`, `Capture` types (additive; existing tests stay green).
- `lib/db.ts` — **modify.** Stash the `MongoClient`/`Db` on `globalThis` so dev HMR reuses one connection.
- `lib/embeds.ts` — **create.** Pure `detectEmbed(url) → MediaEmbed`.
- `lib/auth.ts` — **create.** Pure `parseTokens(env)` + `authorize(header, sourceKind, tokens)` + `hasValidToken(header, tokens)`.
- `lib/inbox.ts` — **create.** Pure `validateInboxPayload(body)` + `normalizeMedia(media)` (uses `detectEmbed`).
- `lib/storage.ts` — **create.** `Storage` interface, pure `toMediaImage(result)`, Cloudinary-backed `uploadImage(bytes, filename?)`.
- `lib/captures.ts` — **create.** `ensureCaptureIndexes`, `createOrUpdateCapture`, `listCaptures`, `getCapture`.
- `app/api/inbox/route.ts` — **create.** `POST` handler.
- `app/api/upload/route.ts` — **create.** `POST` handler.
- `scripts/apply-validators.ts` — **create.** Idempotent `$jsonSchema` validators + capture indexes.
- Tests: `lib/embeds.test.ts`, `lib/auth.test.ts`, `lib/inbox.test.ts`, `lib/storage.test.ts`, `lib/captures.test.ts`, `lib/inbox-route.test.ts`, `lib/upload-route.test.ts` — **create.**
- `package.json` — **modify.** Add `cloudinary` dep + a `validators` script.
- `.env.local` — **modify (local only, gitignored).** Add `INBOX_TOKENS`, `CLOUDINARY_URL`.

**`INBOX_TOKENS` format (locked here):** comma-separated `kind:token` entries. `kind` is an allowed `source.kind`; `*` means any kind. Example:
```
INBOX_TOKENS=*:tok_master,github:tok_gh
```
`tok_master` is accepted for any source kind; `tok_gh` only for `source.kind === "github"`.

---

## Task 0: Dependencies, env, and the dev-HMR db singleton

**Files:**
- Modify: `package.json`
- Modify: `.env.local` (local only)
- Modify: `lib/db.ts`

- [ ] **Step 1: Install the Cloudinary SDK**

Run:
```bash
npm install cloudinary@^2.5.0
```
Expected: `cloudinary` appears under `dependencies`; `package-lock.json` updates.

- [ ] **Step 2: Add the new env vars locally**

Append to `.env.local` (NOT committed — it is gitignored):
```
INBOX_TOKENS=*:tok_dev_master
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```
Use a real `CLOUDINARY_URL` from your Cloudinary dashboard (Account Details → API Environment variable). `tok_dev_master` is a throwaway dev token; pick any opaque string.

- [ ] **Step 3: Make the Mongo client survive dev hot-reloads**

Replace the whole body of `lib/db.ts` with the `globalThis`-cached version (preserves the existing `getDb`/`closeDb` API):
```ts
import { MongoClient, type Db } from "mongodb";

// Cache the client/db on globalThis so Next.js dev hot-reloads reuse one
// connection instead of accumulating Atlas connections. In production the
// module is evaluated once, so this behaves like a plain module singleton.
const globalForMongo = globalThis as unknown as {
  __mongoClient?: MongoClient;
  __mongoDb?: Db;
};

export async function getDb(): Promise<Db> {
  if (globalForMongo.__mongoDb) return globalForMongo.__mongoDb;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const client = globalForMongo.__mongoClient ?? new MongoClient(uri);
  if (!globalForMongo.__mongoClient) {
    await client.connect();
    globalForMongo.__mongoClient = client;
  }
  const db = client.db(process.env.MONGODB_DB ?? "beanstalk");
  globalForMongo.__mongoDb = db;
  return db;
}

// Closes the cached connection so long-lived clients (e.g. test runners) can
// exit cleanly. No-op when nothing is connected.
export async function closeDb(): Promise<void> {
  if (globalForMongo.__mongoClient) {
    await globalForMongo.__mongoClient.close();
    globalForMongo.__mongoClient = undefined;
    globalForMongo.__mongoDb = undefined;
  }
}
```

- [ ] **Step 4: Verify existing tests still pass and it typechecks**

Run:
```bash
npm test && npx tsc --noEmit
```
Expected: all existing `lib/*.test.ts` pass (DB-guarded ones skip); no type errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/db.ts
git commit -m "chore: add cloudinary dep and make mongo client dev-HMR safe"
```
(`.env.local` is intentionally not committed.)

---

## Task 1: Add the `Capture` type (additive, no behavior change)

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/data.test.ts` (must still pass — types only)

- [ ] **Step 1: Add the Capture types**

In `lib/data.ts`, immediately after the `RawSeed` interface (around line 75), add:
```ts
export type CaptureStatus = "inbox" | "promoted" | "discarded";

export interface CaptureSuggestion {
  moleculeSlug?: string;
  atomSlug?: string;
  type?: string;
  tags?: string[];
}

// Raw inbox item. Kept separate from the atomic model until triaged (spec §4.2).
export interface Capture {
  id: string; // crypto.randomUUID() at creation; captures are not slug-addressable
  title: string;
  body?: LocalizedText;
  content?: LocalizedText;
  media: Media[];
  source: Source;
  suggested?: CaptureSuggestion;
  status: CaptureStatus;
  promotedTo: string[]; // version slugs; empty until 2b triage
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
```

- [ ] **Step 2: Verify existing tests still pass and it typechecks**

Run:
```bash
npm test && npx tsc --noEmit
```
Expected: all existing tests PASS; no type errors (the new types are unreferenced so far).

- [ ] **Step 3: Commit**

```bash
git add lib/data.ts
git commit -m "feat: add Capture type for the inbox collection"
```

---

## Task 2: Embed provider detection — `lib/embeds.ts` (pure, TDD)

**Files:**
- Create: `lib/embeds.ts`
- Test: `lib/embeds.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/embeds.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEmbed } from "./embeds";

test("detects youtube watch URLs and extracts the video id", () => {
  const e = detectEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(e.provider, "youtube");
  assert.equal(e.embedId, "dQw4w9WgXcQ");
});

test("detects youtu.be short URLs", () => {
  const e = detectEmbed("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(e.provider, "youtube");
  assert.equal(e.embedId, "dQw4w9WgXcQ");
});

test("detects vimeo and extracts the numeric id", () => {
  const e = detectEmbed("https://vimeo.com/123456789");
  assert.equal(e.provider, "vimeo");
  assert.equal(e.embedId, "123456789");
});

test("detects the remaining known providers by host", () => {
  assert.equal(detectEmbed("https://soundcloud.com/artist/track").provider, "soundcloud");
  assert.equal(detectEmbed("https://open.spotify.com/track/abc").provider, "spotify");
  assert.equal(detectEmbed("https://www.deezer.com/track/123").provider, "deezer");
  assert.equal(detectEmbed("https://podcast.ausha.co/show").provider, "ausha");
  assert.equal(detectEmbed("https://www.figma.com/file/abc").provider, "figma");
});

test("unknown hosts fall back to a generic link embed, preserving the url", () => {
  const e = detectEmbed("https://example.com/whatever");
  assert.equal(e.provider, "link");
  assert.equal(e.url, "https://example.com/whatever");
  assert.equal(e.kind, "embed");
});

test("a non-URL string is a generic link embed, never throws", () => {
  const e = detectEmbed("not a url");
  assert.equal(e.provider, "link");
  assert.equal(e.url, "not a url");
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `./embeds` cannot be found.

- [ ] **Step 3: Implement `lib/embeds.ts`**

Create `lib/embeds.ts`:
```ts
import type { MediaEmbed } from "./data";

// Host substring → provider. First match wins.
const HOST_PROVIDERS: Array<[string, MediaEmbed["provider"]]> = [
  ["soundcloud.com", "soundcloud"],
  ["spotify.com", "spotify"],
  ["deezer.com", "deezer"],
  ["ausha.co", "ausha"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["vimeo.com", "vimeo"],
  ["figma.com", "figma"],
];

function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function youtubeId(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase().includes("youtu.be")) {
      return u.pathname.slice(1) || undefined;
    }
    return u.searchParams.get("v") ?? undefined;
  } catch {
    return undefined;
  }
}

function vimeoId(url: string): string | undefined {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : undefined;
}

// Pure. Never throws. Unknown/unparseable → a generic "link" embed that still
// preserves the original string (spec §7: capture never fails on a bad URL).
export function detectEmbed(url: string): MediaEmbed {
  const host = parseHost(url);
  const provider =
    (host && HOST_PROVIDERS.find(([h]) => host.includes(h))?.[1]) || "link";

  let embedId: string | undefined;
  if (provider === "youtube") embedId = youtubeId(url);
  else if (provider === "vimeo") embedId = vimeoId(url);

  return { kind: "embed", provider, url, ...(embedId ? { embedId } : {}) };
}
```

Note: `MediaEmbed.provider` is typed `string` in `lib/data.ts`, so the `"link"` fallback and all named providers are valid.

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all `embeds` tests green; existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/embeds.ts lib/embeds.test.ts
git commit -m "feat: pure embed-provider detection"
```

---

## Task 3: Bearer-token auth — `lib/auth.ts` (pure, TDD)

**Files:**
- Create: `lib/auth.ts`
- Test: `lib/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/auth.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTokens, authorize, hasValidToken } from "./auth";

const env = "*:tok_master,github:tok_gh";

test("parseTokens maps each token to its allowed source kinds", () => {
  const t = parseTokens(env);
  assert.deepEqual([...(t.get("tok_master") ?? [])], ["*"]);
  assert.deepEqual([...(t.get("tok_gh") ?? [])], ["github"]);
});

test("parseTokens tolerates blanks and missing env", () => {
  assert.equal(parseTokens(undefined).size, 0);
  assert.equal(parseTokens("  ").size, 0);
});

test("authorize returns 'unauthorized' for missing or unknown tokens", () => {
  const t = parseTokens(env);
  assert.equal(authorize(null, "github", t), "unauthorized");
  assert.equal(authorize("Bearer nope", "github", t), "unauthorized");
  assert.equal(authorize("tok_gh", "github", t), "unauthorized"); // missing "Bearer " prefix
});

test("authorize allows a wildcard token for any kind", () => {
  const t = parseTokens(env);
  assert.equal(authorize("Bearer tok_master", "github", t), "ok");
  assert.equal(authorize("Bearer tok_master", "manual", t), "ok");
});

test("authorize forbids a kind-bound token used for another kind", () => {
  const t = parseTokens(env);
  assert.equal(authorize("Bearer tok_gh", "github", t), "ok");
  assert.equal(authorize("Bearer tok_gh", "manual", t), "forbidden");
});

test("hasValidToken checks only that the bearer token exists (for /api/upload)", () => {
  const t = parseTokens(env);
  assert.equal(hasValidToken("Bearer tok_gh", t), true);
  assert.equal(hasValidToken("Bearer nope", t), false);
  assert.equal(hasValidToken(null, t), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `./auth` cannot be found.

- [ ] **Step 3: Implement `lib/auth.ts`**

Create `lib/auth.ts`:
```ts
export type AuthResult = "ok" | "unauthorized" | "forbidden";

// Parse "*:tok_master,github:tok_gh" → Map<token, Set<kind>>.
// A kind of "*" means the token is accepted for any source kind.
export function parseTokens(env: string | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!env) return map;
  for (const entry of env.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) continue; // no kind or empty kind → skip
    const kind = trimmed.slice(0, idx).trim();
    const token = trimmed.slice(idx + 1).trim();
    if (!kind || !token) continue;
    const set = map.get(token) ?? new Set<string>();
    set.add(kind);
    map.set(token, set);
  }
  return map;
}

function bearer(header: string | null): string | null {
  if (!header) return null;
  const prefix = "Bearer ";
  return header.startsWith(prefix) ? header.slice(prefix.length).trim() : null;
}

// For /api/inbox: token must exist AND be allowed for this source kind.
export function authorize(
  header: string | null,
  sourceKind: string,
  tokens: Map<string, Set<string>>,
): AuthResult {
  const token = bearer(header);
  if (!token) return "unauthorized";
  const kinds = tokens.get(token);
  if (!kinds) return "unauthorized";
  if (kinds.has("*") || kinds.has(sourceKind)) return "ok";
  return "forbidden";
}

// For /api/upload: any valid token is enough (uploads are not source-bound).
export function hasValidToken(
  header: string | null,
  tokens: Map<string, Set<string>>,
): boolean {
  const token = bearer(header);
  return token != null && tokens.has(token);
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all `auth` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "feat: pure bearer-token auth with per-source-kind binding"
```

---

## Task 4: Payload validation + media normalization — `lib/inbox.ts` (pure, TDD)

**Files:**
- Create: `lib/inbox.ts`
- Test: `lib/inbox.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/inbox.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInboxPayload, normalizeMedia } from "./inbox";

test("rejects a non-object body", () => {
  const r = validateInboxPayload(null);
  assert.equal(r.ok, false);
});

test("rejects a missing/empty title", () => {
  assert.equal(validateInboxPayload({ source: { kind: "manual" } }).ok, false);
  assert.equal(validateInboxPayload({ title: "  ", source: { kind: "manual" } }).ok, false);
});

test("rejects a missing source.kind", () => {
  assert.equal(validateInboxPayload({ title: "hi" }).ok, false);
  assert.equal(validateInboxPayload({ title: "hi", source: {} }).ok, false);
});

test("rejects a non-array media", () => {
  assert.equal(
    validateInboxPayload({ title: "hi", source: { kind: "manual" }, media: "x" }).ok,
    false,
  );
});

test("accepts a minimal valid payload and defaults media to []", () => {
  const r = validateInboxPayload({ title: "hi", source: { kind: "manual" } });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.title, "hi");
    assert.equal(r.value.source.kind, "manual");
    assert.deepEqual(r.value.media, []);
  }
});

test("carries body, content, suggested, and source fields through", () => {
  const r = validateInboxPayload({
    title: "PR #42",
    body: { en: "hello", fr: "bonjour" },
    source: { kind: "github", url: "https://x", externalId: "42" },
    suggested: { moleculeSlug: "pbbls" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.body, { en: "hello", fr: "bonjour" });
    assert.equal(r.value.source.externalId, "42");
    assert.equal(r.value.suggested?.moleculeSlug, "pbbls");
  }
});

test("normalizeMedia fills provider for a bare embed via detection", () => {
  const out = normalizeMedia([{ kind: "embed", url: "https://youtu.be/abc123" }]);
  assert.equal(out[0].kind, "embed");
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "youtube");
    assert.equal(out[0].embedId, "abc123");
  }
});

test("normalizeMedia leaves an already-typed embed and images untouched", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "spotify", url: "https://open.spotify.com/x" },
    { kind: "image", storageKey: "k", url: "https://cdn/x.jpg" },
  ]);
  if (out[0].kind === "embed") assert.equal(out[0].provider, "spotify");
  assert.equal(out[1].kind, "image");
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `./inbox` cannot be found.

- [ ] **Step 3: Implement `lib/inbox.ts`**

Create `lib/inbox.ts`:
```ts
import type { LocalizedText, Media, MediaImage, Source, CaptureSuggestion } from "./data";
import { detectEmbed } from "./embeds";

// Media as it arrives in a raw JSON payload: an embed may omit `provider`
// (we detect it), while the stored `Media` type always has one.
export type InputMedia =
  | { kind: "embed"; url: string; provider?: string; embedId?: string }
  | MediaImage;

export interface InboxInput {
  title: string;
  body?: LocalizedText;
  content?: LocalizedText;
  media: Media[];
  source: Source;
  suggested?: CaptureSuggestion;
}

export type ValidationResult =
  | { ok: true; value: InboxInput }
  | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// Fill provider for bare embeds; pass images and already-typed embeds through.
export function normalizeMedia(media: InputMedia[]): Media[] {
  return media.map((m) => {
    if (m.kind === "image") return m;
    if (!m.provider) return detectEmbed(m.url);
    return {
      kind: "embed",
      provider: m.provider,
      url: m.url,
      ...(m.embedId ? { embedId: m.embedId } : {}),
    };
  });
}

// Pure guard. Never touches the DB. Returns a normalized InboxInput or a clear
// error string (spec §7: malformed payloads are rejected, never silently dropped).
export function validateInboxPayload(body: unknown): ValidationResult {
  if (!isObject(body)) return { ok: false, error: "body must be a JSON object" };
  if (!nonEmptyString(body.title)) return { ok: false, error: "title is required" };
  if (!isObject(body.source) || !nonEmptyString(body.source.kind)) {
    return { ok: false, error: "source.kind is required" };
  }
  if (body.media !== undefined && !Array.isArray(body.media)) {
    return { ok: false, error: "media must be an array" };
  }

  const src = body.source as Record<string, unknown>;
  const source: Source = {
    kind: src.kind as string,
    ...(nonEmptyString(src.url) ? { url: src.url } : {}),
    ...(nonEmptyString(src.externalId) ? { externalId: src.externalId } : {}),
  };

  const value: InboxInput = {
    title: (body.title as string).trim(),
    media: normalizeMedia((body.media as InputMedia[]) ?? []),
    source,
    ...(isObject(body.body) ? { body: body.body as LocalizedText } : {}),
    ...(isObject(body.content) ? { content: body.content as LocalizedText } : {}),
    ...(isObject(body.suggested) ? { suggested: body.suggested as CaptureSuggestion } : {}),
  };
  return { ok: true, value };
}

// (media on the raw body is validated as an array above, then normalized here.)
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all `inbox` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/inbox.ts lib/inbox.test.ts
git commit -m "feat: pure inbox payload validation and media normalization"
```

---

## Task 5: Captures data layer — `lib/captures.ts` (env-guarded integration, TDD)

**Files:**
- Create: `lib/captures.ts`
- Test: `lib/captures.test.ts`

- [ ] **Step 1: Write the env-guarded integration test**

Create `lib/captures.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrUpdateCapture, getCapture, ensureCaptureIndexes } from "./captures";
import { closeDb, getDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("captures").deleteMany({ title: /^__test__/ });
}

test("createOrUpdateCapture inserts a fresh manual capture", { skip: !hasDb }, async (t) => {
  await ensureCaptureIndexes();
  t.after(cleanup);
  const { capture, created } = await createOrUpdateCapture({
    title: "__test__ manual one",
    media: [],
    source: { kind: "manual" },
  });
  assert.equal(created, true);
  assert.equal(capture.status, "inbox");
  assert.deepEqual(capture.promotedTo, []);
  assert.ok(capture.id);
  assert.ok(capture.createdAt);
});

test("two manual captures (no externalId) are distinct documents", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const a = await createOrUpdateCapture({ title: "__test__ dup", media: [], source: { kind: "manual" } });
  const b = await createOrUpdateCapture({ title: "__test__ dup", media: [], source: { kind: "manual" } });
  assert.notEqual(a.capture.id, b.capture.id);
});

test("same (kind, externalId) upserts instead of duplicating", { skip: !hasDb }, async (t) => {
  await ensureCaptureIndexes();
  t.after(cleanup);
  const first = await createOrUpdateCapture({
    title: "__test__ pr v1",
    media: [],
    source: { kind: "github", externalId: "__test__42" },
  });
  assert.equal(first.created, true);
  const second = await createOrUpdateCapture({
    title: "__test__ pr v2",
    media: [],
    source: { kind: "github", externalId: "__test__42" },
  });
  assert.equal(second.created, false);
  assert.equal(second.capture.id, first.capture.id); // same doc
  assert.equal(second.capture.createdAt, first.capture.createdAt); // preserved
  const reread = await getCapture(first.capture.id);
  assert.equal(reread?.title, "__test__ pr v2"); // content overwritten
  assert.notEqual(reread?.updatedAt, first.capture.updatedAt); // bumped
});

test.after(async () => {
  if (hasDb) await closeDb();
});
```

- [ ] **Step 2: Run to verify it skips (no DB) / fails to import**

Run:
```bash
npm test
```
Expected: FAIL — `./captures` cannot be found (module missing). The tests themselves are DB-guarded and would skip once the module exists.

- [ ] **Step 3: Implement `lib/captures.ts`**

Create `lib/captures.ts`:
```ts
import { getDb } from "./db";
import type { Capture } from "./data";
import type { InboxInput } from "./inbox";

function captures() {
  return getDb().then((db) => db.collection<Capture>("captures"));
}

// Unique only when externalId exists, so manual captures never collide on null.
export async function ensureCaptureIndexes(): Promise<void> {
  const col = await captures();
  await col.createIndex(
    { "source.kind": 1, "source.externalId": 1 },
    { unique: true, partialFilterExpression: { "source.externalId": { $exists: true } } },
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createOrUpdateCapture(
  input: InboxInput,
): Promise<{ capture: Capture; created: boolean }> {
  const col = await captures();
  const now = nowIso();
  const source = { ...input.source, capturedAt: input.source.capturedAt ?? now };

  const setFields = {
    title: input.title,
    media: input.media,
    source,
    updatedAt: now,
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.suggested !== undefined ? { suggested: input.suggested } : {}),
  };

  // Dedup path: a connector re-post updates the existing capture.
  if (input.source.externalId) {
    const res = await col.findOneAndUpdate(
      { "source.kind": input.source.kind, "source.externalId": input.source.externalId },
      {
        $set: setFields,
        $setOnInsert: {
          id: crypto.randomUUID(),
          status: "inbox",
          promotedTo: [],
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        includeResultMetadata: true,
        projection: { _id: 0 },
      },
    );
    const created = !res.lastErrorObject?.updatedExisting;
    return { capture: res.value as Capture, created };
  }

  // Manual path: always a new document.
  const capture: Capture = {
    id: crypto.randomUUID(),
    ...setFields,
    status: "inbox",
    promotedTo: [],
    createdAt: now,
  } as Capture;
  await col.insertOne(capture);
  return { capture, created: true };
}

export async function listCaptures(
  filter: Partial<Pick<Capture, "status">> = {},
): Promise<Capture[]> {
  const col = await captures();
  return col
    .find(filter, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getCapture(id: string): Promise<Capture | null> {
  const col = await captures();
  return col.findOne({ id }, { projection: { _id: 0 } });
}
```

Note: `findOneAndUpdate` with `includeResultMetadata: true` (mongodb driver v6) returns `{ value, lastErrorObject, ok }`; `lastErrorObject.updatedExisting` is `false` on insert, `true` on update.

- [ ] **Step 4: Run the DB-backed test with a DB**

Run:
```bash
node --env-file=.env.local --import tsx --test "lib/captures.test.ts"
```
Expected: PASS — insert, distinct-manual, and dedup-upsert cases all green.

- [ ] **Step 5: Confirm the default (no-DB) run stays green**

Run:
```bash
npm test
```
Expected: `captures` tests skip; everything else PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/captures.ts lib/captures.test.ts
git commit -m "feat: captures data layer with dedup upsert"
```

---

## Task 6: Cloudinary image upload — `lib/storage.ts`

**Files:**
- Create: `lib/storage.ts`
- Test: `lib/storage.test.ts`

- [ ] **Step 1: Write the tests (pure mapping + the fake conforms to the interface)**

Create `lib/storage.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toMediaImage, type Storage } from "./storage";

test("toMediaImage maps a Cloudinary result to a MediaImage descriptor", () => {
  const m = toMediaImage({
    public_id: "beanstalk/abc123",
    secure_url: "https://res.cloudinary.com/x/image/upload/abc123.jpg",
    width: 800,
    height: 600,
  });
  assert.equal(m.kind, "image");
  assert.equal(m.storageKey, "beanstalk/abc123");
  assert.equal(m.url, "https://res.cloudinary.com/x/image/upload/abc123.jpg");
  assert.equal(m.width, 800);
  assert.equal(m.height, 600);
});

test("toMediaImage tolerates missing dimensions", () => {
  const m = toMediaImage({ public_id: "k", secure_url: "https://cdn/x.jpg" });
  assert.equal(m.storageKey, "k");
  assert.equal(m.width, undefined);
});

test("a fake Storage satisfies the interface (used by route tests)", async () => {
  const fake: Storage = {
    uploadImage: async () => ({ kind: "image", storageKey: "k", url: "https://cdn/x.jpg" }),
  };
  const m = await fake.uploadImage(Buffer.from("x"));
  assert.equal(m.storageKey, "k");
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `./storage` cannot be found.

- [ ] **Step 3: Implement `lib/storage.ts`**

Create `lib/storage.ts`:
```ts
import { v2 as cloudinary } from "cloudinary";
import type { MediaImage } from "./data";

export interface Storage {
  uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage>;
}

// Shape of the subset of the Cloudinary upload response we consume.
export interface CloudinaryResult {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
}

// Pure mapping — unit-tested without any network.
export function toMediaImage(result: CloudinaryResult): MediaImage {
  return {
    kind: "image",
    storageKey: result.public_id,
    url: result.secure_url,
    ...(typeof result.width === "number" ? { width: result.width } : {}),
    ...(typeof result.height === "number" ? { height: result.height } : {}),
  };
}

// Cloudinary reads CLOUDINARY_URL from the environment automatically; we opt
// into HTTPS URLs explicitly.
cloudinary.config({ secure: true });

export const cloudinaryStorage: Storage = {
  async uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage> {
    const dataUri = `data:application/octet-stream;base64,${bytes.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "beanstalk",
      resource_type: "image",
      ...(filename ? { public_id: filename.replace(/\.[^.]+$/, "") } : {}),
    });
    return toMediaImage(result as CloudinaryResult);
  },
};

// Convenience for route handlers; swappable in tests by importing cloudinaryStorage directly.
export function uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage> {
  return cloudinaryStorage.uploadImage(bytes, filename);
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — `storage` mapping/interface tests green. (No network is hit; the Cloudinary call is exercised manually in Task 10.)

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "feat: cloudinary image upload with pure descriptor mapping"
```

---

## Task 7: `POST /api/inbox` route handler

**Files:**
- Create: `app/api/inbox/route.ts`
- Test: `lib/inbox-route.test.ts`

- [ ] **Step 1: Write the route tests (no-DB auth/validation cases + env-guarded happy path)**

Create `lib/inbox-route.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/inbox/route";

function req(body: unknown, auth?: string): Request {
  return new Request("http://localhost/api/inbox", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// These cases short-circuit before any DB access.
test("401 when the bearer token is missing or unknown", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(req({ title: "hi", source: { kind: "manual" } }));
  assert.equal(res.status, 401);
});

test("403 when the token is not allowed for the source kind", async () => {
  process.env.INBOX_TOKENS = "github:tok_gh";
  const res = await POST(req({ title: "hi", source: { kind: "manual" } }, "Bearer tok_gh"));
  assert.equal(res.status, 403);
});

test("400 on malformed JSON", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(req("{ not json", "Bearer tok_master"));
  assert.equal(res.status, 400);
});

test("400 when title is missing", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(req({ source: { kind: "manual" } }, "Bearer tok_master"));
  assert.equal(res.status, 400);
});

const hasDb = Boolean(process.env.MONGODB_URI);

test("201 creates a capture for a valid authorized payload", { skip: !hasDb }, async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(
    req({ title: "__test__ route", source: { kind: "manual" } }, "Bearer tok_master"),
  );
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.ok(json.id);
  assert.equal(json.created, true);
  // cleanup
  const { getDb, closeDb } = await import("./db");
  const db = await getDb();
  await db.collection("captures").deleteOne({ id: json.id });
  await closeDb();
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `../app/api/inbox/route` cannot be found.

- [ ] **Step 3: Implement `app/api/inbox/route.ts`**

Create `app/api/inbox/route.ts`:
```ts
import { authorize, parseTokens } from "../../../lib/auth";
import { validateInboxPayload } from "../../../lib/inbox";
import { createOrUpdateCapture } from "../../../lib/captures";

export async function POST(request: Request): Promise<Response> {
  const tokens = parseTokens(process.env.INBOX_TOKENS);

  // Parse first so we know the source kind for the per-kind auth check.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = validateInboxPayload(body);
  if (!parsed.ok) {
    // Distinguish an unauthenticated request from a bad payload: if no valid
    // token at all, prefer 401 even on a malformed body.
    const auth = request.headers.get("authorization");
    const kind =
      typeof body === "object" && body !== null && "source" in body
        ? (body as { source?: { kind?: string } }).source?.kind ?? ""
        : "";
    if (authorize(auth, kind, tokens) === "unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const auth = authorize(request.headers.get("authorization"), parsed.value.source.kind, tokens);
  if (auth === "unauthorized") return Response.json({ error: "unauthorized" }, { status: 401 });
  if (auth === "forbidden") return Response.json({ error: "forbidden source kind" }, { status: 403 });

  const { capture, created } = await createOrUpdateCapture(parsed.value);
  return Response.json({ id: capture.id, created }, { status: created ? 201 : 200 });
}
```

- [ ] **Step 4: Run the no-DB tests**

Run:
```bash
npm test
```
Expected: PASS — the 401/403/400 cases pass; the 201 case skips without a DB.

- [ ] **Step 5: Run the happy path with a DB**

Run:
```bash
node --env-file=.env.local --import tsx --test "lib/inbox-route.test.ts"
```
Expected: PASS — including the 201 create-and-cleanup case.

- [ ] **Step 6: Commit**

```bash
git add app/api/inbox/route.ts lib/inbox-route.test.ts
git commit -m "feat: POST /api/inbox ingestion endpoint"
```

---

## Task 8: `POST /api/upload` route handler

**Files:**
- Create: `app/api/upload/route.ts`
- Test: `lib/upload-route.test.ts`

- [ ] **Step 1: Write the no-DB auth tests**

Create `lib/upload-route.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/upload/route";

test("401 when no valid bearer token is present", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const form = new FormData();
  form.set("file", new Blob([Buffer.from("x")], { type: "image/png" }), "x.png");
  const res = await POST(
    new Request("http://localhost/api/upload", { method: "POST", body: form }),
  );
  assert.equal(res.status, 401);
});

test("400 when no file field is provided", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(
    new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { authorization: "Bearer tok_master" },
      body: new FormData(),
    }),
  );
  assert.equal(res.status, 400);
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `../app/api/upload/route` cannot be found.

- [ ] **Step 3: Implement `app/api/upload/route.ts`**

Create `app/api/upload/route.ts`:
```ts
import { hasValidToken, parseTokens } from "../../../lib/auth";
import { uploadImage } from "../../../lib/storage";

export async function POST(request: Request): Promise<Response> {
  const tokens = parseTokens(process.env.INBOX_TOKENS);
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "missing 'file' field" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = typeof (file as File).name === "string" ? (file as File).name : undefined;

  try {
    const media = await uploadImage(bytes, filename);
    return Response.json(media, { status: 201 });
  } catch (err) {
    // Upload failure never costs a capture: inbox and upload are separate calls.
    return Response.json(
      { error: "upload failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Run the no-DB tests**

Run:
```bash
npm test
```
Expected: PASS — 401 (no token) and 400 (no file) cases green.

- [ ] **Step 5: Commit**

```bash
git add app/api/upload/route.ts lib/upload-route.test.ts
git commit -m "feat: POST /api/upload cloudinary image endpoint"
```

---

## Task 9: DB-side `$jsonSchema` validators + capture indexes

**Files:**
- Create: `scripts/apply-validators.ts`
- Modify: `package.json` (add a `validators` script)

- [ ] **Step 1: Write the validators script**

Create `scripts/apply-validators.ts`:
```ts
import { getDb, closeDb } from "../lib/db";
import { ensureCaptureIndexes } from "../lib/captures";

// Applies a $jsonSchema validator to a collection, creating it if absent.
// Idempotent: safe to re-run. validationLevel "moderate" only validates inserts
// and updates to already-valid docs, so existing data is never retroactively rejected.
async function applyValidator(name: string, schema: object): Promise<void> {
  const db = await getDb();
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name, { validator: { $jsonSchema: schema } });
  } else {
    await db.command({
      collMod: name,
      validator: { $jsonSchema: schema },
      validationLevel: "moderate",
    });
  }
  console.log(`validator applied: ${name}`);
}

async function main() {
  await applyValidator("captures", {
    bsonType: "object",
    required: ["id", "title", "source", "status"],
    properties: {
      id: { bsonType: "string" },
      title: { bsonType: "string" },
      status: { enum: ["inbox", "promoted", "discarded"] },
      source: {
        bsonType: "object",
        required: ["kind"],
        properties: { kind: { bsonType: "string" } },
      },
    },
  });

  await applyValidator("versions", {
    bsonType: "object",
    properties: { state: { enum: ["draft", "private", "published"] } },
  });

  await applyValidator("molecules", {
    bsonType: "object",
    properties: { visibility: { enum: ["private", "public"] } },
  });

  await applyValidator("atoms", {
    bsonType: "object",
    properties: { visibility: { enum: ["private", "public"] } },
  });

  await ensureCaptureIndexes();
  console.log("capture indexes ensured");

  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the `validators` script to `package.json`**

In `package.json` `scripts`, add (after `migrate`):
```json
    "validators": "node --env-file=.env.local --import tsx scripts/apply-validators.ts"
```

- [ ] **Step 3: Run it against the DB (idempotent)**

Run:
```bash
npm run validators
```
Expected output includes: `validator applied: captures`, `validator applied: versions`, `validator applied: molecules`, `validator applied: atoms`, and `capture indexes ensured`.

- [ ] **Step 4: Verify the validator rejects a bad value**

Run (should FAIL to insert — proving the guard works):
```bash
node --env-file=.env.local -e "const {MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const db=c.db(process.env.MONGODB_DB);try{await db.collection('captures').insertOne({id:'x',title:'bad',source:{kind:'manual'},status:'BOGUS',promotedTo:[],media:[]});console.log('ERROR: bad status was accepted');}catch(e){console.log('OK: validator rejected bad status');}await c.close();})()"
```
Expected: `OK: validator rejected bad status`.

- [ ] **Step 5: Commit**

```bash
git add scripts/apply-validators.ts package.json
git commit -m "feat: DB-side jsonSchema validators and capture indexes"
```

---

## Task 10: End-to-end smoke test + README note

**Files:**
- Modify: `README.md` (document the new endpoints, env, and scripts)

- [ ] **Step 1: Run the full test suite (no DB) — everything green or skipped**

Run:
```bash
npm test
```
Expected: all pure tests PASS; DB-guarded tests skip.

- [ ] **Step 2: Run the full DB-backed suite**

Run:
```bash
node --env-file=.env.local --import tsx --test "lib/**/*.test.ts"
```
Expected: all tests PASS (nothing skipped).

- [ ] **Step 3: Smoke-test the endpoints end-to-end**

Start the dev server:
```bash
npm run dev
```
In another terminal, ingest a manual capture with an auto-detected embed (use the `tok_dev_master` token from your `.env.local`):
```bash
curl -sS -X POST http://localhost:3000/api/inbox \
  -H "authorization: Bearer tok_dev_master" \
  -H "content-type: application/json" \
  -d '{"title":"Test capture","source":{"kind":"manual"},"media":[{"kind":"embed","url":"https://youtu.be/dQw4w9WgXcQ"}]}'
```
Expected: `{"id":"<uuid>","created":true}`. Confirm the embed got a provider:
```bash
node --env-file=.env.local -e "const {MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const db=c.db(process.env.MONGODB_DB);const d=await db.collection('captures').findOne({title:'Test capture'});console.log(JSON.stringify(d.media));await c.close();})()"
```
Expected: media shows `"provider":"youtube"` and `"embedId":"dQw4w9WgXcQ"`.

Test auth rejection:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/inbox \
  -H "content-type: application/json" -d '{"title":"x","source":{"kind":"manual"}}'
```
Expected: `401`.

Optionally test image upload (requires a valid `CLOUDINARY_URL`):
```bash
curl -sS -X POST http://localhost:3000/api/upload \
  -H "authorization: Bearer tok_dev_master" \
  -F "file=@/path/to/some.jpg"
```
Expected: JSON `{"kind":"image","storageKey":"beanstalk/...","url":"https://res.cloudinary.com/...", ...}`.

Clean up the smoke-test capture:
```bash
node --env-file=.env.local -e "const {MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const db=c.db(process.env.MONGODB_DB);await db.collection('captures').deleteMany({title:'Test capture'});await c.close();})()"
```

- [ ] **Step 4: Document the spine in the README**

Add a section to `README.md` describing:
- The new env vars: `INBOX_TOKENS` (format `kind:token,…`; `*` = any kind) and `CLOUDINARY_URL`.
- `npm run validators` — applies DB-side `$jsonSchema` validators + capture indexes (run once after pulling this change, and after any validator edit).
- `POST /api/inbox` — bearer-authenticated ingestion; dedup on `(source.kind, source.externalId)`.
- `POST /api/upload` — bearer-authenticated Cloudinary image upload, returns a `MediaImage` descriptor.
- A note that the admin UI (quick-capture bar, triage, publish) arrives in Plan 2b.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document ingestion endpoints, tokens, and validators script"
```

---

## Done — what Plan 2a delivers

- A `captures` collection with a first-class `Capture` type and dedup on `(source.kind, source.externalId)`.
- `POST /api/inbox` — the single ingestion endpoint every future connector targets: bearer auth (per-source-kind binding), payload validation, embed normalization, idempotent upsert.
- Pure, unit-tested embed detection and payload validation.
- Cloudinary image upload via `POST /api/upload`.
- DB-side `$jsonSchema` validators closing the Plan 1 "fails-open" gap, plus a dev-HMR-safe Mongo singleton.
- The pure `buildDataset`/`filterPublic` core and all Plan 1 tests untouched.

## Deferred to Plan 2b (admin UI)

- Quick-capture bar + two-pane triage workspace + vault browser.
- Promote→publish flow and the publish **visibility cascade** (spec §6.2) with a pure `publishCascade` function + tests.
- Interactive admin login (GitHub OAuth restricted to owner, or password gate).
- Dataset caching + public rendering-mode revalidation (tied to the publish action).
- Widening atomic-model `name`/`description` from `string` to `Text` at promotion time.
- Media-pending capture-bar UX (capture survives an image-upload failure).
