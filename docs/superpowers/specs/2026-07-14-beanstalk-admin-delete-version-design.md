# Beanstalk — Delete a Version — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md`
**Predecessor:** `2026-07-14-beanstalk-admin-recompute-visibility-design.md` (A1, this branch) — delete
reuses the downward recompute (roadmap item **A2**).

---

## 1. Context

Un-publish (A1) soft-hides a Version and walks visibility back down its lineage. What it cannot do
is remove the Version from the vault: a mistaken promote, a duplicate, or an abandoned experiment
stays in `versions` forever. This slice adds the destructive half of the admin write surface:
**hard-delete a Version**, with the same visibility guarantee A1 established — deleting the last
published version of a lineage must not leave an empty public shell.

The one sharp edge (caught in A1's review and documented in the ROADMAP): `unpublishCascade(raw,
versionSlug)` reads the version's parents **from the dataset** and is a defined no-op on an unknown
slug — so calling it after the delete, against a dataset where the version no longer exists,
silently does nothing. The recompute must therefore be keyed by the version's **atom parents,
captured before the delete**, and evaluated against the **post-delete** dataset.

### Decisions locked

| Decision | Choice |
|---|---|
| Core extraction | Extract the atom-level core of `unpublishCascade` as **`unpublishCascadeForAtoms(raw, atomSlugs)`** in `lib/data.ts` (pure): given candidate atom slugs, return the EXISTING atoms with no sheltering published version, and their EXISTING molecule parents left with no surviving public atom. `unpublishCascade(raw, versionSlug)` becomes a thin adapter: find the version, pass its `atom:` parent slugs to the core (unknown slug → no-op, unchanged). All existing A1 semantics and tests hold verbatim. |
| Delete semantics | **Hard delete**: `deleteOne({ slug })` from `versions`. No tombstone, no soft-delete state — `draft`/`private` already cover "keep but hide". |
| Visibility recompute | Only when the deleted version **was published** (`existing.state === "published"`, read before the delete — the transition mirror of A1's gate; deleting a draft/private version cannot change the public projection). Capture `atom:` parent slugs BEFORE the delete; after the delete, `unpublishCascadeForAtoms(await loadRawSeed(), capturedSlugs)` → `setPrivate`. |
| Dangling references | A deleted version may be referenced by a capture's `promotedTo` and (later) by `relations[]`. **No reference cascade** — the codebase is uniformly dangling-ref-tolerant on reads (`buildDataset`, `filterPublic`, the cascades), and the future graph serializer prunes edges with a missing end. Document, don't engineer. |
| Surface | A **"Danger zone"** section at the bottom of the existing `/admin/version/[slug]` edit page: a separate form (own action) with a required "yes, permanently delete this version" checkbox and a Delete button. No new page. Zero CSS / zero client JS as everywhere; the checkbox's `required` is browser-enforced, and the action **re-checks it server-side** (fail → redirect back with `?error=`). |
| After delete | `revalidatePath("/admin")`, redirect to the version's atom-detail page (`/admin/atom/<atomSlug>`) or `/admin/vault` when parentless — the same landing logic as the edit action. |

---

## 2. Scope

**In scope:**
- `lib/data.ts`: extract `unpublishCascadeForAtoms` (pure core); `unpublishCascade` becomes an adapter.
- `lib/data.test.ts`: core-level tests, incl. the delete-shaped case (atoms evaluated against a
  dataset where the version is already gone).
- `lib/atomic.ts`: `deleteVersion(slug)`.
- `lib/atomic.test.ts`: DB-gated delete tests.
- `deleteVersionAction` in `app/admin/actions.ts`.
- Danger-zone form on `app/admin/version/[slug]/page.tsx`.
- README + ROADMAP updates (in the docs pass, not the implementation pass).

**Out of scope (→ later):**
- Deleting atoms/molecules (childful containers; a different, more careful slice).
- Cleaning `promotedTo` refs on captures; un-promoting (returning a capture to the inbox).
- Any change to `filterPublic`, `publishCascade`, promote/create paths.

---

## 3. Pure logic — `lib/data.ts`

```ts
// Atom-level core of the downward recompute. Callers that still have the version
// (un-publish) adapt via unpublishCascade; callers that no longer do (delete) pass
// the atom parents they captured before the write. Pure; same sheltering rules and
// dangling-ref tolerance as A1.
export function unpublishCascadeForAtoms(
  raw: RawSeed,
  atomSlugs: string[],
): { moleculeSlugs: string[]; atomSlugs: string[] }

