# Beanstalk — Bilingual `Text` Widening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen `name`/`description` to the existing `Text` type across the atomic model so
bilingual (en/fr) content survives from capture to exhibition (roadmap **B1**).

**Spec:** `docs/superpowers/specs/2026-07-14-beanstalk-text-widening-design.md`

**Conventions:** node:test flat style; pure logic unit-tested, glue smoke-tested; zero CSS / zero
client JS; `redirect()` outside `try`. Baseline on this branch: 164 tests / 144 pass / 20 skip,
`npx tsc --noEmit` clean (after `rm -rf .next`).

---

## Task 1: Model + pure helpers (TDD)

- [ ] `lib/data.ts`: widen the four field pairs to `Text`; add `textPart(value, lang)` (strict, no
  fallback; `string` counts as `en`) and `composeText(en, fr)` per spec; tests in `lib/data.test.ts`
  (or `lib/visibility.test.ts` beside `resolveText`'s).
- [ ] Let the compiler surface every read site; fix each per spec §1 "Rendering" (public pages,
  admin pages, `lib/vault.ts`, `lib/atom-detail.ts`, `lib/graph.ts` — builders resolve at build
  time, outputs stay `string`).

## Task 2: Write path — builders, validators, forms

- [ ] `lib/promote.ts`: `VersionInput.name/description: Text`; paired `versionNameFr`/
  `descriptionFr` fields; carry `capture.body` verbatim when both description fields blank;
  validation via `resolveText` non-empty. Mirror in `lib/version-edit.ts` (`nameFr`,
  `descriptionFr`, `textPart` prefills on the page).
- [ ] Triage + edit forms: add the optional `fr` inputs; prefill via `textPart`.
- [ ] `scripts/apply-validators.ts`: widen any string constraint on the four fields (check first —
  may be a no-op).
- [ ] Public atom page property dump: `description` renders via `resolveText`.

## Task 3: Validation

- [ ] `npx tsc --noEmit` + full `npm test` green; `npm run build` green.
- [ ] All pre-existing tests pass unchanged.

## Deferred to later specs / follow-ups

- `?lang=` param on public pages and `/api/graph`; bilingual parent-name authoring (A3/A4);
  `content` rendering (B3).
