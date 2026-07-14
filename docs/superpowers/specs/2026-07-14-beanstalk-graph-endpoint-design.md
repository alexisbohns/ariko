# Beanstalk — Public Graph Projection Endpoint (`GET /api/graph`) — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Parent spec:** `2026-07-13-beanstalk-vault-spine-design.md`
**Roadmap:** Track G, item **G1** — the graph playground's data contract.

---

## 1. Context

The public exhibition's end-state is an interactive graph playground. That client is a rendering
problem **only if** the published-only dataset is reachable as data; today the public zone serves
server-rendered HTML exclusively (no GET endpoint under `app/api/` returns anything). G1 closes
that gap with the smallest possible contract: a pure serializer from the already-proven public
projection to `{ nodes, edges }`, exposed as one unauthenticated, `force-dynamic` GET route.

Security posture is inherited, not invented: the route composes **`filterPublic` ∘ `loadRawSeed`**,
the same pure projection every public page passes through — the endpoint can never expose more than
the public HTML already does.

### Decisions locked

| Decision | Choice |
|---|---|
| Serializer | **Pure `toGraph(raw: RawSeed): Graph`** in a new `lib/graph.ts`. Projection-agnostic: it serializes whatever `RawSeed` it is given (the route feeds it the public projection; a future admin vault-graph can feed it the full dataset). |
| Node identity | `id` = the existing prefixed-ref grammar: `molecule:<slug>`, `atom:<slug>`, plus the new `version:<slug>`. Slugs are immutable (locked since the edit slice), so node ids are **stable across publishes** — the graph client can persist layout/camera state against them. |
| Node payload — minimal v1 | `{ id, kind, name }` plus per-kind attrs: `domain` (molecule), `type`/`date` (version), `tags` (all kinds, when present). **Deliberately excluded for now:** `description`, `content`, `media`, `source` — what a focused node *displays* is B3's (embed rendering) decision; the contract grows additively when that lands. |
| Edges | Containment only (that's all the model has until G2 `relations[]`): `{ source: parentId, target: childId, kind: "contains" }` for molecule→atom and atom→version, derived from `parents[]`. **Prune, don't cascade:** an edge is emitted only when BOTH ends exist as nodes in the serialized dataset — dangling refs and cross-visibility edges silently drop, matching every existing read path. Duplicate parent refs dedupe. |
| Route | `app/api/graph/route.ts`: `export const dynamic = "force-dynamic"`; `GET` → `Response.json(toGraph(filterPublic(await loadRawSeed())))`. Public (no auth) — it is the data twin of the public pages. DB errors propagate (500), same posture as the public pages. |
| Caching | None now. G1 is D3's designated primary cache target (one blob + `revalidateTag` on publish/un-publish) if traffic ever warrants. |

---

## 2. Scope

**In scope:** `lib/graph.ts` (+ types), `lib/graph.test.ts`, `app/api/graph/route.ts`,
README + ROADMAP updates (docs pass).

**Out of scope (→ later):** `relations[]` edges (G2), the shared `neighbors()` resolver (G3), any
graph UI (D1), caching (D3), an authenticated full-vault variant.

---

## 3. Shape — `lib/graph.ts`

```ts
export interface GraphNode {
  id: string;                       // "molecule:slug" | "atom:slug" | "version:slug"
  kind: "molecule" | "atom" | "version";
  name: string;
  domain?: Domain;                  // molecules only
  type?: string;                    // versions only
  date?: string;                    // versions only
  tags?: string[];                  // any kind, only when non-empty
}

export interface GraphEdge {
  source: string;                   // container node id
  target: string;                   // contained node id
  kind: "contains";
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function toGraph(raw: RawSeed): Graph
```

Deterministic: nodes in input order (molecules, atoms, versions); edges in child input order;
duplicate `(source, target)` pairs deduped.

---

## 4. Testing

Pure `lib/graph.test.ts` (node:test, no DB):
- node mapping per kind — exact field set, no `description`/`media`/`content`/`source` leakage
  (assert absent keys);
- containment edges for molecule→atom and atom→version; multi-parent → one edge per existing
  parent; duplicate refs dedupe;
- dangling parent refs emit NO edge (both-ends rule); the node itself is still emitted;
- empty/absent collections → `{ nodes: [], edges: [] }`;
- **projection composition:** `toGraph(filterPublic(raw))` on a mixed fixture — draft/stateless
  versions produce no node, a private atom's surviving published version drops with it (cascade),
  and no edge points at a filtered node.

Route is thin glue (smoke: `curl /api/graph` returns JSON with only published content).

---

## 5. What this delivers

The graph playground's data contract, live before any design exists: stable slug-based node ids,
containment edges, and the published-only guarantee inherited from `filterPublic`. D1 renders it,
G2 enriches it with `relations[]` edges, D2 returns refs into it, D3 caches it — all against this
one endpoint.
