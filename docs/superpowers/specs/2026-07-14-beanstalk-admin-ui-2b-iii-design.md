# Beanstalk — Admin UI (Slice 2b-iii): Public Revalidation + Vault Browser — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md` (§5.3 vault browser, §6.2 publish/revalidation)
**Predecessors:** `2026-07-13-beanstalk-admin-ui-2b-i-design.md` (2b-i, merged) and `-2b-ii-design.md` (2b-ii, merged)

---

## 1. Context

2b-i built the auth gate + capture bar + inbox; 2b-ii built triage → promote → the publish
visibility cascade. But publishing currently only writes to Mongo — the **public zone does not
reflect it**, because the public pages are prerendered at build (they read Mongo with no caching
directive, so Next statically renders `/` at build and serves it stale afterward). 2b-iii closes
that gap and adds the vault browser, completing Plan 2b (the admin UI).

This is the third and final slice of Plan 2b:
- **2b-i (merged)** — auth + capture + read-only inbox.
- **2b-ii (merged)** — triage → promote → publish cascade; first writes to the atomic model.
- **2b-iii (this spec)** — public-zone revalidation (publishes appear on the live site) + the admin
  vault browser (browse/filter the whole archive).

### Decisions locked during brainstorming (2b-iii)

| Decision | Choice |
|---|---|
| Scope | **Both pieces in one slice** — public revalidation + vault browser. Both small; together they complete the admin loop. |
| Revalidation | **`force-dynamic` on the public pages** — each request re-reads published-only from Mongo, so a publish appears instantly. No cache-invalidation bookkeeping; the promote action is unchanged. (Rejected: `revalidatePath`/`revalidateTag`-on-publish — faster serving but every write path must remember to bust the cache.) |
| Vault browser | A read-only, version-centric admin page at `/admin/vault` over `getFullDataset()`, filtered by `state`/`domain`/`tag` via zero-JS query-param links (like the timeline). Editing/re-publishing an existing Version is out of scope. |
| Styling | Bare functional HTML, no CSS, no client JS — same constraint as 2b-i/2b-ii. |

---

## 2. Scope

**In scope (2b-iii):**
- `export const dynamic = "force-dynamic"` on `app/page.tsx`, `app/timeline/page.tsx`, `app/atom/[id]/page.tsx`.
- A pure `filterVaultEntries(entries, filters)` helper + tests.
- The `app/admin/vault/page.tsx` browser page (read-only, filterable).
- A nav link between `/admin` (inbox) and `/admin/vault`.

**Out of scope (→ later):**
- Editing, re-publishing, or un-publishing an existing Version from the admin (a later "edit Version" slice).
- Caching/perf optimization of the public zone (tag-based cache) — layer on later only if traffic warrants.
- `name`/`description` `string→Text` widening; capture-bar image attach (still deferred).
- Any change to the promote/publish action, the atomic write layer, or `filterPublic`.

---

## 3. Public-zone revalidation

Add `export const dynamic = "force-dynamic"` to the three public pages. Each already calls
`getPublicDataset()` (which runs `filterPublic` over a fresh `loadRawSeed()`); marking them dynamic
means every request re-reads current DB state, so a publish — which flips a Version's `state` to
`published` and cascades its parent Atom/Molecule to `public` (2b-ii) — is reflected on `/`,
`/timeline`, and `/atom/[id]` immediately, with no rebuild and no invalidation call.

Consequences:
- **The promote/publish action is unchanged.** Its existing `revalidatePath("/admin")` covers the
  admin's own pages; the public zone is now self-freshing, so no public `revalidatePath` is needed.
- **`npm run build` no longer needs DB reachability** for these pages (they render on-demand, not at
  build) — closing a Plan 1 fragility.
- **Security projection intact.** `filterPublic` still runs on every public read; nothing about the
  published-only guarantee changes — only *when* the read happens.
- **Trade-off:** one Mongo query per public request. Negligible at personal-portfolio scale; a
  tagged cache + `revalidateTag` on publish is a clean future optimization, explicitly deferred.

---

## 4. The vault browser

New admin page `app/admin/vault/page.tsx` (server component, bare HTML, gated by the existing
`/admin/*` middleware). The version-centric counterpart to the inbox — a navigable view of the
**whole** archive, including `draft`/`private` items.

**Data.** Reads `getFullDataset()` (everything, no `filterPublic`) and uses its `timelineVersions()`,
which yields `{ version, atom, domain }` per version (newest-first), so each row already has its
state (`version.state`), atom, and derived domain.

**Filtering (zero-JS, query-param links like `/timeline`).** `?state=`, `?domain=`, `?tag=`. Rows of
links set/clear each param:
- state: `all | draft | private | published`
- domain: `all | music | design | podcast`
- tag: the distinct tags present, each linkable, plus `all`.
A pure `filterVaultEntries(entries, { state?, domain?, tag? })` applies the active filters; an
unrecognized value for any dimension is ignored (treated as "all").

**Table columns:** version name (linking to `/atom/<atomSlug>` when the version has an atom), `state`,
`domain`, atom slug, `date`, tags. A "showing N of M" count.

**Navigation.** `/admin` links to `/admin/vault` and back.

**Read-only.** No edit/re-publish/re-triage actions in this slice.

---

## 5. Error handling

- **Vault DB read failure** → the page catches and renders a plain "couldn't load the vault" line
  (mirrors the inbox fallback), rather than crashing.
- **Unknown/garbage query-param values** (e.g. `?state=bogus`) → `filterVaultEntries` ignores an
  unrecognized value (that dimension falls back to "all"), so a tampered URL never errors or
  unexpectedly hides everything.
- **`force-dynamic`** adds no new error surface — it only changes when the existing read runs.
- The `/admin/vault` route is gated by the existing middleware; the page relies on it (no per-page
  `requireSession`, matching `/admin`).

---

## 6. Testing

Same pattern — pure logic unit-tested, glue/config smoke-tested.

- **`filterVaultEntries`** (pure, no DB) — filter by state; by domain; by tag; combined filters;
  an unknown value for a dimension falls back to "all"; no filters returns all entries; empty input.
- **`force-dynamic`** — a config change, verified by the smoke test (not a unit test).
- **Manual smoke checklist:**
  1. Publish a version via triage → it appears on `/` and `/timeline` immediately (no rebuild).
  2. `/admin/vault` lists all items including `draft`/`private`.
  3. `?state=draft` and `?domain=music` narrow the list correctly; combined filters intersect.
  4. A `draft` version is absent from the public `/` but present in `/admin/vault`.

---

## 7. What 2b-iii delivers

The publish loop finally closes: a triaged, published Version (and its cascaded-public lineage)
appears on the live public site immediately, and the admin can browse/filter the entire archive —
published and private alike — from `/admin/vault`. With this, Plan 2b (the admin UI: capture →
triage → publish → browse) is complete. Remaining vault work (editing existing Versions, bilingual
`Text` widening, image attach, connectors, AI-assisted classification) are independent later specs
on top of this spine.
