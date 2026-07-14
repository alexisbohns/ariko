# Beanstalk Admin — Recompute Visibility on Un-publish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make un-publish walk visibility back **down** the lineage — an atom left with no published
version, and a molecule left with no public atom, are re-privatized automatically — so withdrawn work
leaves no empty public shell (roadmap **A1**).

**Architecture:** A pure `unpublishCascade(raw, versionSlug)` in `lib/data.ts` — the exact structural
mirror of `publishCascade` — feeds a new `setPrivate` write half in `lib/atomic.ts` (the mirror of
`setPublic`), wired into the `else` branch of `editVersionAction`. No UI change; no change to
`filterPublic`, `publishCascade`, or any create/promote path.

**Tech Stack:** TypeScript, MongoDB (via existing `lib/db`/`lib/atomic`/`lib/store`), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-07-14-beanstalk-admin-recompute-visibility-design.md`

**Conventions carried from prior slices:**
- Pure tests live next to their module (`lib/data.test.ts` already hosts the `publishCascade`
  matrix); `npm test` = `node --import tsx --test "lib/**/*.test.ts"`, no DB.
- The dataset passed to a cascade is loaded AFTER the version write, so the cascade evaluates the
  post-save state (existing `editVersionAction` ordering).
- **Baseline (`main`):** `npm test` → 109 pass / 16 skip; `npx tsc --noEmit` clean.

---

## File Structure

- `lib/data.ts` — **modify.** Add `unpublishCascade` directly after `publishCascade`.
- `lib/data.test.ts` — **modify.** Add the mirrored `unpublishCascade` matrix.
- `lib/atomic.ts` — **modify.** Add `setPrivate` next to `setPublic`.
- `app/admin/actions.ts` — **modify.** `else` branch in `editVersionAction`; extend imports.
- `README.md` — **modify.** Update the `/admin/version/[slug]` un-publish paragraph.
- `docs/superpowers/ROADMAP.md` — **modify.** Move A1 to Shipped; prune the edit-version deferred note.

**Untouched:** `filterPublic`, `publishCascade`, `lib/promote.ts`, all pages, all create paths.

---

## Task 1: Pure inverse cascade — `unpublishCascade` (TDD)

**Files:**
- Modify: `lib/data.test.ts` (tests first)
- Modify: `lib/data.ts`

- [ ] **Step 1: Write the failing tests** — append the `unpublishCascade` matrix to
  `lib/data.test.ts` (import it alongside `publishCascade`). Cases, mirroring the publish matrix:
  last-published-pulled flips atom+molecule; a published sibling version keeps the atom; another
  public atom keeps the molecule; multi-parent version unions independently-evaluated atoms; two
  flipped atoms sharing a molecule list it once; dangling atom/molecule refs ignored; parentless
  version → nothing; unknown slug → nothing; still-`published` version → nothing (its own state
  shelters its parents); an explicitly-private sibling atom does not count as "remaining public";
  inverse symmetry with `publishCascade` on a single-version lineage.
- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (`unpublishCascade` not exported).
- [ ] **Step 3: Implement** `unpublishCascade(raw, versionSlug)` in `lib/data.ts` directly after
  `publishCascade`, per spec §3: existing atom parents with no remaining `published` version; those
  atoms' existing molecule parents with no remaining `visibility !== "private"` atom once this
  pass's atoms are excluded; dangling refs ignored; visibility of flip targets not consulted
  (idempotent flip).
- [ ] **Step 4: Run to verify it passes** — `npm test` → all green, no regressions.
- [ ] **Step 5: Commit** — `feat: pure unpublishCascade (inverse of publishCascade)`

## Task 2: Write half — `setPrivate` in `lib/atomic.ts`

- [ ] **Step 1: Implement** `setPrivate(moleculeSlugs, atomSlugs)` directly after `setPublic`,
  identical shape (`updateMany` + `$set: { visibility: "private" }`, no-op on empty arrays).
- [ ] **Step 2: Typecheck + test** — `npx tsc --noEmit && npm test` (DB function; smoke-tested, per
  convention).
- [ ] **Step 3: Commit** — `feat: setPrivate (write half of the un-publish cascade)`

## Task 3: Wire into `editVersionAction`

- [ ] **Step 1:** In `app/admin/actions.ts`, import `unpublishCascade` (from `@/lib/data`, next to
  `publishCascade`) and `setPrivate` (from `@/lib/atomic`). Replace the state-only comment + publish
  `if` with the transition-gated `if / else if` from spec §5 (publish branch unchanged;
  `else if (existing.state === "published")` runs `unpublishCascade(await loadRawSeed(), slug)` →
  `setPrivate` — only an actual un-publish recomputes, so routine draft saves never touch
  seed-authored visibility).
- [ ] **Step 2: Typecheck + test** — `npx tsc --noEmit && npm test`.
- [ ] **Step 3: Commit** — `feat: recompute visibility on un-publish (editVersionAction)`

## Task 4: Smoke + docs

- [ ] **Step 1: Manual smoke** (dev DB) — spec §7 checklist: un-publish last version → atom AND
  molecule flip private, atom gone from public `/`; published sibling keeps atom; second public atom
  keeps molecule; draft re-save flips nothing.
- [ ] **Step 2: README** — in the `/admin/version/[slug]` section, replace the "Un-publishing … is
  state-only" paragraph with the recompute behavior.
- [ ] **Step 3: ROADMAP** — move A1 to **Shipped**; update A2's note (delete reuses
  `unpublishCascade`); prune the edit-version plan's deferred item.
- [ ] **Step 4: Commit** — `docs: document recompute-visibility on un-publish`

---

## Done — what this delivers

- `publishCascade`/`unpublishCascade` and `setPublic`/`setPrivate` form a symmetric, pure,
  unit-tested pair; the public projection is consistent in both directions.
- Un-publishing the last published version of a lineage removes the atom (and, when emptied, the
  molecule) from the public site entirely — no name, no shell. The recompute is gated on the actual
  published → non-published transition, so routine draft saves never flip visibility that was
  authored directly (seeded name-only public atoms are respected).

## Deferred to later specs / follow-ups

- **A2 · Delete a Version** — hard-delete, then reuse the recompute. Care: `unpublishCascade` needs
  the version's parents from the dataset, and an already-deleted slug is a defined no-op — so A2
  must capture `version.parents` **before** the delete (or extract the atom-level core of
  `unpublishCascade` into a shared helper) and evaluate sheltering against the post-delete dataset.
- **Read-side empty-shell pruning in `filterPublic`** — fail-closed belt-and-braces (spec §6);
  parked in the roadmap hardening appendix.
- **`updateVersion` → `setPrivate` non-transactionality** — same shape as the existing
  `createVersion` → `setPublic` gap; heals via a re-publish → un-publish cycle. Concurrent
  publish/un-publish compute-then-write races on one lineage (either direction can clobber the
  other's parent flip) are accepted at single-admin scale. Parked in the hardening appendix.
- **`buildVersionPatch` silently coerces an unrecognized `state` to `draft`** — pre-existing; now
  that un-publish cascades, consider rejecting instead. Parked in the hardening appendix.
