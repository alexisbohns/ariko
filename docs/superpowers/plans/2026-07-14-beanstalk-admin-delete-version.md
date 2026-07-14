# Beanstalk Admin — Delete a Version — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-delete a Version from the vault with the A1 visibility guarantee intact — deleting
the last published version of a lineage re-privatizes the emptied parents (roadmap **A2**).

**Architecture:** Extract the atom-level core of `unpublishCascade` as pure
`unpublishCascadeForAtoms(raw, atomSlugs)` (`lib/data.ts`); `unpublishCascade` becomes a thin
adapter (all A1 tests unchanged). A new `deleteVersion` write (`lib/atomic.ts`) and
`deleteVersionAction` (`app/admin/actions.ts`) that captures the atom parents and the published
state **before** the delete, then recomputes against the post-delete dataset. Surface: a
"Danger zone" confirm-checkbox form on the existing `/admin/version/[slug]` page.

**Spec:** `docs/superpowers/specs/2026-07-14-beanstalk-admin-delete-version-design.md`

**Conventions:** node:test flat style, pure tests DB-free, DB tests `{ skip: !hasDb }` with
`__test__` slugs + cleanup; `redirect()` outside `try`; zero CSS / zero client JS; baseline
139 tests / 121 pass / 18 skip, `npx tsc --noEmit` clean.

---

## Task 1: Core extraction — `unpublishCascadeForAtoms` (TDD)

- [ ] Add core tests to `lib/data.test.ts`: delete-shaped evaluation (explicit atom slugs against a
  dataset WITHOUT the deleted version: last-published-deleted flips atom+molecule; published sibling
  shelters), unknown/dangling slugs ignored, empty input → nothing, adapter equivalence with
  `unpublishCascade`.
- [ ] Extract the core in `lib/data.ts` per spec §3; `unpublishCascade` delegates. A1 tests must
  pass unchanged.
- [ ] `npx tsc --noEmit` + scoped tests green.

## Task 2: Write layer — `deleteVersion`

- [ ] `deleteVersion(slug)` in `lib/atomic.ts` (`deleteOne`, idempotent).
- [ ] DB-gated tests in `lib/atomic.test.ts`: removes the doc; missing slug does not throw.

## Task 3: Action + danger zone

- [ ] `deleteVersionAction` in `app/admin/actions.ts` per spec §5 (server-side `confirm` re-check;
  capture parents + `wasPublished` before delete; recompute via `unpublishCascadeForAtoms` +
  `setPrivate` only when `wasPublished`; redirect like the edit action).
- [ ] Danger-zone form on `app/admin/version/[slug]/page.tsx`: separate `<form>` with hidden
  `slug`, required confirm checkbox, Delete button; renders the existing `?error=` alert.
- [ ] `npx tsc --noEmit` + scoped tests green.

## Task 4: Docs (integration pass, not the implementation agent)

- [ ] README: delete paragraph under `/admin/version/[slug]`.
- [ ] ROADMAP: A2 → Shipped; prune per-plan deferred notes.

## Deferred to later specs / follow-ups

- Deleting atoms/molecules; cleaning capture `promotedTo` refs; un-promote back to inbox.
- `deleteVersion` → `setPrivate` crash gap: same posture as A1 (content-safe shell; heals via a
  sibling publish → un-publish, or read-side pruning).