export function unpublishCascade(raw, versionSlug) {
  const version = (raw.versions ?? []).find((v) => v.slug === versionSlug);
  if (!version) return { moleculeSlugs: [], atomSlugs: [] };
  return unpublishCascadeForAtoms(raw, parentsWithPrefix(version.parents, ATOM_PREFIX));
}
```

The core keeps the two sheltered-set passes exactly as shipped in A1 (published versions shelter
atoms; surviving public atoms shelter molecules); candidate slugs are deduped and
existence-filtered, exactly as before.

---

## 4. Write layer — `lib/atomic.ts`

```ts
// Hard delete. Idempotent — deleting a missing slug is a no-op (deleteOne matches 0).
export async function deleteVersion(slug: string): Promise<void>
```

---

## 5. The action — `deleteVersionAction` (`app/admin/actions.ts`)

1. `await requireSession()`.
2. `slug` from the hidden field; `confirm` must be `"on"` (the checkbox) — otherwise
   `redirect(/admin/version/${slug}?error=…)`. Server-side re-check; the browser `required` is UX.
3. `existing = await getVersion(slug)`; `null` → `redirect("/admin/vault")`.
4. Capture BEFORE the delete: `atomSlugs` = `atom:`-prefixed parent slugs of `existing`;
   `wasPublished = existing.state === "published"`.
5. `await deleteVersion(slug)`.
6. If `wasPublished`: `const flips = unpublishCascadeForAtoms(await loadRawSeed(), atomSlugs);`
   `await setPrivate(flips.moleculeSlugs, flips.atomSlugs);` — the dataset is loaded AFTER the
   delete, so the deleted version cannot shelter anything; the captured slugs replace the lookup
   that would otherwise no-op.
7. `revalidatePath("/admin")`; redirect to `/admin/atom/<first atom parent>` or `/admin/vault`.

Same non-transactionality posture as A1 (`deleteVersion` → `setPrivate` crash gap leaves a shell;
`filterPublic` keeps it content-safe; heals via publish → un-publish of a sibling, or is moot once
read-side pruning ships). `redirect()` stays out of `try`.

---

## 6. Testing

**Pure (`lib/data.test.ts`):** all existing `unpublishCascade` tests pass unchanged (adapter). New
core tests:
- delete-shaped: atoms passed explicitly, evaluated against a dataset that does NOT contain the
  deleted version — last-published-deleted flips atom+molecule; a published sibling shelters.
- unknown/dangling atom slugs are ignored; empty input → nothing.
- adapter equivalence: `unpublishCascade(raw, slug)` === `unpublishCascadeForAtoms(raw, thatVersionsAtomRefs)`.

**DB-gated (`lib/atomic.test.ts`):** `deleteVersion` removes the doc; deleting a missing slug does
not throw.

**Manual smoke:** delete the last published version → atom (and emptied molecule) flip private,
gone from public `/`; delete a draft under a published sibling → nothing flips; unchecked confirm →
error, nothing deleted; deleted slug's edit page → 404.

---

## 7. What this delivers

The admin write surface gains its destructive half with the same both-directions visibility
guarantee: publish lifts, un-publish and **delete** walk back down. The recompute core is now
keyed by atoms, which is also exactly the shape A3 (re-parent) will need for the OLD lineage.
