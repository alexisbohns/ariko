# Beanstalk — Ingestion Spine (Slice 2a) — Design Spec

**Date:** 2026-07-13
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md` (Plan 2 = Ingestion & Capture)
**Predecessor plan:** `2026-07-13-beanstalk-vault-spine-01-data-spine.md` (Plan 1 — done)

---

## 1. Context

Plan 1 (the Data Spine) moved content into MongoDB, extended the atomic model with vault
fields, and made the public site serve `published`-only. Plan 2 (Ingestion & Capture, spec §9)
adds the write side: getting content *in*.

Plan 2 spans two distinct subsystems — a **headless ingestion spine** and an **admin UI**.
Per the brainstorming scope-decomposition guidance, it is split:

- **Plan 2a (this spec)** — the headless ingestion spine. Fully exercisable via curl/tests,
  no UI. It is the plug-point every future connector targets.
- **Plan 2b (next)** — the admin UI: quick-capture bar, two-pane triage workspace,
  promote→publish + visibility cascade, vault browser, interactive login. Gets its own
  brainstorm → plan → PR once the spine is proven.

**Decisions locked during brainstorming:**

| Decision | Choice |
|---|---|
| Slicing | Build the headless spine (2a) first; admin UI (2b) is a separate design/plan/PR. |
| Object storage | **Cloudinary** — auto thumbnails/optimization/derived-URL transforms, no image-processing code, generous free tier. Signed server-side upload. |
| Endpoint auth | **Bearer token(s) from env**, each optionally bound to allowed source kinds. Interactive admin login (OAuth/password) deferred to 2b. |
| Image upload shape | **Separate `POST /api/upload`** call returning a `MediaImage` descriptor — not bytes inlined into `/api/inbox`. |
| Publish cascade / revalidation | Deferred to 2b — nothing is published in 2a (captures land in the inbox, which is never public). |

---

## 2. Scope

**In scope (2a):**
- The `captures` collection + `Capture` type (spec §4.2).
- `POST /api/inbox` — the single ingestion endpoint: bearer auth, payload validation, dedup, embed normalization.
- Embed-provider detection (`lib/embeds.ts`, pure).
- Cloudinary image upload (`lib/storage.ts`) + `POST /api/upload`.
- Captures data layer (`lib/captures.ts`).
- Two load-bearing Plan 1 follow-ups that the write path depends on:
  - **DB-side value validation** (`$jsonSchema` collection validators).
  - **Dev-HMR db singleton** in `lib/db.ts`.

**Out of scope (→ 2b or later):**
- Quick-capture bar, two-pane triage workspace, vault browser (all admin UI).
- Promote→publish flow and the **publish visibility cascade** (spec §6.2) + its pure `publishCascade` function.
- Interactive admin login (GitHub OAuth restricted to owner, or password gate).
- Dataset caching + public rendering-mode revalidation (tied to the publish action).
- Widening atomic-model `name`/`description` from `string` to `Text` (happens at promotion, in 2b).
- Connectors (GitHub, Arkaik, changelog, …) — each a later independent spec that only POSTs to `/api/inbox`.
- Media-pending degradation UX (a 2b capture-bar concern; see §7).

---

## 3. Data model — the `Capture` collection

New `captures` collection. Reuses the value objects from `lib/data.ts`
(`LocalizedText`, `Media`, `Source`).

```ts
export interface Capture {
  id: string;                     // crypto.randomUUID() at creation
  title: string;
  body?: LocalizedText;           // raw note / pasted text
  content?: LocalizedText;        // optional rich markdown
  media: Media[];                 // embeds + uploaded images (default [])
  source: Source;                 // { kind, url?, externalId?, capturedAt }
  suggested?: {                   // stored now; AI-populated in a later slice
    moleculeSlug?: string;
    atomSlug?: string;
    type?: string;
    tags?: string[];
  };
  status: "inbox" | "promoted" | "discarded";
  promotedTo: string[];           // version slugs; 0..n (empty until 2b triage)
  createdAt: string;              // ISO
  updatedAt: string;              // ISO
}
```

Notes:
- Captures are **not slug-addressable** — they are raw inbox items. Their stable handle is `id`.
- `promotedTo` and the promote flow are populated in 2b; in 2a it is always `[]`.
- `suggested` is carried through untouched (AI-assist is a later slice, spec §9).

### Dedup index (idempotency)

Unique **partial** index:
```
{ "source.kind": 1, "source.externalId": 1 }
partialFilterExpression: { "source.externalId": { $exists: true } }
```
- Connector re-posts of the same item (same `source.kind` + `source.externalId`) **upsert** the
  existing capture instead of duplicating (spec §4.2).
- Manual captures have **no** `externalId`, so the filter excludes them — every manual capture is
  a distinct document, never colliding on a shared null.

---

## 4. `POST /api/inbox`

The single ingestion endpoint used by every entry path (spec §6.1). Request body:
```
{ title, body?, content?, media?[], source: { kind, url?, externalId? }, suggested? }
```

**Auth.** `Authorization: Bearer <token>`. Tokens are configured in `.env.local`
(e.g. `INBOX_TOKENS=manual:tok_aaa,github:tok_bbb` or a JSON map — exact env shape decided in the plan).
Each token may be bound to one or more allowed `source.kind` values.
- Missing/invalid token → **401**.
- Valid token not permitted for the posted `source.kind` → **403**.

**Validation.** `title` (non-empty) and `source.kind` are required. Malformed payloads are
**rejected with a clear 400 error**, never silently dropped (spec §7). Validation is a small
pure guard so it is unit-testable without a DB.

**Embed normalization.** Each `media` entry of `kind:"embed"` lacking a `provider` is run through
`detectEmbed(url)`; unknown URLs become a generic `link` embed so the capture still succeeds (spec §7).

**Effect.**
- `source.externalId` present → **upsert** on the dedup key: preserve `id`, `createdAt`, `status`,
  and `promotedTo`; overwrite the content fields; bump `updatedAt`.
- `source.externalId` absent → **insert** a fresh capture with `status:"inbox"`, new `id`,
  `capturedAt`/timestamps stamped server-side.
- Response: `{ id, created: boolean }` (created=false means an existing capture was updated).

---

## 5. Image upload — `lib/storage.ts` + `POST /api/upload`

**`lib/storage.ts`.** A small storage interface with a Cloudinary implementation:
```ts
uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage>
```
Returns `{ kind:"image", storageKey, url, width, height, alt? }` where `storageKey` is the
Cloudinary `public_id` and `url` is the `secure_url`. Uses signed, server-side upload via the
Cloudinary Node SDK; credentials from env (`CLOUDINARY_URL` or `cloud_name`/`api_key`/`api_secret`).
The interface boundary lets the real provider be swapped and lets tests inject a fake.

**`POST /api/upload`.** Same bearer auth as `/api/inbox`. Accepts a multipart file, calls
`uploadImage`, returns the `MediaImage` descriptor. The 2b capture bar uploads first, then
includes the returned descriptor in the inbox `media[]`.
- Upload failure → clear **502**. Because upload and capture are **separate calls** in the
  headless spine, a failed image never costs a capture — the caller simply posts the capture
  without that media entry. The "capture-still-saves, media pending" *UX* (spec §7) is a 2b
  capture-bar concern layered on top of these two primitives.

---

## 6. Embed detection — `lib/embeds.ts` (pure)

```ts
detectEmbed(url: string): MediaEmbed
```
Recognizes the spec §4.1 providers: `soundcloud`, `spotify`, `deezer`, `ausha`, `youtube`,
`vimeo`, `figma`. Extracts `embedId` where cheap (e.g. YouTube `v=` / `youtu.be/<id>`,
Vimeo numeric id); otherwise stores the URL only. Unknown hosts → `{ provider: "link", url }`.
Pure and synchronous → fully unit-tested with no I/O.

---

## 7. Captures data layer — `lib/captures.ts`

Thin store functions over the `captures` collection, so route handlers stay small and 2b's UI
has a clean seam to consume:
- `createOrUpdateCapture(input): Promise<{ capture: Capture; created: boolean }>` — encapsulates
  the dedup/upsert logic of §4.
- `listCaptures(filter?): Promise<Capture[]>` — inbox listing (used by 2b).
- `getCapture(id): Promise<Capture | null>`.

---

## 8. Folded-in Plan 1 follow-ups

Two Plan 1 deferred follow-ups become load-bearing the moment writes start, so they land here:

**DB-side value validation.** Add MongoDB `$jsonSchema` validators via a small idempotent script
(`scripts/apply-validators.ts`, wired as an npm script):
- `captures` — `status` ∈ {inbox, promoted, discarded}; require `id`, `title`, `source.kind`, `status`.
- `versions` — `state` ∈ {draft, private, published} when present.
- `molecules` / `atoms` — `visibility` ∈ {private, public} when present.
This closes the Plan 1 "fails open" gap where a malformed value (e.g. `visibility:"Private"`)
written directly to Mongo could be exposed rather than rejected.

**Dev-HMR db singleton.** Stash the `MongoClient` on `globalThis` in `lib/db.ts` so Next.js dev
hot-reloads reuse one connection instead of accumulating Atlas connections. Behavior in
production is unchanged.

---

## 9. Error handling ("nothing gets lost", spec §7)

- Malformed ingestion payloads → rejected with a **clear 400**, never silently dropped.
- Unknown embed URL → stored as a generic `link` embed; the capture still succeeds.
- Image upload failure → a **502 on `/api/upload` only**; the capture path is independent, so a
  note is never lost to a file hiccup.
- Unclassified captures stay in the inbox (`status:"inbox"`) indefinitely; they leave only via
  promote or explicit discard (both 2b).

---

## 10. Testing

Preserve the pure-function + unit-test pattern; keep every existing test green.

- **`lib/embeds.test.ts`** (pure) — each provider detected, `embedId` extraction, unknown-URL
  fallback to `link`.
- **`lib/inbox.test.ts`** (pure guard) — payload validation accept/reject cases; auth-token
  resolution (allowed vs forbidden source kind) — no DB required.
- **`lib/captures.test.ts`** (env-guarded integration, skips without `MONGODB_URI`) — create;
  dedup upsert on repeated `(kind, externalId)` (updates, does not duplicate); two manual captures
  with no `externalId` insert as distinct documents.
- **Storage** — exercised through its interface with a fake `uploadImage`; the Cloudinary
  implementation gets an optional env-guarded smoke test.
- **Route handlers** — `/api/inbox` and `/api/upload` tested by importing and invoking the
  exported handler with a `Request`: 401 without token, 403 for a forbidden source kind, 400 for
  malformed body (all no-DB); env-guarded happy path.

---

## 11. What 2a delivers

A complete, headless ingestion spine: authenticated `POST /api/inbox` with dedup and validation,
embed detection, Cloudinary image upload via `POST /api/upload`, the `captures` data layer, and
DB-side validation + a dev-safe db singleton. Content can be ingested end-to-end from a terminal;
the admin UI (2b) and connectors (later specs) plug straight into this endpoint with no changes to
the vault internals.
