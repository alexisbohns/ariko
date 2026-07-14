# Beanstalk — Admin Atom-Detail View — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md`
**Predecessor:** `2026-07-14-beanstalk-admin-ui-2b-iii-design.md` (2b-iii, merged) — this closes its deferred vault-link follow-up.

---

## 1. Context

2b-iii shipped the read-only vault browser at `/admin/vault`. Each row links the **version name**
to the public atom page `/atom/<atomSlug>`. That page reads `getPublicDataset()` and calls
`notFound()` when the atom isn't public — so for a `draft`/`private` version whose atom hasn't been
published, the vault link **404s** (surfaced as an Important finding in the 2b-iii review, deferred
to "a later admin-side atom detail view"). This slice builds that view and closes the gap.

The public read path is security-sensitive: `filterPublic` guarantees only `published` versions and
their non-private lineage ever reach the public zone. The admin needs the mirror image — a view of
the **whole** atom (every version, every state) — without ever braiding private data into the public
projection. `getFullDataset()` (everything, no `filterPublic`) already exists and exposes
`getAtom` / `versionsForAtom` / `domainForAtom` on the `Dataset` interface, so the data is in hand.

### Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Scope | **Read-only detail view.** A new `/admin/atom/[id]` page over `getFullDataset()` showing the atom + all its versions (every state). No edit/publish/un-publish actions — those stay in the deferred "edit Version" slice. Smallest change that fully closes the follow-up. |
| Route strategy | **New dedicated admin route** at `/admin/atom/[id]`, gated by the existing `/admin/*` middleware. (Rejected: an "admin mode" on the public `/atom/[id]` page — braids private data into the security-sensitive public projection boundary. Rejected: inline row-expansion in the vault — the ask is atom-centric, and a route gives a stable linkable URL.) |
| Content | **Atom header + all versions.** Header: name, slug, visibility, domain, molecule parent(s), tags. Then every version newest-first with its scalar fields, an explicit `state` line, and tags. |
| Vault wiring | **Repoint the version-name link** from `/atom/<slug>` to `/admin/atom/<slug>`. The atom-slug column stays plain text. |
| Testing seam | The atom/domain/lineage/versions resolution + not-found case is extracted into a **pure, unit-tested `atomDetail(dataset, slug)`** builder (same split as `filterVaultEntries`), keeping the page thin glue. |
| Styling | Bare functional HTML, no CSS, no client JS — same constraint as 2b-i/2b-ii/2b-iii. |

---

## 2. Scope

**In scope:**
- A pure `atomDetail(dataset, slug)` builder + tests in `lib/atom-detail.ts`.
- The `app/admin/atom/[id]/page.tsx` detail page (read-only).
- Repointing the vault's version-name link to `/admin/atom/<slug>`.

**Out of scope (→ later):**
- Editing, re-publishing, or un-publishing a Version from the admin (the deferred "edit Version" slice).
- Any new server action or write path (this is a read-only slice).
- Molecule detail pages, cross-linking to a molecule view (none exists yet).
- Changes to `filterPublic` / `getPublicDataset` / the public `/atom/[id]` page / the promote action / `lib/atomic.ts`.
- `name`/`description` `string→Text` widening; capture-bar image attach; connectors; AI classification.

---

## 3. The pure builder — `atomDetail`

New `lib/atom-detail.ts`. Pure over a `Dataset` (no DB), so it unit-tests against a
`buildDataset()`-of-a-fixture, exactly like the vault filter.

```ts
import type { Atom, Dataset, Domain, Version } from "./data";

export interface AtomDetailView {
  atom: Atom;
  domain: Domain | null;      // dataset.domainForAtom(slug)
  moleculeParents: string[];  // atom.parents entries with the "molecule:" prefix (as-is, incl. dangling)
  versions: Version[];        // dataset.versionsForAtom(slug) — newest-first (already sorted)
}

// Pure. Returns the admin view model for an atom, or null when the slug doesn't exist.
export function atomDetail(dataset: Dataset, slug: string): AtomDetailView | null;
```

Behavior:
- Unknown slug → `null` (the page renders a 404).
- `domain` resolves via the atom's first resolvable molecule parent (`domainForAtom`); `null` when
  standalone/dangling.
