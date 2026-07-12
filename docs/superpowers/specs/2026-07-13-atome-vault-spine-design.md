# atome — Vault Spine (Slice 1) — Design Spec

**Date:** 2026-07-13
**Status:** Approved for planning
**Scope:** First buildable slice of the "central node" vision.

---

## 1. Context & vision

atome today is a zero-CSS Next.js POC that reads a static `data/seed.yml` and exhibits an atomic content model (Molecule → Atom → Version) as a public portfolio.

The larger goal: make atome the **central node** where everything the user creates converges — music, product/design work, podcasts, writing — to be **stored, classified, and exhibited** as a lifelong portfolio. Crucially, atome is a **personal archive first, portfolio second**: most things live privately; a curated subset is published.

The user works across many repositories and systems (pbbls, paulopus, arkaik, melogram, symmetry, …). Much content *already exists on the web* (GitHub PR release notes in FR/EN, the Pebbles changelog, Arkaik bundles, music on streaming platforms, podcasts on hosts). The design principle is **fewest extra-cost**: never re-author what already exists — reference or ingest it.

### The four subsystems (only the first is built in this slice)
1. **Ingestion** — getting existing web content in (GitHub, changelog, Arkaik, …).
2. **Capture** — the un-webbed stuff (song ideas, tasks, thoughts).
3. **Classification** — fitting things into the atomic model + deciding visibility.
4. **Exhibition** — the public portfolio (already a POC).

This spec covers the **spine** that all four depend on. Connectors, AI-assist, and sweeps are explicit follow-on specs (§9).

---

## 2. Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Core friction | All three (capture, ingest, classify) — so build a unified pipeline, not a point fix. |
| Curation model | **Private vault first**, publish a subset. Archive first, portfolio second. |
| Foundation | **Hybrid**: DB for metadata + object storage for images + embeds-as-references + static-ish public site. |
| Media | External media = **embeds** (SoundCloud, Deezer, Spotify, Ausha, YouTube, Vimeo, Figma). Own images = **object storage**. **No assets in the repo, ever.** |
| First slice | **The Vault Spine** (this doc). |
| Capture entity | **First-class `Capture`** — raw inbox content never pollutes the clean atomic model; one capture can become several versions. |
| Version lifecycle | State machine: `draft` → `private` → `published` (freely reversible). |
| Rich content | Versions get an optional markdown `content` field (text + object-storage images), localizable. |
| Admin layout | **Two-pane workspace** (inbox list + triage panel) + always-present quick-capture bar. |
| Publish mechanism | Public zone reads DB directly (published-only) with revalidation. `seed.yml` → one-time DB migration. |

---

## 3. Architecture — one app, two zones

Evolve the current Next.js app rather than start a second project.

- **Public zone** (`/`, `/timeline`, `/atom/[id]`): renders **only** `published` items. Stays fast and simple.
- **Admin zone** (`/admin/*`, new, behind login): the private vault — inbox, capture, triage, publish, browse.

