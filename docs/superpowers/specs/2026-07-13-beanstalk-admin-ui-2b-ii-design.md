# Beanstalk — Admin UI (Slice 2b-ii): Triage → Promote → Publish Cascade — Design Spec

**Date:** 2026-07-13
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md` (Plan 2 §5 Admin UX, §6.2 publish cascade)
**Predecessor:** `2026-07-13-beanstalk-admin-ui-2b-i-design.md` (Plan 2b-i — done, PR #4)

---

## 1. Context

Plan 2b-i delivered the password-gated admin zone: a quick-capture bar and a read-only inbox.
Plan 2b-ii adds the **triage workspace** — turning an inbox capture into a first-class Version in
the atomic model, with the publish visibility cascade. This is the first code that **writes** to the
`molecules`/`atoms`/`versions` collections (Plan 1 only migrated them in and read them out).

Plan 2b was sliced into three PRs during brainstorming. This is the second:

- **2b-i (done)** — auth + capture bar + read-only inbox.
- **2b-ii (this spec)** — triage → promote a capture into a Version (create/select molecule & atom),
  publish → visibility cascade, discard; the atomic-model write layer.
- **2b-iii (next)** — vault browser + public-zone caching/revalidation wired to publish.

### Decisions locked during brainstorming (2b-ii)

| Decision | Choice |
|---|---|
| Scope | **Core triage loop only.** Text (bilingual `name`/`description`) widening and capture-bar image attach are deferred (bilingual *rich* content already works via the existing `Version.content: Text`). |
| Triage UI under zero-JS | Inbox rows link to a dedicated **`/admin/triage/[id]`** page (one capture + its promote form). No client JS; full-page navigation / PRG. Not a live-updating two-pane. |
| Cascade location | A **pure `publishCascade` function** in `lib/data.ts` (mirror of `filterPublic`) + a thin atomic write layer + an orchestrating server action. |
| New molecules/atoms | Created **private by default** (`visibility:"private"`); only the publish cascade flips a lineage to `public`. Archive-first. |
| Slugs | **User-typed** on creation (no slugify dependency); uniqueness enforced by existing indexes; collisions surface as a friendly error. |
| Public reflection | Publishing writes to Mongo and the **admin** sees it immediately; the **public zone's** caching/revalidation is deferred to 2b-iii. |
| Styling | Bare functional HTML, no CSS, no client JS — same constraint as 2b-i. |

---

## 2. Scope

**In scope (2b-ii):**
- Pure `publishCascade(raw, versionSlug)` in `lib/data.ts` + tests.
- The atomic write layer `lib/atomic.ts` (create molecule/atom/version, `setPublic`, list helpers, `ensureAtomicIndexes`).
- Capture status transitions in `lib/captures.ts` (`markCapturePromoted`, `discardCapture`).
- Pure mapping/guard helpers: `buildVersionInput`, `resolveParentChoice`, `validateVersionInput`.
- Server actions `promoteCaptureAction` / `discardCaptureAction`.
- The `/admin/triage/[id]` page; the inbox row becomes a link to it.
- `scripts/apply-validators.ts` gains `ensureAtomicIndexes()`.

**Out of scope (→ 2b-iii or later):**
- Widening `name`/`description` from `string` to `Text` (and the public-render `resolveText` updates).
- Capture-bar image attach + "media pending" UX.
- Vault browser (browse/filter everything) and public-zone caching/revalidation.
- Editing an already-promoted Version, or un-publishing from the admin UI (only the *projection* side of unpublish exists, via `filterPublic`).
- Transactions across the multi-write promote (see §7).

---

## 3. Data model & write semantics

No shape changes. `Molecule`/`Atom`/`Version` keep their Plan 1 fields; `name`/`description` stay
`string`. What is new is write behavior:

**Capture status transitions** (`lib/captures.ts`):
- **Promote** → `status:"promoted"`, push the new version slug onto `promotedTo`. A capture may be
  promoted more than once (one capture → several versions), matching the model.
- **Discard** → `status:"discarded"`.
- Both leave the inbox, which lists `status:"inbox"` only (`listCaptures({ status:"inbox" })`).

**New molecules/atoms are private by default.** `filterPublic` treats *missing* visibility as public,
but Beanstalk is archive-first. So the write layer stamps a newly created molecule/atom with
`visibility:"private"` explicitly; only the publish cascade flips it to `"public"`. Consequences:
promoting a capture as a **draft** into a new atom keeps that atom private (nothing leaks); **publish**
is the single act that makes a lineage public. Existing seeded items are unaffected.

**Slugs** are user-typed on creation and must be unique. The existing unique `slug` indexes enforce
this; a duplicate surfaces as a typed error → a friendly message, never a 500.

---

## 4. The pure publish cascade — `publishCascade` (`lib/data.ts`)

Lives next to its mirror `filterPublic`. Pure, no DB, fully unit-tested.

```ts
publishCascade(raw: RawSeed, versionSlug: string): { moleculeSlugs: string[]; atomSlugs: string[] }
```

**Computes the upward closure.** For the version identified by `versionSlug`, it returns every
**existing** atom parent (`atom:` refs that resolve to a real atom), and every **existing** molecule
parent of those atoms, that should be `public` so the published version never dangles under a private
parent. Dangling (nonexistent) parent refs are ignored — the same rule `filterPublic` applies
downward, keeping the two symmetric.

**Semantics (spec §6.2):**
- **Upward only, on publish.** The caller runs `publishCascade` when a version's resulting state is
  `published`, then flips the returned slugs to `public` via `setPublic`. Idempotent — parents already
  public are harmless to re-set.
- **No downward cascade on unpublish.** Setting a version to `draft`/`private` does not call the
  cascade; parents are left as-is. `filterPublic` is the read-side safety net that hides a published
  child under a now-private parent, so privacy never needs to cascade downward at write time.
- **`filterPublic` is untouched.**

**Tests:** version with an atom→molecule chain returns both; multiple atom parents; an atom with
multiple molecule parents; dangling parent refs excluded; a parentless version returns empty sets;
already-public parents still returned (idempotent); unknown `versionSlug` returns empty sets.

---

## 5. The atomic write layer — `lib/atomic.ts`

Thin Mongo functions, one responsibility each (same style as `lib/captures.ts`). First module that
writes the atomic model.

- `listMolecules(): Promise<Molecule[]>` / `listAtoms(): Promise<Atom[]>` — populate the triage
  `<select>`s (admin sees all, regardless of visibility).
- `createMolecule(input): Promise<Molecule>` — insert with `visibility:"private"`. Requires
  `slug`, `name`, `domain`, `description`. Throws a typed `SlugExistsError` on duplicate-key (E11000).
- `createAtom(input): Promise<Atom>` — insert with `visibility:"private"`; `parents` =
  `["molecule:<slug>"]` when a molecule was chosen/created, else `[]`. Same collision handling.
- `createVersion(input): Promise<Version>` — insert; `parents` = `["atom:<slug>"]` when an atom was
  chosen/created, else `[]`. Carries `state`, `media`, `source`, `date`, `type`, `description`,
  `name`. Same collision handling.
- `setPublic(moleculeSlugs: string[], atomSlugs: string[]): Promise<void>` — `updateMany`
  `visibility:"public"` on the given slugs (the cascade's write half). No-op on empty arrays.
- `ensureAtomicIndexes(): Promise<void>` — idempotent unique `slug` indexes on all three collections
  (present from the Plan 1 migration; made explicit + re-runnable and wired into
  `scripts/apply-validators.ts`).

Capture-status writes (`markCapturePromoted(id, versionSlug)`, `discardCapture(id)`) live in
`lib/captures.ts`, not here.

---

## 6. Promote & discard flow — server actions (`app/admin/actions.ts`)

Both start with `requireSession()`.

**`promoteCaptureAction(formData)`:**
1. `requireSession()`; read `captureId` (hidden); load the capture (for provenance + carried media).
2. Resolve the **molecule** via `resolveParentChoice`: new-molecule fields filled → `createMolecule`
   (private); else selected `moleculeSlug` → use it; else none.
3. Resolve the **atom** the same way (`createAtom` links to the resolved molecule); else none / parentless.
4. Pure `buildVersionInput(formData, capture)` → the version to write: `name`, `type`, `date`,
   `description`, `state`, `parents` (the atom ref), **carrying the capture's `media` and setting
   `source`** to the capture's provenance. Form fields are prefilled from the capture (title→name,
   note→description) but editable.
5. `validateVersionInput` (pure) guards required fields; on failure → redirect back with the message.
6. `createVersion(input)`.
7. If `state === "published"` → `publishCascade(fullRaw, version.slug)` → `setPublic(...)`.
8. `markCapturePromoted(captureId, version.slug)`.
9. `revalidatePath("/admin")` → `redirect("/admin")`.

**`discardCaptureAction(formData)`:** `requireSession()` → `discardCapture(captureId)` →
`revalidatePath("/admin")` → `redirect("/admin")`.

**Zero-JS conditional-create:** both the `<select>` and the "create new" inputs are always rendered
(no JS to toggle them). A pure `resolveParentChoice(newSlug, newFields, selectedSlug)` encodes the
precedence (new wins → else selection → else none) so it is unit-tested, not buried in the action.

**Public reflection deferred (2b-iii):** publishing writes to Mongo and the admin (full-data,
per-request) sees it immediately; the public zone's caching/revalidation lands in 2b-iii, so a 2b-ii
publish is correct in the data but not yet pushed to the public site.

---

## 7. Error handling

- **Slug collision** (molecule/atom/version exists) → typed `SlugExistsError` from the write layer;
  the action catches it and redirects to `/admin/triage/<id>?error=<message>`. Nothing 500s; the
  capture stays in the inbox.
- **Invalid version input** (missing `versionSlug`/`name`/`type`/`date`) → `validateVersionInput`
  rejects → redirect back with the message. Client `required` attributes catch most.
- **Capture not found / already triaged** → the triage page `notFound()`s (it serves `status:"inbox"`
  captures only).
- **Partial-write on promote** (e.g. molecule/atom created, then `createVersion` fails) → surfaces as
  an error redirect. Because created parents are `private`, an orphaned molecule/atom is invisible and
  reusable on retry — an **accepted** edge; no cross-document transaction (YAGNI for a single-user
  tool). Documented, not silently ignored.
- **`requireSession()`** on both actions; middleware already gates the `/admin/*` route.

---

## 8. The triage UI

**Inbox change (`app/admin/page.tsx`):** the inbox table's title cell becomes a link to
`/admin/triage/<capture.id>`. Only change to the 2b-i page.

**New `app/admin/triage/[id]/page.tsx`** (server component, bare HTML):
- `getCapture(id)`; if missing or not `status:"inbox"` → `notFound()`.
- Read-only capture header: title, note, media list, source.
- `listMolecules()` / `listAtoms()` populate the dropdowns.
- **Promote `<form action={promoteCaptureAction}>`** with hidden `captureId` and groups:
  - *Molecule*: `<select name="moleculeSlug">` (+ "— none —") **plus** `newMoleculeSlug`,
    `newMoleculeName`, `newMoleculeDomain` (a 3-option select: `music`/`design`/`podcast`).
  - *Atom*: `<select name="atomSlug">` (+ "— none —") plus `newAtomSlug`, `newAtomName`.
  - *Version*: `versionSlug` (required), `versionName` (prefilled from title), `type`, `date`,
    `description` (prefilled from note), and a `state` radio (`draft`/`private`/`published`, default
    `draft`).
  - Submit: **"Promote"**.
- **Discard `<form action={discardCaptureAction}>`** with hidden `captureId` and a "Discard" button.
- An `?error=` alert line.

Dense but flat: every control is a plain `<label>`/`<select>`/`<input>`, no styling. Both "pick
existing" and "create new" fields are always visible; the §6 precedence resolves them server-side.

---

## 9. Testing

Same pattern — pure logic unit-tested, DB glue integration-tested (env-guarded), actions/pages
smoke-tested.

- **`publishCascade`** (pure, `lib/data.test.ts`) — the §4 upward-closure cases.
- **`buildVersionInput`** (pure) — capture→version mapping: prefills, `media`/`source` carried, state
  parsed, atom parent wired, parentless case.
- **`resolveParentChoice`** (pure) — new-wins / else-selection / else-none precedence.
- **`validateVersionInput`** (pure) — required-field rejection cases.
- **`lib/atomic.ts`** (env-guarded integration, skips without `MONGODB_URI`) — create molecule/atom/
  version (private-by-default), `setPublic` flips visibility, `SlugExistsError` on duplicate; plus the
  `lib/captures.ts` transitions (`markCapturePromoted` sets status + appends slug; `discardCapture`
  sets status).
- **Manual smoke checklist** — capture → triage → promote as **draft** (new atom stays private) →
  promote another capture as **published** (parent atom + molecule flip public — verify in Mongo) →
  discard → inbox reflects each transition.

---

## 10. What 2b-ii delivers

The triage half of the vault: a capture becomes a first-class Version under a chosen or newly created
(private-by-default) molecule/atom, and publishing runs the pure, tested visibility cascade that
promotes the lineage to public. The atomic model gets its first write layer, and the "one
security-sensitive rule" (§6.2) is a pure function with tests, symmetric with `filterPublic`. The
vault browser and public-zone revalidation follow in 2b-iii.
