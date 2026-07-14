# Beanstalk — `relations[]` Non-Containment Edges — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-class non-containment edges (roadmap **G2**): `relations[]` on Version, scrubbed
fail-closed by `filterPublic`, serialized by `toGraph` with per-kind edges.

**Spec:** `docs/superpowers/specs/2026-07-14-beanstalk-relations-design.md`

**Conventions:** node:test flat style; pure logic unit-tested; zero CSS / zero client JS. Baseline
on this branch: 189 tests / 169 pass / 20 skip; `npx tsc --noEmit` clean (after `rm -rf .next`).

---

## Task 1: Model + projection scrub (TDD)

- [ ] `lib/data.ts`: `Relation` interface + `Version.relations?: Relation[]`; extend `filterPublic`
  to scrub kept versions' relations per spec §1 (target must survive the projection; absent field
  stays absent; pure — no input mutation). Tests: the full scrub matrix (spec §3) in
  `lib/visibility.test.ts` beside the existing `filterPublic` matrix.

## Task 2: Serializer (TDD)

- [ ] `lib/graph.ts`: `GraphEdge.kind: string`; emit relation edges (source = owning version's node
  id, target = `rel.ref`, kind = `rel.kind`) with the both-ends prune; dedup key gains `kind`.
  Tests per spec §3 incl. the composition fixture and a containment-regression check.

## Task 3: Surfaces + validators

- [ ] Public atom page dump: render `relations` as `kind → ref` list items (post-scrub).
- [ ] `scripts/apply-validators.ts`: extend the versions `$jsonSchema` if one exists (else no-op,
  verified).
- [ ] `npx tsc --noEmit` + full `npm test` + `npm run build` green.

## Deferred to later specs / follow-ups

- Authoring UI (A3-era editing; C2 suggestions); kind vocabulary; atom/molecule-level relations;
  `neighbors()` adjacency resolver (G3).