- `moleculeParents` surfaces the raw `molecule:`-prefixed parent refs (including any dangling ones —
  informative for the admin); an atom with none → `[]`.
- `versions` is `versionsForAtom(slug)` (newest-first); an atom with no versions → `[]`.

`moleculeParents` filters `atom.parents` by the `molecule:` prefix. `data.ts` keeps its
`parentsWithPrefix` helper module-private; rather than widen that API, the builder uses a small local
filter (`p.startsWith("molecule:")`), which is all this view needs.

---

## 4. The detail page

New `app/admin/atom/[id]/page.tsx` — server component, `export const dynamic = "force-dynamic"`,
gated by the existing `/admin/*` middleware (no per-page `requireSession`, matching `/admin` and
`/admin/vault`). `[id]` is the atom slug.

**Data flow.** Await `params`; read `getFullDataset()` inside a `try`; on failure render a plain
"Couldn't load the atom." fallback (mirrors the vault/inbox fallback). Otherwise call
`atomDetail(dataset, id)`; `null` → `notFound()`.

**Layout (bare HTML):**

```
← vault                                   (link to /admin/vault)

<h1>{atom.name}</h1>
  atom: {atom.slug}
  visibility: {atom.visibility ?? "public (default)"}
  domain: {domain ?? "—"}
  molecule: {moleculeParents.join(", ") || "—"}
  tags: {atom.tags?.join(", ") || "—"}

<h2>Versions ({versions.length})</h2>
  per version → <section>:
    <h3>{version.name}</h3>
    state: {version.state ?? "—"}            (explicit — the reason this view exists)
    <ul> scalar fields (reusing the public page's isScalar dump) </ul>
    tags: {(version.tags ?? []).join(", ") || "—"}
  no versions → "No versions."
```

- The scalar-field `<ul>` reuses the exact `isScalar` predicate from `app/atom/[id]/page.tsx`
  (`string | number | boolean`). `state` is a scalar so it also appears in that dump; the explicit
  `state:` line is deliberate emphasis, since state is the whole point of the admin view.
- Read-only: no forms, no actions, no publish/edit controls in this slice.

---

## 5. Vault wiring

`app/admin/vault/page.tsx`, one line: the version-name cell changes from
`<a href={`/atom/${e.atom.slug}`}>` to `<a href={`/admin/atom/${e.atom.slug}`}>`. The atom-slug
column stays plain text; a version with no atom still renders its name as plain text (unchanged).
After this, a draft/private version's name link resolves to the admin detail view instead of 404ing.

---

## 6. Error handling

- **Atom not found** (unknown slug) → `notFound()`. The route is admin-gated, so a 404 is the right,
  simple signal.
- **DB read failure** → caught; renders "Couldn't load the atom." (mirrors the vault fallback), not a crash.
- **`force-dynamic`** adds no new error surface — it only fixes *when* the read runs (per request).
- Auth is the existing `/admin/*` middleware; the page does no per-page session check.

---

## 7. Testing

Same pattern — pure logic unit-tested, glue/config smoke-tested.

- **`atomDetail`** (pure, no DB; build a fixture via `buildDataset`): unknown slug → `null`; a found
  atom returns its versions newest-first; `domain` resolves via the molecule parent; `moleculeParents`
  surfaces the `molecule:` refs; an atom with no versions → `[]`.
- **No unit test** for the page's DB-failure fallback branch (only reachable via a real DB failure —
  consistent with the project's no-DB-in-`npm test` convention).
- **Manual smoke checklist:**
  1. From `/admin/vault`, click a **draft** version's name → lands on `/admin/atom/<slug>` showing
     all that atom's versions and their states (no 404).
  2. The atom header shows visibility/domain/molecule/tags correctly.
  3. `/admin/atom/<nonexistent>` → 404.
  4. `/admin/atom/<slug>` without a session cookie → 307 (middleware redirect).

---

## 8. What this delivers

The vault's version links now always resolve: clicking any version — published, draft, or private —
lands on a read-only admin atom-detail view that shows the atom's visibility and lineage plus every
version and its state. The 2b-iii deferred follow-up is closed, and the public read path
(`filterPublic`) is untouched. Editing / re-publishing / un-publishing a Version remains a later
independent slice on top of this spine.
