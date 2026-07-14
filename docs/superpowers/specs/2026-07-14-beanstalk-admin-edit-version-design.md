# Beanstalk — Admin Edit / Un-publish a Version — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md`
**Predecessors:** `2026-07-13-beanstalk-admin-ui-2b-ii-design.md` (triage/promote/publish, merged) and
`2026-07-14-beanstalk-admin-atom-detail-design.md` (atom-detail view, merged) — this builds the write
counterpart on top of that read surface.

---

## 1. Context

Plan 2b delivered the one-way loop: capture → triage → **create** a Version → publish (upward
`publishCascade`) → browse. Everything about a Version is fixed at creation — there is no way to
correct a typo, change a date, or pull a mistakenly-published Version back off the public site. The
admin atom-detail view (`/admin/atom/[id]`) is now the read surface for a single atom's versions;
this slice adds the **edit** action behind it.

The write layer (`lib/atomic.ts`) currently only **creates** (molecule/atom/version) and `setPublic`.
Publishing is modeled by the pure, one-directional `publishCascade` (make a version's parent
atom/molecule public). There is deliberately **no** inverse cascade — nothing walks visibility back
down — so "un-publish" needs an explicit, bounded definition (below).

### Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Edit scope | **Core fields + state.** Editable: `name`, `type`, `date`, `description`, `state` (draft/private/published). `slug` is immutable (identity, unique-indexed, referenced by parents/captures). Re-parenting, `media`, `source`, `content`, and `tags` are out of scope. |
| Edit surface | **A dedicated `/admin/version/[slug]` page** (a full-page form mirroring triage), reached from a new per-version "edit" link on `/admin/atom/[id]`. (Rejected: overloading the triage flow — it's capture-centric; rejected: inline editing on the read-only atom-detail glue.) |
| Re-publish (→ published) | **Reuse `publishCascade` + `setPublic`** exactly as promote does (idempotent upward flip). |
| Un-publish (published → draft/private) | **State-only.** Flipping the version's state hides it from the public site (`filterPublic` shows only `published` versions); parents are left as-is. A parent atom/molecule may thus remain public with no published version — this is **cosmetic, not a data leak** (the draft's content stays hidden). A downward "recompute visibility" pass is an explicit deferred follow-up. |
| Testing seam | Pure `buildVersionPatch` + `validateVersionPatch` in a new `lib/version-edit.ts`, unit-tested; the page/action are thin glue over them + `getVersion`/`updateVersion`. |
| Styling | Bare functional HTML, no CSS, no client JS — same constraint as all of Plan 2b. |

---

## 2. Scope

**In scope:**
- Pure `lib/version-edit.ts`: `VersionPatch` type, `buildVersionPatch(form)`, `validateVersionPatch(patch)` + tests.
- `lib/atomic.ts`: `getVersion(slug)` and `updateVersion(slug, patch)`.
- `app/admin/version/[slug]/page.tsx`: the pre-filled edit form page.
- `editVersionAction` in `app/admin/actions.ts`.
- A per-version `edit` link on `app/admin/atom/[id]/page.tsx`.

**Out of scope (→ later):**
- Downward visibility recompute / auto-re-privatizing parents on un-publish (a "recompute visibility" slice).
- Editing `slug` (identity), re-parenting, `media`, `source`, `content`, or `tags`.
- Deleting a Version outright (soft "un-publish" via state covers the common case).
- Any change to `filterPublic`, `getPublicDataset`, the public `/atom/[id]` page, or the promote/create paths.

---

## 3. Surfaces & data flow

**New page** `app/admin/version/[slug]/page.tsx` — server component, `export const dynamic =
"force-dynamic"`, gated by the existing `/admin/*` middleware (no per-page session check, matching the
other admin pages). `[slug]` is the version slug.

- Loads the version via `getVersion(slug)`; `null` → `notFound()`.
- Renders a form pre-filled with the version's `name`, `type`, `date`, `description`, and a `state`
  radio group (`draft` / `private` / `published`) defaulting to the version's current state.
- Shows the immutable `slug` and the parent atom ref as read-only context (not form fields).
- A hidden `slug` field carries the identity to the action.
- An `?error=` alert line (mirrors triage) renders a validation failure.
- A `← back` link to the version's atom-detail page (`/admin/atom/<atomSlug>`), or `/admin/vault` if
  the version has no atom parent.

**New link** on `app/admin/atom/[id]/page.tsx`: each version `<section>` gains an
`edit` link → `/admin/version/<version.slug>`.

**After a successful save**, `editVersionAction` redirects to the version's atom-detail page
`/admin/atom/<atomSlug>` (the surface the edit was launched from); if the version has no `atom:`
parent, it redirects to `/admin/vault`.

---

## 4. Pure logic — `lib/version-edit.ts`

