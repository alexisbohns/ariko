# Beanstalk

* **Intention**: I want to showcase all my creative and professional work, organized around an atomic content model.
* **Vision**: Everything I create — songs, product features, podcast episodes, blog posts — is an atom. Atoms group into molecules (albums, products, podcasts, blogs). The key insight is that atoms evolve: every atom has one or more versions, which are the fundamental unit of work. A song can have a demo, a studio recording, a live version. A feature can have a POC, an MVP, a V2. The portfolio tells the story of evolution, not just the final state.
* **Approach**: Build a zero-CSS Next.js app (App Router) as a POC for a personal portfolio system based on an atomic content model.

## Data model

### Seeding

* pre-seeded from `/data/seed.yml` (human-authored), imported into Mongo via `npm run migrate`

### Architecture

* **Molecule**: has a name, domain (`music | design | podcast`), and contains atoms
* **Atom**: has a name, belongs to a molecule (optional — can be standalone), and contains versions
* **Version**: has a name, type, date, description, state (`draft | private | published`), carried media/source, tags, and flexible per-type properties. `parents` refs (`molecule:slug` / `atom:slug`) express **containment only** — future non-containment links (lineage, "featured in") will live in a separate `relations[]`.

## Pages

* `/` — Directory. For each molecule (+ a "Standalone" group for orphan atoms): `<h2>` molecule name, `<ul>` of atom names as links to /atom/[id].
* `/timeline` — Timeline. All atom-versions sorted by date descending. Above the list: a `<ul>` of domain filter buttons (`all | music | design | podcast`). Below: a `<ul>` of filtered results.
* `/atom/[id]` — Atom detail. `<h1>` atom name, then for each version: `<h2>` version name, `<ul>` of all key-value properties.

## Constraints

* Zero CSS.
* No styling whatsoever.
* No UI library.
* Plain semantic HTML only.
* TypeScript.
* Public zone is zero-CSS, plain semantic HTML.

## Database & development

As of the Vault Spine slice, content lives in **MongoDB** (not the static seed). `data/seed.yml` is retained only as migration input.

* Set `MONGODB_URI` and `MONGODB_DB` in `.env.local` (gitignored).
* `npm run migrate` — one-time import of `data/seed.yml` into Mongo (idempotent).
* `npm run dev` — needs `MONGODB_URI` set and the cluster reachable (pages query Mongo at request time). The public pages (`/`, `/timeline`, `/atom/[id]`) are `force-dynamic`, so they read published-only from Mongo on every request and reflect a publish immediately — and `npm run build` no longer needs DB reachability to prerender them.
* `npm test` — pure unit tests; DB-backed integration tests auto-skip unless `MONGODB_URI` is set (run them with `node --env-file=.env.local --import tsx --test "lib/**/*.test.ts"`).

## Ingestion spine

As of the Ingestion Spine slice, content can be captured into Mongo via API instead of only through the seed.

* Set `INBOX_TOKENS` in `.env.local` — comma-separated `kind:token` pairs, e.g. `*:tok_master,github:tok_gh`. A `kind` of `*` accepts the token for any source kind; otherwise the token is only valid for that specific `source.kind`.
* Set `CLOUDINARY_URL` in `.env.local` (from the Cloudinary dashboard, e.g. `cloudinary://<key>:<secret>@<cloud_name>`) — required for `/api/upload` to store images.
* `npm run validators` — applies the DB-side `$jsonSchema` validators and capture indexes. Run once after pulling this change, and again after any validator edit.

### `POST /api/inbox`

Bearer-authenticated capture ingestion: `Authorization: Bearer <token>`.

Body: `{ title, body?, content?, media?: [], source: { kind, url?, externalId? }, suggested? }`.

* Dedups/upserts on `(source.kind, source.externalId)` when `externalId` is present; otherwise every post creates a new capture.
* Embed media (`{ kind: "embed", url }`) auto-detects its provider (YouTube, Vimeo, etc.) when `provider` is omitted.
* Returns `{ id, created }` — `201` when a new capture is created, `200` on an upsert of an existing one.
* `401` when the bearer token is missing/unknown, `403` when the token isn't authorized for that `source.kind`, `400` on a malformed or invalid payload.

### `POST /api/upload`

Bearer-authenticated Cloudinary image upload: `Authorization: Bearer <token>`, body is `multipart/form-data` with a `file` field.

* Returns a `MediaImage` descriptor (`{ kind: "image", storageKey, url, width?, height? }`) on success (`201`).
* `401` when the bearer token is missing/unknown, `400` when the `file` field is absent, `502` if the upload to Cloudinary itself fails (e.g. a placeholder/invalid `CLOUDINARY_URL`).

