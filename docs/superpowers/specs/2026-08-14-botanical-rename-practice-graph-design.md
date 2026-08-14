# Slice 1 — Botanical rename + practice graph

**Date:** 2026-08-14
**Status:** Approved design. Child of the umbrella spec
[`2026-08-14-ariko-federation-design.md`](2026-08-14-ariko-federation-design.md) (§10, sub-project 1).
**Shape:** Two PRs. PR1 = mechanical botanical rename, zero behavior change.
PR2 = plant + bee species, re-tiering, domain retirement, garden seeding.

---

## 1. Goal

Put the botanical cosmology in the bones of ariko and turn its flat
molecule/atom model into the practice graph the federation needs:

- **plant → pod → bean → sprout** as the containment tiers; **seed** as the
  untriaged inbox item; the **beanstalk** as the growth timeline.
- **bee** as a dedicated operational species for integration bricks
  (adapters, routines, workflows, capabilities). Bees will carry **pollen**
  (the federation envelope, slice 2) between plants — out of scope here
  beyond reserving the name.
- The map seeded with every plant of the practice and the first bees, so
  later slices (adapters, read model, digests) have anchors to attach to.

## 2. Vocabulary and rename map (PR1)

| Today | Becomes | Notes |
|---|---|---|
| `Molecule` | `Pod` | container of beans |
| `Atom` | `Bean` | showcase-grade entity |
| `Version` | `Sprout` | dated growth event; populates the beanstalk |
| `Capture` | `Seed` | untriaged inbox item; seeds sprout via triage |
| `molecule:` / `atom:` / `version:` prefixes | `pod:` / `bean:` / `sprout:` | in parents[], relations[].ref, graph node ids, Mongo docs |
| collections `molecules/atoms/versions/captures` | `pods/beans/sprouts/seeds` | `renameCollection` + re-applied `$jsonSchema` validators |
| `data/seed.yml` | `data/garden.yml` | avoids seed-the-capture collision; refs rewritten by migration script |
| routes `/atom/[id]`, `/admin/atom`, `/admin/version` | `/bean/[id]`, `/admin/bean`, `/admin/sprout` | permanent redirects from old public paths |
| DB `beanstalk`, cookie `beanstalk_admin` | unchanged | correct again under the botanical commit |

Derived identifiers follow (`Dataset` methods, `filterPublic` internals,
admin actions, test names). PR1 is rename-only: the full suite must pass
with zero behavior change.

**Boundary compatibility (deliberate, the only alias):** the inbox keeps
accepting `suggested.molecule` from sibling repos' Lab Notes and maps it to
`suggested.plant` — those slugs (pbbls, femfolk, …) become plants in PR2,
and the lab-note transport itself retires in slice 3 for arkaik-mapped
repos. Internal code never aliases.

**Graph API:** `/api/graph` node ids switch to the new prefixes. Breaking;
its only planned consumer is the D1 playground. No compat layer.

## 3. New species (PR2)

### Plant

```ts
interface Plant {
  slug: string;
  name: Text;                      // bilingual, as elsewhere
  natures: ("work" | "tool")[];    // array: Melogram is both
  description: Text;
  visibility?: Visibility;         // default public, same rule as pods
  tags?: string[];
  relations?: Relation[];          // distributes | chronicles | uses | publishes-to | …
}
```

- Plants are the first non-sprout entities carrying `relations[]`; the
  articulation vocabulary (`distributes`, `chronicles`, `uses`,
  `publishes-to`, `monitors`) stays a free string as in G2 — curation later.
- **Containment:** pods gain `parents: ["plant:…"]`; beans may parent to
  pods **or directly to plants** (simple projects skip the pod tier). The
  `Domain` enum (`music | design | podcast`) is retired; the timeline groups
  by plant (`TimelineEntry.domain` → resolved plant).
- **Privacy:** `filterPublic` and the publish/unpublish cascades extend one
  tier up with identical fail-closed rules — a private plant hides its
  pods/beans/sprouts; publishing a sprout cascades visibility up to its
  plant; dangling refs ignored exactly as today.

### Bee

```ts
interface Bee {
  slug: string;
  name: Text;
  kind: "adapter" | "routine" | "workflow" | "capability";
  status: "planned" | "live" | "paused" | "broken";
  engine?: string;                 // claude-routine | gemini-action | action | …
  schedule?: string;               // human-readable or cron
  levers: { label: string; url?: string; ref?: string }[]; // workflow file, routine id, dashboard
  serves: string[];                // ["plant:femfolk", …]
  description: Text;
  visibility?: Visibility;         // DEFAULT PRIVATE — opt-in for D1 exhibition
}
```

- Own `bees` collection with `$jsonSchema` validator. **Outside the publish
  cascades entirely** — bees are operational, not content. The public graph
  projection includes only explicitly `visibility: "public"` bees.
- In this slice bees are registered, not fed: pollen ingestion and
  beanstalk rendering of bee activity arrive with slices 2–4.

## 4. Re-tiering migration + garden seeding (PR2)

- **Promote to plants** (natures work unless noted): pbbls, femfolk, teale,
  casa, pebblestones, enerfip.
- **Create plants:** bohns-music (work); melogram (work+tool,
  `distributes → plant:bohns-music`); arkaik (tool,
  `chronicles → plant:pbbls`, `chronicles → plant:femfolk`); ariko
  (work+tool); paulopus (work); oxymore (tool; read-only in practice — no
  automation ever targets it, per umbrella §6).
- **Re-parent:** albums wait-for-the-sun, celesta, republic-of-masquerade
  remain pods under `plant:bohns-music`; their beans and sprouts untouched.
- **Seed bees:** lab-note-pipeline (live, serves all mapped plants),
  song-identifier (live, capability, serves femfolk), arkaik-adapter,
  melogram-feed, femfolk-researcher, weekly-digest (all planned) — the map
  shows the federation's future before it runs.
- **Mechanics:** one idempotent script covering garden.yml and Mongo, with
  `--dry-run`; validators updated in the same PR; `scripts/migrate-seed.ts`
  and `scripts/apply-validators.ts` are the precedents to follow or extend.

## 5. Acceptance

**PR1**
- Full test suite green; diff is rename-only (no logic changes).
- Old public routes 308-redirect to new paths.
- Inbox accepts both `suggested.molecule` and `suggested.plant` (test both).
- Migration script converts a fixture of today's data byte-stably on re-run.

**PR2**
- Cascade tests extended to the plant tier: private plant hides descendants
  fail-closed; publish cascade climbs to plants; unpublish recompute honors
  sheltered plants (same shelter rule as molecules today).
- Re-tiering migration dry-run asserted against a fixture of the current
  garden; idempotent on re-run.
- Graph endpoint snapshot updated: plants and (public-only) bees present,
  `distributes`/`chronicles` edges rendered, both-ends prune still holds.
- Beans parented directly to a plant behave as first-class (dataset,
  filterPublic, timeline).
- Timeline groups by plant; no reference to `Domain` remains.

## 6. Out of scope

Pollen (federation envelope — slice 2); feeding bees with activity;
lab-note transport retirement (slice 3); read model and beanstalk feed
rendering (slice 4); any styling (D1 track); melogram/femfolk side work.