**Stack (recommended; swappable):**
- **Metadata → MongoDB.** The `Version` is already a flexible per-type key-value bag → a document, not a rigid table. (Also already available in the environment.) Alternative: Supabase/Postgres if a single vendor for DB+auth+storage is preferred.
- **Images → object storage.** Recommended **Cloudinary** (auto thumbnails/optimization, good for a visual portfolio) or **Cloudflare R2** (cheaper/simpler). Never the repo.
- **Embeds → URL/ID only** in the DB. No bytes stored.
- **Auth → single-user.** Lightest thing that works: one login (GitHub OAuth restricted to the user's account, or a password gate). Not a multi-user system.

**Data access layer:** today's `getDataset()` (reads `seed.yml`) is replaced by a DB-backed dataset:
- Public zone → queries **published-only**.
- Admin zone → queries **everything**.
The pure-function/testable shape of `lib/data.ts` is preserved; only the source changes.

---

## 4. Data model

### 4.1 Shared building blocks (value objects)

**`LocalizedText`** — `{ en?: string, fr?: string }`. Used for names, descriptions, and rich content. Lets pbbls store FR + EN release notes side by side; a plain string is acceptable where localization isn't needed.

**`Media[]`** — each entry is one of:
- **embed** — `{ kind: "embed", provider: "soundcloud" | "spotify" | "deezer" | "ausha" | "youtube" | "vimeo" | "figma" | ..., url, embedId? }`
- **image** — `{ kind: "image", storageKey, url, alt?, width?, height? }` (uploaded to object storage)

**`Source` (provenance)** — `{ kind: "manual" | "github" | "changelog" | "arkaik" | ..., url?, externalId?, capturedAt }`. Always know where a thing came from; enables dedup.

### 4.2 `Capture` (inbox item — first-class)

Raw incoming content, from a connector or the capture bar. Kept separate from the atomic model until triaged.

```
Capture {
  id
  title
  body?: LocalizedText          // raw note / pasted text
  content?: LocalizedText        // optional rich markdown
  media[]: Media
  source: Source
  suggested?: {                  // stored now; AI-populated in a later slice
    moleculeSlug?, atomSlug?, type?, tags?[]
  }
  status: "inbox" | "promoted" | "discarded"
  promotedTo[]: versionId        // 0..n — one capture can yield several versions
  createdAt, updatedAt
}
```
- **Idempotency:** `(source.kind, source.externalId)` is unique. Re-posting the same PR **updates** the capture rather than duplicating.
- A capture with no classification **stays in the inbox** — the inbox is the safety net.

### 4.3 The atomic model (same shape, new fields)

**`Molecule`** — `slug, name: LocalizedText, domain, description: LocalizedText, visibility, tags[], createdAt, updatedAt`

**`Atom`** — `slug, name: LocalizedText, parents[], visibility, tags[], createdAt, updatedAt`

**`Version` (the unit of work)** —
```
Version {
  slug, name: LocalizedText, type, date
  description: LocalizedText      // short teaser
  content?: LocalizedText         // optional rich markdown (text + object-storage images)
  parents[]                       // e.g. ["atom:pbbls-ios"]
  media[]: Media
  state: "draft" | "private" | "published"
  source?: Source                 // set when promoted from a capture
  tags[]
  createdAt, updatedAt
  ...flexible per-type props       // preserved from current model
}
```

**Note:** `state` on the Version supersedes a plain public/private boolean. `visibility` on Molecule/Atom is derived/managed by the publish cascade (§6). For Molecule/Atom a simple `visibility: "private" | "public"` is sufficient; only Versions carry the full three-state lifecycle.

---

## 5. Admin UX

### 5.1 Quick-capture bar (always present)
A one-line affordance to "throw something in" in ~2 seconds:
- Title/note field.
- Paste-a-link field → **embed provider auto-detected** from the URL.
- Image attach → uploaded to object storage.
- Enter → creates a `Capture` in the inbox. **No classification required at capture time.**

### 5.2 Two-pane inbox workspace
- **Left — inbox list:** captures awaiting triage, each with a **source badge** (`github`/`manual`/`arkaik`/…), title, snippet, media indicator, age.
- **Right — triage panel:** promote a capture into a Version —
  - Molecule (search existing or create new) → Atom (search/create) → Version (name, type, date).
  - Description with **EN / FR** toggles (pre-filled from the capture when available).
  - Media confirmation (embeds + images carried from the capture).
  - Tags.
  - **State** selector: `draft` / `private` / `published`.
  - Actions: **Promote → keep as draft/private**, **Promote → publish**, **Discard**.
- Keyboard-driven for fast batch clearing.

### 5.3 Vault browser (basic)
List/filter all items by domain, state, tag — so the archive is navigable beyond the inbox. (Minimal in slice 1; can grow later.)

---

## 6. Ingestion API & publish flow

### 6.1 Single ingestion endpoint
`POST /api/inbox` — used by **every** entry path (capture bar, and every future connector).
```
{ title, body?, content?, media?[], source: { kind, url?, externalId? }, suggested?, lang? }
```
- **Auth:** session for the capture bar; **per-source bearer token** for connectors.
- **Dedup:** unique on `(source.kind, source.externalId)`; re-posts update.
- **Effect:** creates/updates a `Capture` with `status: "inbox"`.

This endpoint is the plug point: each connector becomes a small, independent follow-on spec that only formats a payload and POSTs it. **No connector touches vault internals.**

### 6.2 Publish flow & visibility cascade
- Public zone queries **published-only**, with revalidation (no build step; images from object-store CDN).
- **Cascade rule:** publishing a Version auto-promotes its parent Atom and Molecule to `public` so nothing dangles. Unpublishing never cascades *down* (parents stay public if other published children exist).
- **Invariant:** the public zone must never expose a `draft` or `private` Version, nor a private Molecule/Atom. This is the one security-sensitive rule (see tests, §8).

### 6.3 Migration
One-time import of `data/seed.yml` into the DB, all items as `published` (they are the current live portfolio). `seed.yml` is retired as the runtime source after migration.

---

## 7. Error handling ("nothing gets lost")
- Ingestion validates payloads; malformed posts are **rejected with a clear error**, never silently dropped.
- Unknown embed URL → stored as a **generic link**, capture still succeeds.
- Image upload failure → capture **still saves**, flagged "media pending"; the note is never lost to a file hiccup.
- Unclassified captures **remain in the inbox** indefinitely; they leave only via promote or explicit discard.

---

## 8. Testing
Preserve the current pure-function + unit-test pattern (`lib/data.ts` / `lib/data.test.ts`):
- **Visibility filtering** — dedicated tests proving the public dataset never returns `draft`/`private` items or private parents. (Highest-priority invariant.)
- **Version lifecycle** — `draft → private → published` and reverse transitions.
- **Ingestion dedup/idempotency** — same `(source, externalId)` updates, does not duplicate.
- **Publish cascade** — publishing a version makes parents public; correct behaviour on unpublish.
- **Dataset builder** — against DB-shaped data (mirrors existing tests).

---

## 9. Explicitly out of scope (follow-on specs)
Each is a clean, independent next spec that builds on this spine:
1. **Connectors** — GitHub (pbbls FR/EN PR notes), Arkaik bundle, Pebbles changelog, etc. The endpoint is ready; connectors are built one at a time.
2. **Claude-assisted auto-classification** — populate the `suggested` field so triage is pre-filled (this is where "fewest extra-cost" compounds).
3. **Scheduled sweep agent** — periodic pull from sources into the inbox.
4. **Mobile / phone capture** — capture-anywhere for 2am ideas.
5. **Full-text search** across the vault.
6. **Richer public exhibition** — media rendering, per-version rich-content pages, evolution storytelling.

**Slice 1 delivers:** DB + object storage + extended model + two-pane admin (capture → triage → publish with draft/private/published) + ingestion endpoint + seed migration. End-to-end manually captureable; connectors plug in afterward.
