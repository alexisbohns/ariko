# Beanstalk — `relations[]` Non-Containment Edges — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Roadmap:** Track G, item **G2** — the edges that make the graph playground interesting.

---

## 1. Context

`parents[]` is locked as **containment only** (it drives the privacy cascades and timeline
grouping). Everything else that connects work — a version *evolving from* another (demo → studio →
live), a song *featured in* a podcast episode, an atom *related to* a sibling project — has no home
in the model, so the live `/api/graph` contract (G1) can only draw trees. G2 adds the general edge.

### Decisions locked

| Decision | Choice |
|---|---|
| Model | `relations?: Relation[]` on **Version** (the unit of work), where `interface Relation { kind: string; ref: string }`. `ref` reuses the prefixed grammar — `version:<slug>`, `atom:<slug>`, or `molecule:<slug>`. `kind` is a free string (`evolves-from`, `featured-in`, …) — vocabulary curation is a later concern, the model doesn't gate it. Atoms/molecules don't get relations yet (a version-level edge can express cross-atom links; lift later if needed). |
| Direction | A relation belongs to (and points **from**) the version that declares it: `version:x —kind→ ref`. The graph client may render arrows or not — storage is directional, semantics per kind. |
| **Public projection scrub** | `filterPublic` prunes each kept version's `relations` to refs whose **target survives the projection** (kept version / kept atom / kept molecule). Fail-closed and central: private or draft slugs can never leak through the public pages' property dumps or the graph endpoint, no matter what a later consumer renders. Dangling refs are dropped by the same rule (target doesn't survive because it doesn't exist). |
| Graph serialization | `toGraph` emits `{ source: "version:<slug>", target: rel.ref, kind: rel.kind }` for each relation whose **both ends exist as nodes** in the serialized seed (the same prune rule as containment; belt-and-braces on top of the scrub for full-vault use). `GraphEdge.kind` widens from `"contains"` to `string`. Dedup key becomes `(source, target, kind)` — two kinds may link the same pair; duplicate containment edges keep deduping as before. |
| Referential integrity | **None, by design.** Deleting or un-publishing a relation target requires no cascade: the projection scrub and both-ends prune already hide the edge everywhere. This is the delete-tolerance the A2 spec promised. |
| Property dumps | The public atom page's dump renders `relations` as list items `kind → ref` (post-scrub, so refs are public); the admin atom-detail dump may show them raw (full-vault view). No other UI. |
| Authoring | **Deferred** (per roadmap): no form fields this slice. Relations enter via seed.yml (the migration's `$set: { ...v }` already carries unknown fields) or direct DB writes; C2 will suggest them, A3-era editing will author them. |
| Validators | `scripts/apply-validators.ts` checked; if the versions collection has a `$jsonSchema`, add an optional `relations` array schema (else no-op, as for B1). |

---

## 2. Scope

**In scope:** `Relation` type + `Version.relations` (`lib/data.ts`), the `filterPublic` scrub +
tests, `toGraph` relation edges + `GraphEdge.kind: string` + tests, public atom page dump line,
validators check.

**Out of scope:** authoring UI, kind vocabulary, atom/molecule-level relations, `?lang=`/filters on
the endpoint, reverse-edge queries (G3's `neighbors()`).

---

## 3. Testing

- **Scrub matrix (`filterPublic`):** relation to a kept published version → kept; to a draft/
  stateless version → dropped; to a private atom / private molecule → dropped; to a kept public
  atom/molecule → kept; dangling ref → dropped; version with no relations → field untouched
  (absent stays absent); versions NOT kept contribute nothing. Assert the scrub never mutates the
  input seed (pure).
- **Serializer:** relation edge emitted with its kind; both-ends prune (target not a node → no
  edge); `(source, target, kind)` dedup — same pair with two kinds emits two edges, duplicate
  identical relations emit one; containment edges unchanged (regression: existing suite passes).
- **Composition:** `toGraph(filterPublic(raw))` on a fixture where a published version relates to a
  draft version, a private atom, and a published sibling — only the sibling edge appears, and no
  scrubbed slug appears anywhere in the JSON (nodes or edges).

---

## 4. What this delivers

The graph gains its real edges — evolution lineages and cross-domain links — behind the same
fail-closed projection as everything else, with zero referential-integrity machinery. The
`/api/graph` contract grows additively (`kind` widens to `string`; new edges appear), so the D1
client consumes richer structure with no breaking change.
