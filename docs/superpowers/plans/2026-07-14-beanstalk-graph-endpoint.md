# Beanstalk — Public Graph Endpoint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the graph playground's data contract (roadmap **G1**): `GET /api/graph` returning
the published-only dataset as `{ nodes, edges }`.

**Architecture:** Pure `toGraph(raw): Graph` serializer in a new `lib/graph.ts` (projection-
agnostic; prefixed-ref node ids incl. the new `version:` prefix; containment edges with the
both-ends prune rule). One `force-dynamic` GET route composing
`toGraph(filterPublic(await loadRawSeed()))`. No auth (data twin of the public pages), no caching
(D3's future target), no UI.

**Spec:** `docs/superpowers/specs/2026-07-14-beanstalk-graph-endpoint-design.md`

**Conventions:** node:test flat style, pure tests DB-free; App Router route handlers like
`app/api/inbox/route.ts`; baseline 139 tests / 121 pass / 18 skip, `npx tsc --noEmit` clean.

---

## Task 1: Pure serializer — `lib/graph.ts` (TDD)

- [ ] Tests in `lib/graph.test.ts` per spec §4: per-kind node mapping with **asserted absence** of
  `description`/`media`/`content`/`source`; containment edges (molecule→atom, atom→version);
  multi-parent → one edge per existing parent; duplicate refs dedupe; dangling refs emit no edge
  but keep the node; empty seed → empty graph; `toGraph(filterPublic(raw))` composition fixture
  (draft/private content produces neither nodes nor edges).
- [ ] Implement `GraphNode`/`GraphEdge`/`Graph` + `toGraph` per spec §3 (deterministic order;
  `tags` only when non-empty).
- [ ] `npx tsc --noEmit` + scoped tests green.

## Task 2: Route — `app/api/graph/route.ts`

- [ ] `export const dynamic = "force-dynamic"`; `GET` → `Response.json(toGraph(filterPublic(await
  loadRawSeed())))`. Errors propagate (public-page posture).
- [ ] `npx tsc --noEmit` green.

## Task 3: Docs (integration pass, not the implementation agent)

- [ ] README: "Public graph endpoint" section (contract, security posture, curl example).
- [ ] ROADMAP: G1 → Shipped; point D1/D2/D3/G2 notes at the live contract.

## Deferred to later specs / follow-ups

- G2 `relations[]` edges; G3 `neighbors()` resolver; D3 tagged caching of the blob; an
  authenticated full-vault graph for the admin.
