# Beanstalk — Recompute Visibility on Un-publish — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md`
**Predecessor:** `2026-07-14-beanstalk-admin-edit-version-design.md` (edit/un-publish, merged) — this
closes the one deliberate gap that slice left open (roadmap item **A1**).

---

## 1. Context

The edit slice made un-publish **state-only** by design: flipping a Version off `published` hides it
from the public site (`filterPublic` only shows `published` versions), but a parent atom/molecule
that an earlier publish made `public` stays `public`. The result is an **empty public shell**: the
atom's name remains listed on the public directory with no published version under it.

That is not a content leak (`filterPublic` still hides the draft's fields), but it is more than
cosmetic: the **name and existence** of withdrawn work stays visible after the admin pulled it. The
system's own rule — *only published versions and their non-private lineage reach the public* — is
currently enforced in one direction only (upward on publish, via `publishCascade` + `setPublic`).
This slice adds the inverse direction, completing the loop:

- **publish** → `publishCascade` walks **up** and makes the lineage public;
- **un-publish** → `unpublishCascade` walks **down** the same lineage and re-privatizes parents that
  no longer shelter any published work.

### Decisions locked

| Decision | Choice |
|---|---|
| Shape | **A pure `unpublishCascade(raw, versionSlug)` in `lib/data.ts`**, the exact structural mirror of `publishCascade`: same signature, same return `{ moleculeSlugs, atomSlugs }`, same dangling-ref handling. (Rejected: a global whole-vault recompute — unbounded blast radius, touches lineages the admin didn't edit; a lineage-scoped pass matches the write that triggered it.) |
| Atom rule | An EXISTING atom parent of the version is re-privatized iff it has **no remaining `published` version** in the dataset. The dataset is loaded AFTER `updateVersion`, so the just-saved state is what's evaluated — if the version is still `published`, its own state keeps its parents public (the function is a safe no-op on published versions). |
| Molecule rule | An EXISTING molecule parent of a re-privatized atom is re-privatized iff it has **no remaining public atom** (`visibility !== "private"`, matching `filterPublic`'s read rule) once the atoms flipped in this same pass are excluded. Molecules of atoms that stay public are never candidates (they still shelter a public atom by definition). |
| Idempotence | Like `publishCascade`, current visibility of the flip targets is **not consulted** — re-privatizing an already-private parent is a no-op write. Running the recompute on any non-published save is therefore safe and **self-healing**: it also repairs empty shells left by un-publishes that happened before this slice shipped. |
| Wiring | `editVersionAction` only: `patch.state === "published"` keeps the existing publish branch; otherwise run `unpublishCascade(await loadRawSeed(), slug)` + `setPrivate(...)`. (Promote never needs it: a freshly created version can't empty a shell.) |
| Write half | **`setPrivate(moleculeSlugs, atomSlugs)` in `lib/atomic.ts`**, the exact mirror of `setPublic` (`updateMany` → `$set: { visibility: "private" }`, no-op on empty arrays). |
| Styling | No UI change at all — this is a write-path slice. Bare functional HTML everywhere, unchanged. |

---

## 2. Scope

**In scope:**
- Pure `unpublishCascade(raw, versionSlug)` in `lib/data.ts` + a mirrored test matrix in `lib/data.test.ts`.
- `setPrivate(moleculeSlugs, atomSlugs)` in `lib/atomic.ts`.
- The `else` branch in `editVersionAction` (`app/admin/actions.ts`).
- README + ROADMAP updates.

**Out of scope (→ later):**
- Version deletion (A2) — it will REUSE `unpublishCascade` (delete, then recompute the lineage).
- A global whole-vault visibility recompute / audit command.
- Read-side empty-shell pruning in `filterPublic` (defense-in-depth candidate, see §6).
- Any change to `filterPublic`, `publishCascade`, promote/create paths, or any page.

---

## 3. Pure logic — `unpublishCascade` in `lib/data.ts`

Placed directly after `publishCascade`, mirroring its doc-comment style:

```ts
export function unpublishCascade(
  raw: RawSeed,
  versionSlug: string,
): { moleculeSlugs: string[]; atomSlugs: string[] } 
```

Algorithm (pure, no visibility consulted on flip targets):
1. Find the version; unknown slug → `{ moleculeSlugs: [], atomSlugs: [] }`.
2. `atomSlugs` = the version's EXISTING `atom:` parents that have **no** version with
   `state === "published"` anywhere in `raw.versions` (the version's own just-saved state counts).
3. `moleculeSlugs` = the EXISTING `molecule:` parents of those atoms that have **no remaining atom**
   with `visibility !== "private"` among their children, after excluding the atoms in `atomSlugs`.
4. Dangling refs are ignored at both layers, exactly as in `publishCascade`/`filterPublic`.

Properties worth stating (and testing):
- **Inverse symmetry:** for a single-version lineage, `unpublishCascade` after an un-publish returns
  exactly what `publishCascade` returned at publish time.
- **No-op on published:** if the version's state in `raw` is still `published`, `atomSlugs` is empty
  (its own state shelters its parents), so nothing flips.

---

## 4. Write layer — `setPrivate` in `lib/atomic.ts`

```ts
// The write half of the un-publish cascade — the exact mirror of setPublic.
// No-op on empty arrays.
export async function setPrivate(moleculeSlugs: string[], atomSlugs: string[]): Promise<void>
```

`updateMany({ slug: { $in: ... } }, { $set: { visibility: "private" } })` per collection, guarded on
non-empty arrays, exactly like `setPublic`.

---

## 5. The action — `editVersionAction` (`app/admin/actions.ts`)

The publish branch is untouched. The current trailing comment ("Un-publishing … is state-only —
parents are intentionally left as-is") is replaced by the new behavior:

```ts
if (patch.state === "published") {
  const { moleculeSlugs, atomSlugs } = publishCascade(await loadRawSeed(), slug);
  await setPublic(moleculeSlugs, atomSlugs);
} else {
  // Downward recompute (A1): re-privatize parents that no longer shelter any
  // published version. Idempotent — a draft save under a still-published sibling
  // flips nothing; an empty shell left by an older un-publish is healed.
  const { moleculeSlugs, atomSlugs } = unpublishCascade(await loadRawSeed(), slug);
  await setPrivate(moleculeSlugs, atomSlugs);
}
```

Note the ordering guarantee this relies on: `updateVersion(slug, patch)` runs BEFORE
`loadRawSeed()`, so the cascade always evaluates the post-save state (this is already how the
publish branch works). Like `createVersion` → `setPublic`, the `updateVersion` → `setPrivate` pair
is not transactional — a crash in between leaves a hidden draft under a public parent, which
`filterPublic` renders safe (shell only, no content), and the next non-published save of any version
in that lineage self-heals it.

---

## 6. Explicitly considered and set aside

- **Read-side pruning in `filterPublic`** (drop public atoms with no published version at read
  time): strictly more fail-closed — it would make empty shells *impossible* regardless of stored
  visibility, even after a mid-write crash. Set aside for now because (a) the write-side recompute
  keeps the **vault's stored visibility truthful**, which the read-side approach alone would not,
  and (b) changing the public projection deserves its own slice with its own test matrix. Parked in
  the roadmap appendix as hardening.
- **"Pinned" visibility** (letting the admin hold a parent public with zero published versions,
  e.g. a teaser): no current requirement; visibility today is 100% cascade-managed. If teasers ever
  matter, that's a new field (`pinnedPublic?`), not an exception in the cascade.

---

## 7. Testing

Same convention — pure logic unit-tested exhaustively, glue smoke-tested manually.

**`unpublishCascade` matrix (`lib/data.test.ts`,** mirroring the `publishCascade` matrix**):**
- pulls the atom + its molecule when the last published version is un-published;
- keeps an atom (and everything above) when a **sibling published version** remains;
- flips the atom but keeps the molecule when the molecule still has **another public atom**;
- a multi-parent version: each atom parent evaluated independently, union returned;
- two flipped atoms sharing one molecule → the molecule appears once;
- dangling atom refs and dangling molecule refs are ignored;
- a parentless version → nothing; an unknown slug → nothing;
- **no-op on a still-published version** (its own state shelters its parents);
- already-private sibling atoms do **not** count as "remaining public" for the molecule rule;
- **inverse symmetry** with `publishCascade` on a single-version lineage.

**Manual smoke checklist:**
1. Publish a version (parents flip public) → un-publish it → the atom AND molecule flip back to
   `private` (check `/admin/atom/<slug>`), and the atom disappears from the public `/` directory.
2. Two published versions under one atom → un-publish one → atom/molecule stay `public`.
3. Two atoms under one molecule, each with a published version → un-publish one → its atom flips
   `private`, molecule stays `public`; un-publish the other → molecule flips `private`.
4. Save a draft version as draft again (no state change) under a published sibling → nothing flips.

---

## 8. What this delivers

The public projection becomes consistent in **both directions**: publishing lifts a lineage into the
exhibition, and un-publishing now walks the same lineage back down, so withdrawn work leaves no
public trace — no name, no empty shell. The cascade pair (`publishCascade`/`unpublishCascade`,
`setPublic`/`setPrivate`) is symmetric, pure, and unit-tested as mirrors of each other, and Version
deletion (A2) gets its visibility story for free.