The admin UI builds on these endpoints. Connectors post to `/api/inbox` with a bearer token; the browser capture bar (below) reaches the same capture path through a session-authenticated server action.

## Admin zone

As of Plan 2b-i, a password-gated admin zone lets you capture into the inbox from the browser and review it — no curl needed. It is intentionally **bare functional HTML** (no CSS, no client JavaScript) until the project's artistic direction is set; triage/promote/publish (2b-ii) and the vault browser (2b-iii) come next.

* Set `ADMIN_PASSWORD` in `.env.local` — the login password.
* Set `ADMIN_SESSION_SECRET` in `.env.local` — a long random value (e.g. `openssl rand -hex 32`) used to HMAC-sign the session cookie. Rotating it invalidates existing sessions.

### `/admin/login`

The login gate. Submitting the correct `ADMIN_PASSWORD` sets an httpOnly, `SameSite=Lax` (Secure in production) signed session cookie and redirects to `/admin`; a wrong password re-renders with an error. `middleware.ts` protects every `/admin/*` route (except the login page) and redirects unauthenticated requests here; each mutating server action re-checks the session as well.

### `/admin`

* **Quick-capture bar** — title (required), an optional note with an en/fr toggle, and one or more paste-a-link fields. Submitting creates a `Capture` in the inbox via the same `validateInboxPayload` → `createOrUpdateCapture` path as `/api/inbox`; embed providers are auto-detected. Image attach is deferred to a later slice.
* **Inbox** — a read-only table of `status:"inbox"` captures (source, title, note, media, age), newest first. Each row's title links to the capture's triage page.

### `/admin/triage/[id]`

Turns a captured item into a first-class `Version` in the atomic model (or discards it).

* **Promote** — choose an existing molecule and atom from the dropdowns, or type a new slug/name (a blank "new slug" falls back to the selection; new-fields win when filled). Fill the version fields (slug, name, type, date, description) and pick a state: `draft` / `private` / `published`. The capture's media and provenance are carried onto the version.
* **Private by default** — newly created molecules/atoms are `visibility:"private"`. Publishing a version runs the pure `publishCascade` (the write-time mirror of `filterPublic`) which flips that version's parent atom and molecule to `public`, so a published version never dangles under a private parent. Promoting as draft/private leaves the parents untouched.
* **Discard** — drops the capture from the inbox (`status:"discarded"`).
* Run `npm run validators` after pulling this change to ensure the atomic-model slug indexes. Publishing is reflected on the public site immediately (the public pages are `force-dynamic`).

### `/admin/vault`

A read-only browser of the **whole** archive — every molecule/atom/version regardless of state or visibility (the counterpart to the inbox; linked from `/admin`).

* Version-centric table (name, state, domain, atom, date, tags), newest first.
* Filter by `state` / `domain` / `tag` via query-param links (zero-JS, like `/timeline`); an unrecognized filter value falls back to "all".
* Read-only — a row's version name links to its atom-detail page, where each version has an `edit` link (see `/admin/version/[slug]` below).

### /admin/atom/[id]

A read-only detail view of a single atom over the **full** dataset (every state/visibility), reached from each vault row's version name — so `draft`/`private` versions no longer 404 (they previously linked to the public `/atom/[id]`, which hides unpublished content).

* Header: the atom's name, slug, visibility, domain, molecule parent(s), and tags.
* Then every version of the atom, newest first, with its `state` (draft/private/published), scalar fields, and tags. Each version has an `edit` link to `/admin/version/[slug]`.
* Gated by the same `/admin/*` middleware; `force-dynamic` so it reflects current DB state.

### /admin/version/[slug]

A dedicated edit page for a single Version, reached from each version's `edit` link on the atom-detail view.

* Editable: `name`, `type`, `date`, `description`, and `state` (draft/private/published). The `slug` is immutable (identity); re-parenting, media, source, content, and tags are out of scope.
* Re-publishing (→ `published`) runs the same upward `publishCascade` as promote, flipping the parent atom/molecule public. Un-publishing (`published` → `draft`/`private`) runs the downward `unpublishCascade` + `setPrivate`: the withdrawn version's atom, left with no published version, is re-privatized — and its molecule too when no public atom remains under it — so pulled work leaves no empty public shell (not even its name). A still-published sibling version keeps its lineage public.
* The recompute is **transition-gated**: it fires only when the version actually leaves `published`. A routine draft save never flips visibility that was authored directly (e.g. seeded name-only public atoms), and re-running `npm run migrate` no longer force-republishes — the migration's public/published defaults apply on first insert only, so admin un-publishes survive a re-migrate.
* Read-only `slug`/atom context is shown; a blank required field re-renders with an error and writes nothing. Gated by the `/admin/*` middleware and the action's `requireSession()`.

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for the design and implementation plans.