Pure, DB-free, unit-tested (mirrors `lib/promote.ts`'s `buildVersionInput`/`validateVersionInput`,
scoped to the editable subset).

```ts
import type { VersionState } from "./data";

export interface VersionPatch {
  name: string;
  type: string;
  date: string;
  description: string;
  state: VersionState;
}

// Maps the edit form → the editable subset. Trims strings; state falls back to
// "draft" on a missing/unrecognized value (only "private"/"published" override).
export function buildVersionPatch(form: FormData): VersionPatch;

// Required-field guard. Mirrors validateVersionInput minus slug (immutable, from route).
// name, type, date required; description optional.
export function validateVersionPatch(
  p: VersionPatch,
): { ok: true } | { ok: false; error: string };
```

---

## 5. Write layer — `lib/atomic.ts`

Two additions:

```ts
// Single-version read for the edit-page prefill (projection drops _id).
export async function getVersion(slug: string): Promise<Version | null>;

// Updates ONLY the editable fields via $set. Never touches slug / parents / media /
// source / content, so an edit can never re-parent or drop carried media.
export async function updateVersion(slug: string, patch: VersionPatch): Promise<void>;
```

`updateVersion` issues `updateOne({ slug }, { $set: patch })`. Because `slug` never changes, there is
no unique-index collision path (no `SlugExistsError` to handle on update). The `$set` payload is
exactly the five `VersionPatch` fields — `parents`/`media`/`source`/`content` are structurally
excluded.

---

## 6. The action — `editVersionAction`

New server action in `app/admin/actions.ts`, structured like `promoteCaptureAction`:

1. `await requireSession()` (defense-in-depth, matching every mutating action).
2. `slug = String(formData.get("slug") ?? "")` — the immutable identity from the hidden field.
3. `existing = await getVersion(slug)`; if `null` → `redirect("/admin/vault")`.
4. `patch = buildVersionPatch(formData)`; `validateVersionPatch(patch)`; on failure →
   `redirect(\`/admin/version/${slug}?error=…\`)`. (`redirect` stays OUT of any try — it throws to
   control flow.)
5. `await updateVersion(slug, patch)`.
6. If `patch.state === "published"`: `const { moleculeSlugs, atomSlugs } =
   publishCascade(await loadRawSeed(), slug); await setPublic(moleculeSlugs, atomSlugs);` — the same
   upward, idempotent flip promote uses. For `draft`/`private`, no parent change (state-only
   un-publish, per §1's locked decision).
7. `revalidatePath("/admin")` (the vault and atom-detail pages are `force-dynamic`, so this only
   needs to cover the inbox surface; the public site is `force-dynamic` too and reflects the change
   immediately).
8. Compute `atomSlug` = first `atom:`-prefixed entry of `existing.parents`;
   `redirect(atomSlug ? \`/admin/atom/${atomSlug}\` : "/admin/vault")`.

---

## 7. Error handling

- **Version not found** on the page → `notFound()`; in the action → `redirect("/admin/vault")`.
- **Invalid patch** (blank name/type/date) → `redirect` back to the edit page with `?error=`; no write occurs.
- **DB errors** propagate (no recoverable slug-collision path, since slug is immutable).
- **`force-dynamic`** adds no new error surface.
- Auth is the existing `/admin/*` middleware plus the action's `requireSession()`.

---

## 8. Testing

Same pattern — pure logic unit-tested, glue/DB smoke-tested.

- **`buildVersionPatch`** — maps the five fields; trims; `state` falls back to `draft` on
  missing/garbage; accepts `private` and `published`.
- **`validateVersionPatch`** — missing `name`/`type`/`date` each rejected with its own message; an
  empty `description` is accepted; a full valid patch passes.
- **No new DB unit tests** for `getVersion`/`updateVersion` (consistent with the no-DB-in-`npm test`
  convention).
- **Manual smoke checklist:**
  1. Edit a version's `name`/`date`/`description` → persisted on reload of the edit page and shown on
     the atom-detail view.
  2. `draft` → `published` → the version appears on the public `/timeline` and its parent atom/molecule
     become public.
  3. `published` → `draft` → the version disappears from the public site; the parent stays public
     (may now render an empty public atom page — accepted, per the locked decision).
  4. Blank `name` → error line on the edit page, no write.
  5. `/admin/version/<bogus-slug>` → 404.

---

## 9. What this delivers

An existing Version becomes editable: correct its fields, publish it, or pull it back to
draft/private — all from a dedicated `/admin/version/[slug]` page launched off the atom-detail view.
Re-publishing reuses the proven upward cascade; un-publishing is a bounded, state-only flip that the
`force-dynamic` public site reflects immediately. The security-sensitive public projection
(`filterPublic`) and all create paths are untouched. Downward visibility recomputation (auto-
re-privatizing empty public parents) and Version deletion remain independent later slices.
