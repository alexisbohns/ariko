# Plants + Bees (Slice 1, PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `Plant` and `Bee` species to ariko's botanical model, extend the privacy cascades and graph one tier up, retire the `Domain` enum, and run the re-tiering migration that promotes the practice's projects to plants and seeds the first bees.

**Architecture:** Additive-first, mirroring PR1's scaffolding approach: Task 1 introduces `Plant`/`Bee` and the `plant:` prefix while `Pod.domain` becomes *temporarily optional*; Tasks 2–8 migrate each subsystem (projection, cascades, graph, DB layer, inbox, admin, pages) tier-by-tier with the suite green at every commit; Task 9 deletes `Domain` entirely. Tasks 10–12 build the re-tiering as a **pure, idempotent transform** (`lib/retier.ts`, tested against the real `data/garden.yml`) driven by one `--dry-run`-capable script that rewrites both the YAML and Mongo. Bees ride inside `RawGarden` so `filterPublic` (default-**private**, fail-closed) and `toGraph` handle them with the same machinery as content — but they are **outside the publish cascades entirely**.

**Tech Stack:** Next.js 15 App Router, TypeScript 5.7, MongoDB driver, js-yaml, `node --test` + tsx.

**Spec:** `docs/superpowers/specs/2026-08-14-botanical-rename-practice-graph-design.md` (§3–§5)

**Verification commands used throughout** (run from repo root):
- Typecheck: `npx tsc --noEmit`
- Tests: `npm test`
- Both must pass at every commit.

**⚠️ Production caution:** `.env.local` points at the **production** Atlas DB — there is no separate dev DB. No task before Task 12 touches Mongo. Task 12 (the migration run) always starts with `--dry-run` and is executed together with the deploy of the merged PR, exactly like PR1's `migrate:botanical`.

**Design decisions locked in this plan** (rationale in the spec unless noted):
- `plantForBean` resolution order: a bean's first resolvable **direct plant parent** wins; otherwise the first resolvable pod parent's first resolvable plant parent. Deterministic, parents-array order.
- `GraphNode` drops `domain`, gains `natures` (plants only) and `status` (bees only); the existing `type` field is reused for `bee.kind` — the shape widens minimally.
- Seeded bees: the two **live** bees (`lab-note-pipeline`, `song-identifier`) are seeded `visibility: "public"` (that IS the opt-in exhibition); the four **planned** bees stay default-private.
- Triage form finally sheds the PR1-leftover `Molecule`/`Atom`/`Version` field names (`newMoleculeSlug` → `newPodSlug`, `versionSlug` → `sproutSlug`, …) while it is being restructured for plants anyway.
- The re-tiering catalog treats "promote" and "create" uniformly: any catalog slug that still exists as a pod is absorbed (visibility/tags carried over, its beans re-parented `plant:<slug>`), so a stray `ariko` pod created via triage in prod can never end up duplicated next to the `ariko` plant.

---

## File structure

| File | Change |
|---|---|
| `lib/data.ts` | `Plant`, `Bee`, `PlantNature`, `PLANT_PREFIX`, `BEE_PREFIX`; `RawGarden.plants/bees`; plant-aware `buildDataset`, `filterPublic`, cascades; `Domain` deleted at the end |
| `lib/data.test.ts` | dataset + cascade tests one tier up; `plantSlugs: []` added to every existing cascade assertion |
| `lib/visibility.test.ts` | plant-tier `filterPublic` matrix + bee projection tests |
| `lib/graph.ts` / `lib/graph.test.ts` | plant + bee nodes, `contains`/relation/`serves` edges, both-ends prune |
| `lib/botanical.ts` | `listPlants`, plant/bee indexes, `createPod`/`createBean` re-parenting, `setPublic`/`setPrivate` gain `plantSlugs` |
| `lib/store.ts` | `loadRawGarden` loads `plants` + `bees` |
| `lib/inbox.ts` / `lib/inbox.test.ts` | `suggested.moleculeSlug` boundary alias now maps to `plantSlug` |
| `lib/promote.ts` / `lib/promote.test.ts` | sprout form-field renames |
| `lib/vault.ts` / `lib/vault.test.ts` | `domain` filter → `plant` filter, `distinctPlants` |
| `lib/bean-detail.ts` / `lib/bean-detail.test.ts` | `domain` → `plant` (slug) |
| `lib/retier.ts` / `lib/retier.test.ts` | **new** — pure re-tiering transform + catalogs, tested against `data/garden.yml` |
| `app/admin/actions.ts` | plant-aware promote, 3-tier cascade calls, `DOMAINS` deleted |
| `app/admin/triage/[id]/page.tsx` | Plant fieldset replaces the domain select; botanical field names |
| `app/admin/vault/page.tsx`, `app/admin/bean/[id]/page.tsx`, `app/admin/sprout/[slug]/page.tsx` | plant column/line; PR1-leftover labels fixed |
| `app/page.tsx`, `app/timeline/page.tsx` | directory groups by plant; timeline filters by plant |
| `scripts/migrate-retier.ts` | **new** — garden.yml + Mongo re-tiering, `--dry-run` |
| `scripts/migrate-garden.ts`, `scripts/apply-validators.ts` | plants/bees upserts, indexes, validators |
| `package.json` | `migrate:retier` script |

---

### Task 0: Branch

**Files:** none

- [ ] **Step 1: Create the working branch off main**

```bash
git checkout main && git pull && git checkout -b feat/plants-bees
```

- [ ] **Step 2: Verify baseline is green**

Run: `npx tsc --noEmit && npm test`
Expected: exit 0, all tests pass. If not, STOP and report — the baseline must be green before starting.

---

### Task 1: Plant & Bee species + plant-aware Dataset

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/data.test.ts`

- [ ] **Step 1: Write the failing dataset tests**

Append to `lib/data.test.ts` (fixtures in this file build `RawGarden` literals; follow the existing style):

```ts
// --- Plant tier (slice 1 PR2): containment one tier up. ---

const PLANTED: RawGarden = {
  plants: [
    { slug: "bohns-music", name: "Bohns Music", natures: ["work"], description: "" },
    { slug: "pbbls", name: "Pebbles", natures: ["work"], description: "" },
  ],
  pods: [
    { slug: "celesta", name: "Celesta", description: "", parents: ["plant:bohns-music"] },
    { slug: "orphan-pod", name: "Orphan", description: "", parents: ["plant:ghost"] },
  ],
  beans: [
    { slug: "felina", name: "Felina", parents: ["pod:celesta"] },
    { slug: "pbbls-webapp", name: "Webapp", parents: ["plant:pbbls"] },
    { slug: "loose", name: "Loose", parents: [] },
  ],
  sprouts: [
    { slug: "felina-0", name: "F0", type: "song", date: "2026-01-01", description: "", parents: ["bean:felina"] },
    { slug: "webapp-0", name: "W0", type: "feature", date: "2026-01-02", description: "", parents: ["bean:pbbls-webapp"] },
  ],
};

test("buildDataset exposes plants, pods-per-plant and unrooted pods", () => {
  const d = buildDataset(PLANTED);
  assert.deepEqual(d.getPlants().map((p) => p.slug), ["bohns-music", "pbbls"]);
  assert.deepEqual(d.podsForPlant("bohns-music").map((p) => p.slug), ["celesta"]);
  assert.deepEqual(d.unrootedPods().map((p) => p.slug), ["orphan-pod"]); // dangling plant ref = unrooted
});

test("buildDataset treats a bean parented directly to a plant as first-class, not standalone", () => {
  const d = buildDataset(PLANTED);
  assert.deepEqual(d.beansForPlant("pbbls").map((b) => b.slug), ["pbbls-webapp"]);
  assert.deepEqual(d.standaloneBeans().map((b) => b.slug), ["loose"]);
});

test("plantForBean resolves via the pod chain, direct plant parents winning over the pod route", () => {
  const d = buildDataset(PLANTED);
  assert.equal(d.plantForBean("felina")?.slug, "bohns-music"); // bean -> pod -> plant
  assert.equal(d.plantForBean("pbbls-webapp")?.slug, "pbbls"); // bean -> plant direct
  assert.equal(d.plantForBean("loose"), null);
  const both = buildDataset({
    ...PLANTED,
    beans: [{ slug: "b", name: "B", parents: ["pod:celesta", "plant:pbbls"] }],
  });
  assert.equal(both.plantForBean("b")?.slug, "pbbls"); // direct wins
});

test("timelineSprouts carries the resolved plant on each entry", () => {
  const d = buildDataset(PLANTED);
  const byslug = new Map(d.timelineSprouts().map((e) => [e.sprout.slug, e]));
  assert.equal(byslug.get("felina-0")?.plant?.slug, "bohns-music");
  assert.equal(byslug.get("webapp-0")?.plant?.slug, "pbbls");
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test`
Expected: FAIL — `getPlants is not a function` / type errors on `plants:` in fixtures.

- [ ] **Step 3: Implement in `lib/data.ts`**

Add after the `Visibility` types:

```ts
export type PlantNature = "work" | "tool";

// Top tier of the practice graph (slice 1 PR2). Plants are roots — they carry
// no parents[]; pods and beans parent INTO them. relations[] carries the
// articulation vocabulary (distributes | chronicles | uses | publishes-to |
// monitors) as free strings, same G2 rule as sprout relations.
export interface Plant {
  slug: string;
  name: Text;
  natures: PlantNature[]; // array: melogram is both work AND tool
  description: Text;
  visibility?: Visibility; // default treated as "public", same rule as pods
  relations?: Relation[];
  tags?: string[];
}

// Operational species (slice 1 PR2): integration bricks, NOT content. Outside
// the publish cascades entirely, and default-PRIVATE (the opposite of every
// content tier) — public exhibition is an explicit per-bee opt-in.
export interface BeeLever {
  label: string;
  url?: string;
  ref?: string; // workflow file path, routine id, …
}
export interface Bee {
  slug: string;
  name: Text;
  kind: "adapter" | "routine" | "workflow" | "capability";
  status: "planned" | "live" | "paused" | "broken";
  engine?: string; // claude-routine | gemini-action | action | …
  schedule?: string; // human-readable or cron
  levers: BeeLever[];
  serves: string[]; // ["plant:femfolk", …]
  description: Text;
  visibility?: Visibility; // default treated as "private"
}
```

Change `Pod` (domain optional is TEMPORARY — Task 9 deletes it):

```ts
export interface Pod {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  domain?: Domain; // TEMPORARY optional during PR2 — deleted in the Domain-retirement task
  parents?: string[]; // containment ONLY, e.g. ["plant:bohns-music"] (PR2)
  description: Text;
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}
```

Update `Bean.parents`'s comment to `// containment ONLY: "pod:…" and/or "plant:…" refs — a bean may skip the pod tier`.

Extend `RawGarden`:

```ts
export interface RawGarden {
  plants?: Plant[];
  pods?: Pod[];
  beans?: Bean[];
  sprouts?: Sprout[];
  bees?: Bee[];
}
```

Add prefixes next to the existing ones:

```ts
export const PLANT_PREFIX = "plant:";
export const BEE_PREFIX = "bee:";
```

Extend `TimelineEntry` (keep `domain` until Task 9):

```ts
export interface TimelineEntry {
  sprout: Sprout;
  bean: Bean | null;
  plant: Plant | null;
  domain: Domain | null; // TEMPORARY — deleted in the Domain-retirement task
}
```

Extend `Dataset`:

```ts
export interface Dataset {
  getPlants(): Plant[];
  podsForPlant(slug: string): Pod[];
  beansForPlant(slug: string): Bean[]; // beans parented DIRECTLY to the plant
  unrootedPods(): Pod[]; // pods with no resolvable plant parent
  plantForBean(slug: string): Plant | null;
  getPods(): Pod[];
  beansForPod(slug: string): Bean[];
  standaloneBeans(): Bean[]; // no resolvable pod NOR plant parent
  getBean(slug: string): Bean | undefined;
  sproutsForBean(slug: string): Sprout[];
  timelineSprouts(): TimelineEntry[];
  domainForBean(slug: string): Domain | null; // TEMPORARY — deleted in the Domain-retirement task
}
```

In `buildDataset`, add plant indexing before the bean loop:

```ts
const plants = raw.plants ?? [];
const plantBySlug = new Map(plants.map((p) => [p.slug, p]));

// plant slug -> pods (in garden order); only resolvable plant refs.
const podsByPlant = new Map<string, Pod[]>();
const unrooted: Pod[] = [];
for (const pod of pods) {
  const plantSlugs = parentsWithPrefix(pod.parents, PLANT_PREFIX).filter((s) => plantBySlug.has(s));
  if (plantSlugs.length === 0) {
    unrooted.push(pod);
    continue;
  }
  for (const p of plantSlugs) {
    const list = podsByPlant.get(p) ?? [];
    list.push(pod);
    podsByPlant.set(p, list);
  }
}
```

Rewrite the bean loop so a direct plant parent counts (a bean is standalone only with neither tier resolvable):

```ts
const beansByPod = new Map<string, Bean[]>();
const beansByPlant = new Map<string, Bean[]>();
const standalone: Bean[] = [];
for (const bean of beans) {
  const podSlugs = parentsWithPrefix(bean.parents, POD_PREFIX).filter((s) => podBySlug.has(s));
  const plantSlugs = parentsWithPrefix(bean.parents, PLANT_PREFIX).filter((s) => plantBySlug.has(s));
  if (podSlugs.length === 0 && plantSlugs.length === 0) {
    standalone.push(bean); // no parent, or only dangling refs
    continue;
  }
  for (const p of podSlugs) {
    const list = beansByPod.get(p) ?? [];
    list.push(bean);
    beansByPod.set(p, list);
  }
  for (const p of plantSlugs) {
    const list = beansByPlant.get(p) ?? [];
    list.push(bean);
    beansByPlant.set(p, list);
  }
}
```

Add `plantForBean` next to `domainForBean`:

```ts
function plantForBean(slug: string): Plant | null {
  const bean = beanBySlug.get(slug);
  if (!bean) return null;
  // A direct plant parent wins; then the first resolvable pod's first plant.
  for (const p of parentsWithPrefix(bean.parents, PLANT_PREFIX)) {
    const plant = plantBySlug.get(p);
    if (plant) return plant;
  }
  for (const podSlug of parentsWithPrefix(bean.parents, POD_PREFIX)) {
    const pod = podBySlug.get(podSlug);
    if (!pod) continue;
    for (const pl of parentsWithPrefix(pod.parents, PLANT_PREFIX)) {
      const plant = plantBySlug.get(pl);
      if (plant) return plant;
    }
  }
  return null;
}
```

In the `timeline` mapping, add `plant: bean ? plantForBean(bean.slug) : null,` alongside the existing `domain:` line. Return the new methods:

```ts
return {
  getPlants: () => plants,
  podsForPlant: (slug) => podsByPlant.get(slug) ?? [],
  beansForPlant: (slug) => beansByPlant.get(slug) ?? [],
  unrootedPods: () => unrooted,
  plantForBean,
  getPods: () => pods,
  // …existing entries unchanged…
};
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. (Bees are inert data at this point — `buildDataset` ignores them by design.)

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/data.test.ts
git commit -m "feat: Plant and Bee species with plant-aware dataset"
```

---

### Task 2: `filterPublic` one tier up + bee projection

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/visibility.test.ts`

- [ ] **Step 1: Write the failing projection tests**

Append to `lib/visibility.test.ts`:

```ts
// --- Plant tier (PR2): the same fail-closed rules, one tier up. ---

test("filterPublic drops a private plant and cascades out its pods, beans and sprouts", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl-priv", name: "P", natures: ["work"], description: "", visibility: "private" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:pl-priv"] }],
    beans: [
      { slug: "a", name: "A", parents: ["pod:m"] },
      { slug: "direct", name: "D", parents: ["plant:pl-priv"] },
    ],
    sprouts: [{ slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published" }],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.plants ?? []).map((p) => p.slug), []);
  assert.deepEqual((out.pods ?? []).map((p) => p.slug), []);
  assert.deepEqual((out.beans ?? []).map((b) => b.slug), []);
  assert.deepEqual((out.sprouts ?? []).map((v) => v.slug), []);
});

test("filterPublic keeps a pod whose only plant-parent is a dangling ref (matches the pod-tier rule)", () => {
  const seed: RawGarden = {
    plants: [],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:ghost"] }],
  };
  assert.deepEqual((filterPublic(seed).pods ?? []).map((p) => p.slug), ["m"]);
});

test("filterPublic keeps a bean sheltered by a public parent in EITHER tier", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [{ slug: "m-priv", name: "M", description: "", visibility: "private" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv", "plant:pl"] }],
  };
  assert.deepEqual((filterPublic(seed).beans ?? []).map((b) => b.slug), ["a"]);
});

test("filterPublic scrubs plant relations to surviving targets, exactly like sprout relations", () => {
  const seed: RawGarden = {
    plants: [
      {
        slug: "melogram", name: "Melogram", natures: ["work", "tool"], description: "",
        relations: [
          { kind: "distributes", ref: "plant:bohns-music" }, // kept
          { kind: "chronicles", ref: "plant:hidden" }, // dropped: private target
          { kind: "uses", ref: "pod:ghost" }, // dropped: dangling
        ],
      },
      { slug: "bohns-music", name: "BM", natures: ["work"], description: "" },
      { slug: "hidden", name: "H", natures: ["tool"], description: "", visibility: "private" },
    ],
  };
  const melogram = (filterPublic(seed).plants ?? []).find((p) => p.slug === "melogram");
  assert.deepEqual(melogram?.relations, [{ kind: "distributes", ref: "plant:bohns-music" }]);
});

test("filterPublic keeps only explicitly public bees (default is PRIVATE) and scrubs serves to kept plants", () => {
  const seed: RawGarden = {
    plants: [
      { slug: "femfolk", name: "F", natures: ["work"], description: "" },
      { slug: "secret", name: "S", natures: ["tool"], description: "", visibility: "private" },
    ],
    bees: [
      { slug: "song-identifier", name: "SI", kind: "capability", status: "live", levers: [], serves: ["plant:femfolk", "plant:secret", "plant:ghost"], description: "", visibility: "public" },
      { slug: "default-private", name: "DP", kind: "routine", status: "planned", levers: [], serves: ["plant:femfolk"], description: "" },
    ],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.bees ?? []).map((b) => b.slug), ["song-identifier"]);
  assert.deepEqual(out.bees?.[0]?.serves, ["plant:femfolk"]); // private and dangling plants scrubbed
});
```

Also extend `relSeed()`'s `rv-main.relations` with one more entry — `{ kind: "powered-by", ref: "bee:song-identifier" }` — and note in the scrub-matrix test that it must be **dropped** (bees are never relation targets in the public projection; `refSurvives` has no bee branch). The expected array in `"filterPublic scrubs relations to refs whose target survives the projection"` stays unchanged.

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — plants pass through unfiltered / `out.bees` undefined.

- [ ] **Step 3: Implement in `lib/data.ts`**

Replace `allExistingParentsFiltered` with a multi-tier version:

```ts
// True when the item has parent refs that EXIST in the dataset (across every
// given tier) and ALL such existing parents were filtered out. Dangling refs
// are ignored; a single kept parent in ANY tier shelters the item.
function allExistingParentsFiltered(
  parents: string[] | undefined,
  tiers: [prefix: string, exists: Set<string>, kept: Set<string>][],
): boolean {
  let existing = 0;
  for (const [prefix, exists, kept] of tiers) {
    for (const slug of parentsWithPrefix(parents, prefix)) {
      if (!exists.has(slug)) continue;
      if (kept.has(slug)) return false;
      existing++;
    }
  }
  return existing > 0;
}
```

Factor the sprout relations-scrub body into a shared helper (same tolerance comments as today — move them here):

```ts
function scrubRelations<T extends { relations?: Relation[] }>(
  item: T,
  refSurvives: (ref: string) => boolean,
): T {
  if (!item.relations) return item; // absent stays absent — never materialize []
  if (!Array.isArray(item.relations)) return { ...item, relations: [] };
  const scrubbed = item.relations.filter(
    (rel) =>
      rel != null &&
      typeof rel.kind === "string" &&
      typeof rel.ref === "string" &&
      refSurvives(rel.ref),
  );
  return scrubbed.length === item.relations.length ? item : { ...item, relations: scrubbed };
}
```

Rewrite `filterPublic`:

```ts
export function filterPublic(raw: RawGarden): RawGarden {
  const rawPlants = raw.plants ?? [];
  const rawPods = raw.pods ?? [];
  const rawBeans = raw.beans ?? [];
  const rawSprouts = raw.sprouts ?? [];
  const rawBees = raw.bees ?? [];

  const keptPlants = rawPlants.filter((p) => p.visibility !== "private");
  const plantExists = new Set(rawPlants.map((p) => p.slug));
  const plantKept = new Set(keptPlants.map((p) => p.slug));

  const pods = rawPods.filter(
    (p) =>
      p.visibility !== "private" &&
      !allExistingParentsFiltered(p.parents, [[PLANT_PREFIX, plantExists, plantKept]]),
  );
  const podExists = new Set(rawPods.map((p) => p.slug));
  const podKept = new Set(pods.map((p) => p.slug));

  const beans = rawBeans.filter(
    (b) =>
      b.visibility !== "private" &&
      !allExistingParentsFiltered(b.parents, [
        [POD_PREFIX, podExists, podKept],
        [PLANT_PREFIX, plantExists, plantKept],
      ]),
  );
  const beanExists = new Set(rawBeans.map((b) => b.slug));
  const beanKept = new Set(beans.map((b) => b.slug));

  const keptSprouts = rawSprouts.filter(
    (s) =>
      s.state === "published" &&
      !allExistingParentsFiltered(s.parents, [[BEAN_PREFIX, beanExists, beanKept]]),
  );

  // Relations may point at sprouts, so the kept-sprout set must exist BEFORE
  // any relation (on sprouts OR plants) is judged.
  const sproutKept = new Set(keptSprouts.map((s) => s.slug));
  const refSurvives = (ref: string): boolean =>
    ref.startsWith(SPROUT_PREFIX)
      ? sproutKept.has(ref.slice(SPROUT_PREFIX.length))
      : ref.startsWith(BEAN_PREFIX)
        ? beanKept.has(ref.slice(BEAN_PREFIX.length))
        : ref.startsWith(POD_PREFIX)
          ? podKept.has(ref.slice(POD_PREFIX.length))
          : ref.startsWith(PLANT_PREFIX) && plantKept.has(ref.slice(PLANT_PREFIX.length));

  const sprouts = keptSprouts.map((s) => scrubRelations(s, refSurvives));
  const plants = keptPlants.map((p) => scrubRelations(p, refSurvives));

  // Bees are default-PRIVATE (the opposite of every content tier) and sit
  // outside the cascades: only an explicit "public" survives, and each
  // survivor's serves[] is scrubbed to kept plants so a hidden plant slug can
  // never leak through an operational doc.
  const bees = rawBees
    .filter((b) => b.visibility === "public")
    .map((b) => {
      const serves = (Array.isArray(b.serves) ? b.serves : []).filter(
        (ref) => ref.startsWith(PLANT_PREFIX) && plantKept.has(ref.slice(PLANT_PREFIX.length)),
      );
      return Array.isArray(b.serves) && serves.length === b.serves.length ? b : { ...b, serves };
    });

  return { plants, pods, beans, sprouts, bees };
}
```

Update `filterPublic`'s doc comment: add the two new rules — *a Plant is visible unless explicitly private and the cascade extends one tier up (plant → pod → bean → sprout), same fail-closed dangling-ref treatment; Bees are default-private, opt-in public, cascade-exempt.*

- [ ] **Step 4: Run tests + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — including every pre-existing `filterPublic` test unchanged.

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/visibility.test.ts
git commit -m "feat: filterPublic cascades to the plant tier and projects public bees"
```

---

### Task 3: Publish/unpublish cascades one tier up

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/data.test.ts`

- [ ] **Step 1: Update every existing cascade assertion**

All cascade returns gain `plantSlugs`. In `lib/data.test.ts`, every `assert.deepEqual(publishCascade(...), { podSlugs: […], beanSlugs: […] })` and every `unpublishCascade`/`unpublishCascadeForBeans` equivalent gets `plantSlugs: []` added as the FIRST key of the expected object. (Mechanical sweep; the fixtures have no plants, so empty is correct.)

- [ ] **Step 2: Write the failing plant-tier cascade tests**

Append to `lib/data.test.ts`:

```ts
// --- Cascades one tier up (PR2). Same idempotent-flip, dangling-tolerant rules. ---

const CASCADE_GARDEN: RawGarden = {
  plants: [
    { slug: "pl1", name: "P1", natures: ["work"], description: "" },
    { slug: "pl2", name: "P2", natures: ["work"], description: "" },
  ],
  pods: [{ slug: "m1", name: "M1", description: "", parents: ["plant:pl1", "plant:ghost"] }],
  beans: [
    { slug: "a1", name: "A1", parents: ["pod:m1"] },
    { slug: "direct", name: "D", parents: ["plant:pl2"] },
  ],
  sprouts: [
    { slug: "v1", name: "V1", type: "t", date: "2026-01-01", description: "", parents: ["bean:a1"], state: "published" },
    { slug: "v-direct", name: "VD", type: "t", date: "2026-01-02", description: "", parents: ["bean:direct"], state: "published" },
  ],
};

test("publishCascade climbs pod -> plant, ignoring dangling plant refs", () => {
  assert.deepEqual(publishCascade(CASCADE_GARDEN, "v1"), {
    plantSlugs: ["pl1"],
    podSlugs: ["m1"],
    beanSlugs: ["a1"],
  });
});

test("publishCascade climbs a bean's DIRECT plant parent (no pod tier)", () => {
  assert.deepEqual(publishCascade(CASCADE_GARDEN, "v-direct"), {
    plantSlugs: ["pl2"],
    podSlugs: [],
    beanSlugs: ["direct"],
  });
});

test("unpublishCascade flips the whole lineage up to the plant when nothing shelters it", () => {
  const raw = structuredClone(CASCADE_GARDEN);
  raw.sprouts![0].state = "draft"; // v1 just un-published
  const r = unpublishCascade(raw, "v1");
  assert.deepEqual(r, { plantSlugs: ["pl1"], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("unpublishCascade honors a plant sheltered by a surviving public pod", () => {
  const raw = structuredClone(CASCADE_GARDEN);
  raw.pods!.push({ slug: "m2", name: "M2", description: "", parents: ["plant:pl1"] });
  raw.beans!.push({ slug: "a2", name: "A2", parents: ["pod:m2"] });
  raw.sprouts![0].state = "draft";
  const r = unpublishCascade(raw, "v1");
  // m2 is public (default) and points at pl1 -> the plant is sheltered.
  assert.deepEqual(r, { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("unpublishCascade honors a plant sheltered by a surviving public DIRECT bean", () => {
  const raw: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [],
    beans: [
      { slug: "flipping", name: "F", parents: ["plant:pl"] },
      { slug: "shelter", name: "S", parents: ["plant:pl"] },
    ],
    sprouts: [{ slug: "v", name: "V", type: "t", date: "2026-01-01", description: "", parents: ["bean:flipping"], state: "draft" }],
  };
  assert.deepEqual(unpublishCascade(raw, "v"), { plantSlugs: [], podSlugs: [], beanSlugs: ["flipping"] });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test`
Expected: FAIL — cascade results have no `plantSlugs` key.

- [ ] **Step 4: Implement in `lib/data.ts`**

`publishCascade` becomes:

```ts
export function publishCascade(
  raw: RawGarden,
  sproutSlug: string,
): { plantSlugs: string[]; podSlugs: string[]; beanSlugs: string[] } {
  const plants = raw.plants ?? [];
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];

  const sprout = sprouts.find((s) => s.slug === sproutSlug);
  if (!sprout) return { plantSlugs: [], podSlugs: [], beanSlugs: [] };

  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));
  const podBySlug = new Map(pods.map((p) => [p.slug, p]));
  const plantExists = new Set(plants.map((p) => p.slug));

  const beanSlugs = [
    ...new Set(parentsWithPrefix(sprout.parents, BEAN_PREFIX).filter((s) => beanBySlug.has(s))),
  ];

  const podSlugs = new Set<string>();
  const plantSlugs = new Set<string>();
  for (const beanSlug of beanSlugs) {
    const bean = beanBySlug.get(beanSlug)!;
    for (const p of parentsWithPrefix(bean.parents, PLANT_PREFIX)) {
      if (plantExists.has(p)) plantSlugs.add(p);
    }
    for (const p of parentsWithPrefix(bean.parents, POD_PREFIX)) {
      const pod = podBySlug.get(p);
      if (!pod) continue;
      podSlugs.add(p);
      for (const pl of parentsWithPrefix(pod.parents, PLANT_PREFIX)) {
        if (plantExists.has(pl)) plantSlugs.add(pl);
      }
    }
  }

  return { plantSlugs: [...plantSlugs], podSlugs: [...podSlugs], beanSlugs };
}
```

(Keep the existing doc comment, extended with: *the cascade now climbs one tier further — through pod parents to their plants, and through a bean's direct plant parents.*)

`unpublishCascadeForBeans` becomes (existing bean/pod logic byte-identical, plant block appended; `podExists` replaced by `podBySlug`):

```ts
export function unpublishCascadeForBeans(
  raw: RawGarden,
  beanSlugs: string[],
): { plantSlugs: string[]; podSlugs: string[]; beanSlugs: string[] } {
  const plants = raw.plants ?? [];
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];

  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));
  const podBySlug = new Map(pods.map((p) => [p.slug, p]));
  const plantExists = new Set(plants.map((p) => p.slug));

  // A bean is sheltered while ANY published sprout still points at it.
  const shelteredBeans = new Set<string>();
  for (const s of sprouts) {
    if (s.state !== "published") continue;
    for (const b of parentsWithPrefix(s.parents, BEAN_PREFIX)) shelteredBeans.add(b);
  }

  const flipping = new Set(
    beanSlugs.filter((s) => beanBySlug.has(s) && !shelteredBeans.has(s)),
  );

  const podCandidates = new Set<string>();
  for (const beanSlug of flipping) {
    for (const p of parentsWithPrefix(beanBySlug.get(beanSlug)!.parents, POD_PREFIX)) {
      if (podBySlug.has(p)) podCandidates.add(p);
    }
  }

  // A pod is sheltered while any surviving public bean still points at it.
  const shelteredPods = new Set<string>();
  for (const b of beans) {
    if (flipping.has(b.slug) || b.visibility === "private") continue;
    for (const p of parentsWithPrefix(b.parents, POD_PREFIX)) shelteredPods.add(p);
  }
  const flippingPods = new Set([...podCandidates].filter((p) => !shelteredPods.has(p)));

  // One tier up, same shape: candidates come from flipping pods and flipping
  // directly-parented beans; a plant is sheltered while any surviving public
  // pod or surviving public direct bean still points at it.
  const plantCandidates = new Set<string>();
  for (const beanSlug of flipping) {
    for (const pl of parentsWithPrefix(beanBySlug.get(beanSlug)!.parents, PLANT_PREFIX)) {
      if (plantExists.has(pl)) plantCandidates.add(pl);
    }
  }
  for (const podSlug of flippingPods) {
    for (const pl of parentsWithPrefix(podBySlug.get(podSlug)!.parents, PLANT_PREFIX)) {
      if (plantExists.has(pl)) plantCandidates.add(pl);
    }
  }
  const shelteredPlants = new Set<string>();
  for (const p of pods) {
    if (flippingPods.has(p.slug) || p.visibility === "private") continue;
    for (const pl of parentsWithPrefix(p.parents, PLANT_PREFIX)) shelteredPlants.add(pl);
  }
  for (const b of beans) {
    if (flipping.has(b.slug) || b.visibility === "private") continue;
    for (const pl of parentsWithPrefix(b.parents, PLANT_PREFIX)) shelteredPlants.add(pl);
  }

  return {
    plantSlugs: [...plantCandidates].filter((p) => !shelteredPlants.has(p)),
    podSlugs: [...flippingPods],
    beanSlugs: [...flipping],
  };
}
```

`unpublishCascade`'s signature updates itself via the delegation; only its no-op return needs `plantSlugs: []` added:

```ts
if (!sprout) return { plantSlugs: [], podSlugs: [], beanSlugs: [] };
```

**Compile note:** `app/admin/actions.ts` destructures `{ podSlugs, beanSlugs }` from these — destructuring a wider object still compiles, so the build stays green until Task 7 wires `plantSlugs` through. Do NOT touch actions.ts yet.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/data.ts lib/data.test.ts
git commit -m "feat: publish/unpublish cascades climb to the plant tier"
```

---

### Task 4: Graph projection — plants + bees

**Files:**
- Modify: `lib/graph.ts`
- Test: `lib/graph.test.ts`

- [ ] **Step 1: Update the pod-node test and write the failing new tests**

The existing test `"toGraph maps a pod to exactly {id, kind, name, domain}"` changes: pods lose `domain`. New expectation:

```ts
test("toGraph maps a pod to exactly {id, kind, name}", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", description: "secret notes", parents: ["plant:ghost"] }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [{ id: "pod:m", kind: "pod", name: "M" }]);
  for (const key of ["description", "parents", "domain"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});
```

Append:

```ts
// --- Plant + bee projection (PR2). ---

test("toGraph maps a plant to exactly {id, kind, name, natures} — relations/description never leak", () => {
  const seed: RawGarden = {
    plants: [{ slug: "melogram", name: "Melogram", natures: ["work", "tool"], description: "secret", relations: [{ kind: "distributes", ref: "plant:bohns-music" }] }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [{ id: "plant:melogram", kind: "plant", name: "Melogram", natures: ["work", "tool"] }]);
  for (const key of ["description", "relations", "visibility"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph maps a bee to exactly {id, kind, name, type, status} — levers/serves/engine never leak", () => {
  const seed: RawGarden = {
    bees: [{ slug: "si", name: "Song identifier", kind: "capability", status: "live", engine: "x", schedule: "daily", levers: [{ label: "l" }], serves: ["plant:femfolk"], description: "d", visibility: "public" }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [{ id: "bee:si", kind: "bee", name: "Song identifier", type: "capability", status: "live" }]);
  for (const key of ["levers", "serves", "engine", "schedule", "description", "visibility"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph emits plant containment for pods and direct beans", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:pl", "plant:ghost"] }],
    beans: [{ slug: "direct", name: "D", parents: ["plant:pl"] }],
  };
  const { edges } = toGraph(seed);
  assert.deepEqual(edges, [
    { source: "plant:pl", target: "pod:m", kind: "contains" },
    { source: "plant:pl", target: "bean:direct", kind: "contains" },
  ]);
});

test("toGraph renders plant relation edges (distributes/chronicles) with both-ends prune", () => {
  const seed: RawGarden = {
    plants: [
      { slug: "melogram", name: "Mg", natures: ["work", "tool"], description: "", relations: [{ kind: "distributes", ref: "plant:bohns-music" }, { kind: "chronicles", ref: "plant:ghost" }] },
      { slug: "bohns-music", name: "BM", natures: ["work"], description: "" },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "plant:melogram", target: "plant:bohns-music", kind: "distributes" },
  ]);
});

test("toGraph renders bee serves edges with both-ends prune", () => {
  const seed: RawGarden = {
    plants: [{ slug: "femfolk", name: "F", natures: ["work"], description: "" }],
    bees: [{ slug: "si", name: "SI", kind: "capability", status: "live", levers: [], serves: ["plant:femfolk", "plant:ghost"], description: "" }],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "bee:si", target: "plant:femfolk", kind: "serves" },
  ]);
});

test("toGraph composed with filterPublic shows only public bees (the /api/graph contract)", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    bees: [
      { slug: "pub", name: "Pub", kind: "workflow", status: "live", levers: [], serves: ["plant:pl"], description: "", visibility: "public" },
      { slug: "hidden", name: "H", kind: "adapter", status: "planned", levers: [], serves: ["plant:pl"], description: "" },
    ],
  };
  const ids = toGraph(filterPublic(seed)).nodes.map((n) => n.id);
  assert.ok(ids.includes("bee:pub"));
  assert.equal(ids.includes("bee:hidden"), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — no plant/bee nodes; pod node still carries `domain`.

- [ ] **Step 3: Implement in `lib/graph.ts`**

Update imports (drop `Domain`, add the new prefixes and `PlantNature`):

```ts
import {
  BEAN_PREFIX, BEE_PREFIX, PLANT_PREFIX, POD_PREFIX, SPROUT_PREFIX,
  parentsWithPrefix, resolveText, type PlantNature, type RawGarden,
} from "./data";
```

`GraphNode` becomes:

```ts
export interface GraphNode {
  id: string; // "plant:slug" | "pod:slug" | "bean:slug" | "sprout:slug" | "bee:slug"
  kind: "plant" | "pod" | "bean" | "sprout" | "bee";
  name: string; // resolved at serialization time (B1)
  natures?: PlantNature[]; // plants only
  type?: string; // sprouts (sprout.type) and bees (bee.kind)
  date?: string; // sprouts only
  status?: string; // bees only
  tags?: string[]; // any kind, only when non-empty
}
```

In `toGraph`, node construction becomes (order: plants, pods, beans, sprouts, bees; loop vars renamed to their species while here — the `atom`/`version` names are PR1 leftovers):

```ts
const plants = raw.plants ?? [];
const bees = raw.bees ?? [];

const nodes: GraphNode[] = [
  ...plants.map((p) =>
    withTags({ id: PLANT_PREFIX + p.slug, kind: "plant" as const, name: resolveText(p.name), natures: p.natures }, p.tags),
  ),
  ...pods.map((m) => withTags({ id: POD_PREFIX + m.slug, kind: "pod" as const, name: resolveText(m.name) }, m.tags)),
  ...beans.map((a) => withTags({ id: BEAN_PREFIX + a.slug, kind: "bean" as const, name: resolveText(a.name) }, a.tags)),
  ...sprouts.map((v) =>
    withTags(
      { id: SPROUT_PREFIX + v.slug, kind: "sprout" as const, name: resolveText(v.name), type: v.type, date: v.date },
      v.tags,
    ),
  ),
  ...bees.map((b) => ({ id: BEE_PREFIX + b.slug, kind: "bee" as const, name: resolveText(b.name), type: b.kind, status: b.status })),
];
```

Containment edges — add the plant tier BEFORE the existing pod→bean loop (edge order: plant→pod, plant→bean, pod→bean, bean→sprout):

```ts
const plantSlugSet = new Set(plants.map((p) => p.slug));

for (const pod of pods) {
  for (const slug of parentsWithPrefix(pod.parents, PLANT_PREFIX)) {
    if (plantSlugSet.has(slug)) addEdge(PLANT_PREFIX + slug, POD_PREFIX + pod.slug, "contains");
  }
}
for (const bean of beans) {
  for (const slug of parentsWithPrefix(bean.parents, PLANT_PREFIX)) {
    if (plantSlugSet.has(slug)) addEdge(PLANT_PREFIX + slug, BEAN_PREFIX + bean.slug, "contains");
  }
}
// …existing pod→bean and bean→sprout loops unchanged…
```

Relation edges — plants first (input order), then the existing sprout loop, then bee `serves` (deterministic; update the big doc comment above `toGraph` accordingly):

```ts
const nodeIds = new Set(nodes.map((n) => n.id));
for (const plant of plants) {
  const source = PLANT_PREFIX + plant.slug;
  for (const rel of plant.relations ?? []) {
    if (nodeIds.has(source) && nodeIds.has(rel.ref)) addEdge(source, rel.ref, rel.kind);
  }
}
// …existing sprout relations loop unchanged…
for (const bee of bees) {
  const source = BEE_PREFIX + bee.slug;
  for (const ref of bee.serves ?? []) {
    if (nodeIds.has(source) && nodeIds.has(ref)) addEdge(source, ref, "serves");
  }
}
```

`app/api/graph/route.ts` needs **no change** — `filterPublic` already projects plants/bees once `loadRawGarden` loads them (Task 5).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/graph.ts lib/graph.test.ts
git commit -m "feat: graph projects plants and public bees with relation and serves edges"
```

---

### Task 5: DB layer — collections, indexes, writes

**Files:**
- Modify: `lib/botanical.ts`
- Modify: `lib/store.ts`

No unit tests here — this module is DB-bound and untested today; the pure logic it calls was tested in Tasks 1–3.

- [ ] **Step 1: Extend `lib/store.ts`**

```ts
import { getDb } from "./db";
import {
  buildDataset,
  filterPublic,
  type Bean,
  type Bee,
  type Dataset,
  type Plant,
  type Pod,
  type RawGarden,
  type Sprout,
} from "./data";

export async function loadRawGarden(): Promise<RawGarden> {
  const db = await getDb();
  const [plants, pods, beans, sprouts, bees] = await Promise.all([
    db.collection<Plant>("plants").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Pod>("pods").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Bean>("beans").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Sprout>("sprouts").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Bee>("bees").find({}, { projection: { _id: 0 } }).toArray(),
  ]);
  return { plants, pods, beans, sprouts, bees };
}
```

(`getPublicDataset`/`getFullDataset` unchanged.)

- [ ] **Step 2: Extend `lib/botanical.ts`**

Imports: `import type { Bean, Plant, Pod, Sprout, Visibility } from "./data";` (`Domain` dropped).

In `ensureBotanicalIndexes`, add:

```ts
await db.collection("plants").createIndex({ slug: 1 }, { unique: true });
await db.collection("bees").createIndex({ slug: 1 }, { unique: true });
```

Add next to `listPods`:

```ts
export async function listPlants(): Promise<Plant[]> {
  const db = await getDb();
  return db.collection<Plant>("plants").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}
```

Replace `NewPod`/`createPod` (domain → plant parent):

```ts
export interface NewPod {
  slug: string;
  name: string;
  plantSlug: string | null;
  description: string;
}

export async function createPod(input: NewPod): Promise<Pod> {
  const db = await getDb();
  const doc: Pod = {
    slug: input.slug,
    name: input.name,
    parents: input.plantSlug ? [`plant:${input.plantSlug}`] : [],
    description: input.description,
    visibility: "private",
  };
  try {
    await db.collection<Pod>("pods").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("pod", input.slug);
    throw err;
  }
  return doc;
}
```

Extend `NewBean`/`createBean` (a bean may root directly under a plant when it has no pod):

```ts
export interface NewBean {
  slug: string;
  name: string;
  podSlug: string | null;
  plantSlug: string | null; // used ONLY when podSlug is null — the pod carries the plant otherwise
}
```

with `parents: input.podSlug ? [`pod:${input.podSlug}`] : input.plantSlug ? [`plant:${input.plantSlug}`] : [],` in the doc.

Extend the visibility write-half to three tiers:

```ts
async function setVisibility(
  plantSlugs: string[],
  podSlugs: string[],
  beanSlugs: string[],
  visibility: Visibility,
): Promise<void> {
  const db = await getDb();
  if (plantSlugs.length > 0) {
    await db.collection("plants").updateMany({ slug: { $in: plantSlugs } }, { $set: { visibility } });
  }
  if (podSlugs.length > 0) {
    await db.collection("pods").updateMany({ slug: { $in: podSlugs } }, { $set: { visibility } });
  }
  if (beanSlugs.length > 0) {
    await db.collection("beans").updateMany({ slug: { $in: beanSlugs } }, { $set: { visibility } });
  }
}

export async function setPublic(plantSlugs: string[], podSlugs: string[], beanSlugs: string[]): Promise<void> {
  return setVisibility(plantSlugs, podSlugs, beanSlugs, "public");
}

export async function setPrivate(plantSlugs: string[], podSlugs: string[], beanSlugs: string[]): Promise<void> {
  return setVisibility(plantSlugs, podSlugs, beanSlugs, "private");
}
```

- [ ] **Step 3: Fix the now-broken call sites in `app/admin/actions.ts` (minimal, mechanical)**

Three cascade call sites destructure and pass through; update them to the 3-arg form (full promote-flow rework comes in Task 7):

- `promoteSeedAction`: `const { plantSlugs, podSlugs, beanSlugs } = publishCascade(...); await setPublic(plantSlugs, podSlugs, beanSlugs);` and temporarily call `createPod({ slug: molChoice.slug, name: …, plantSlug: null, description: "" })` (delete the `domainRaw`/`domain` lines and the `DOMAINS` const + `Domain` import) and `createBean({ …, plantSlug: null })`.
- `editVersionAction`: both branches gain `plantSlugs` in the destructure and pass it as the first argument.
- `deleteVersionAction`: `const { plantSlugs, podSlugs: flipPods, beanSlugs: flipBeans } = unpublishCascadeForBeans(...); await setPrivate(plantSlugs, flipPods, flipBeans);`

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/botanical.ts lib/store.ts app/admin/actions.ts
git commit -m "feat: plants and bees collections in the DB layer; visibility writes span three tiers"
```

---

### Task 6: Inbox boundary — `suggested.molecule` now means the plant

**Files:**
- Modify: `lib/data.ts` (one field), `lib/inbox.ts`
- Test: `lib/inbox.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/inbox.test.ts` (follow the file's existing `validateInboxPayload` fixture style — a minimal valid body is `{ title: "t", source: { kind: "manual" } }`):

```ts
test("suggested.moleculeSlug maps to plantSlug — repo slugs are plants since the re-tiering", () => {
  const r = validateInboxPayload({
    title: "t",
    source: { kind: "manual" },
    suggested: { moleculeSlug: "pbbls", atomSlug: "pbbls-webapp" },
  });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.suggested, { plantSlug: "pbbls", beanSlug: "pbbls-webapp" });
});

test("canonical plantSlug wins over the legacy moleculeSlug; podSlug passes through untouched", () => {
  const r = validateInboxPayload({
    title: "t",
    source: { kind: "manual" },
    suggested: { plantSlug: "ariko", moleculeSlug: "ignored", podSlug: "celesta" },
  });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.suggested, { plantSlug: "ariko", podSlug: "celesta" });
});
```

If any existing inbox test asserts `moleculeSlug` → `podSlug`, update it to expect `plantSlug` (search `lib/inbox.test.ts` and `lib/inbox-route.test.ts` for `moleculeSlug`).

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `moleculeSlug` still maps to `podSlug`.

- [ ] **Step 3: Implement**

In `lib/data.ts`, extend `SeedSuggestion`:

```ts
export interface SeedSuggestion {
  plantSlug?: string;
  podSlug?: string;
  beanSlug?: string;
  type?: string;
  tags?: string[];
}
```

In `lib/inbox.ts`, `normalizeSuggestion` becomes:

```ts
// Boundary alias — the ONLY place legacy vocabulary survives the botanical
// rename. Sibling repos' lab-note payloads still send moleculeSlug/atomSlug
// over the wire; the repo slugs it carries (pbbls, femfolk, …) are PLANTS
// since the PR2 re-tiering, so the legacy molecule key maps to plantSlug.
// Canonical keys win when both are present. Internal code never aliases.
function normalizeSuggestion(s: unknown): SeedSuggestion | undefined {
  if (!isObject(s)) return undefined;
  const plant = s.plantSlug ?? s.moleculeSlug;
  const bean = s.beanSlug ?? s.atomSlug;
  const out: SeedSuggestion = {
    ...(nonEmptyString(plant) ? { plantSlug: plant } : {}),
    ...(nonEmptyString(s.podSlug) ? { podSlug: s.podSlug } : {}),
    ...(nonEmptyString(bean) ? { beanSlug: bean } : {}),
    ...(nonEmptyString(s.type) ? { type: s.type } : {}),
  };
  if (Array.isArray(s.tags)) {
    const tags = s.tags.filter((t): t is string => typeof t === "string");
    if (tags.length) out.tags = tags;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/inbox.ts lib/inbox.test.ts lib/inbox-route.test.ts
git commit -m "feat: inbox suggestion boundary maps the legacy molecule key to plantSlug"
```

---

### Task 7: Admin — plant-aware triage and promote

**Files:**
- Modify: `lib/promote.ts`
- Modify: `app/admin/actions.ts`
- Modify: `app/admin/triage/[id]/page.tsx`
- Test: `lib/promote.test.ts`

- [ ] **Step 1: Rename the sprout form fields in `lib/promote.ts` and its tests**

In `buildSproutInput`: `versionSlug` → `sproutSlug`, `versionName` → `sproutName`, `versionNameFr` → `sproutNameFr`; rename the `atomParentSlug` parameter to `beanParentSlug` (update its doc comment). Update every FormData fixture in `lib/promote.test.ts` to the new field names.

Run: `npm test` — expected PASS (rename-only).

- [ ] **Step 2: Rework `promoteSeedAction` in `app/admin/actions.ts`**

Replace the parent-resolution block (comments updated to botanical vocabulary — this file still says "molecule/atom" from PR1):

```ts
// Resolve parent choices up front (pure) so invalid combinations are guarded
// BEFORE any write. A newly created pod is only ever linked from a newly
// created bean in this flow — reject "new pod + (existing/no) bean" rather
// than silently drop the intent. The plant select applies to whichever parent
// is created: a new pod roots under it; a new bean with NO pod roots directly
// under it (simple projects skip the pod tier).
const plantSlug = String(formData.get("plantSlug") ?? "").trim() || null;
const podChoice = resolveParentChoice(
  String(formData.get("newPodSlug") ?? ""),
  String(formData.get("podSlug") ?? ""),
);
const beanChoice = resolveParentChoice(
  String(formData.get("newBeanSlug") ?? ""),
  String(formData.get("beanSlug") ?? ""),
);
if (podChoice.mode === "create" && beanChoice.mode !== "create") {
  redirect(
    `/admin/triage/${seedId}?error=${encodeURIComponent(
      "a new pod must be paired with a new bean under it",
    )}`,
  );
}
```

and the creation block:

```ts
let podSlug: string | null = null;
if (podChoice.mode === "create") {
  await createPod({
    slug: podChoice.slug,
    name: String(formData.get("newPodName") ?? "").trim() || podChoice.slug,
    plantSlug,
    description: "",
  });
  podSlug = podChoice.slug;
} else if (podChoice.mode === "existing") {
  podSlug = podChoice.slug;
}

let beanSlug: string | null = null;
if (beanChoice.mode === "create") {
  await createBean({
    slug: beanChoice.slug,
    name: String(formData.get("newBeanName") ?? "").trim() || beanChoice.slug,
    podSlug,
    plantSlug: podSlug ? null : plantSlug,
  });
  beanSlug = beanChoice.slug;
} else if (beanChoice.mode === "existing") {
  beanSlug = beanChoice.slug;
}
```

(The cascade call sites were already updated in Task 5.)

- [ ] **Step 3: Rework the triage page**

In `app/admin/triage/[id]/page.tsx`:

```tsx
import { listPlants, listPods, listBeans } from "@/lib/botanical";
// …
const [plants, pods, beans] = await Promise.all([listPlants(), listPods(), listBeans()]);
```

Suggestion display becomes:

```tsx
{[
  seed.suggested.plantSlug && `plant ${seed.suggested.plantSlug}`,
  seed.suggested.podSlug && `pod ${seed.suggested.podSlug}`,
  seed.suggested.beanSlug && `bean ${seed.suggested.beanSlug}`,
  seed.suggested.type && `type ${seed.suggested.type}`,
  seed.suggested.tags?.length ? `tags ${seed.suggested.tags.join(", ")}` : null,
].filter(Boolean).join(" · ")}
```

A new Plant fieldset goes FIRST (existing plants only — plants are authored by the re-tiering migration, not triage); the Pod fieldset loses the domain select and takes botanical names; the Bean and Sprout fieldsets get their renamed fields and legends:

```tsx
<fieldset>
  <legend>Plant</legend>
  {/* Selecting a plant roots whichever parent is CREATED below: a new pod
      parents under it; a new bean with no pod parents directly under it. */}
  <p>
    <label>
      Existing{" "}
      <select name="plantSlug" defaultValue={seed.suggested?.plantSlug ?? ""}>
        <option value="">— none —</option>
        {plants.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.slug}
          </option>
        ))}
      </select>
    </label>
  </p>
</fieldset>

<fieldset>
  <legend>Pod</legend>
  <p>
    <label>
      Existing{" "}
      <select name="podSlug" defaultValue={seed.suggested?.podSlug ?? ""}>
        <option value="">— none —</option>
        {pods.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.slug}
          </option>
        ))}
      </select>
    </label>
  </p>
  <p>
    <label>
      New slug <input type="text" name="newPodSlug" />
    </label>
  </p>
  <p>
    <label>
      New name <input type="text" name="newPodName" />
    </label>
  </p>
</fieldset>
```

Bean fieldset: legend `Bean`, select `beanSlug` (unchanged name), inputs `newBeanSlug` / `newBeanName`. Sprout fieldset: legend `Sprout`, inputs `sproutSlug` / `sproutName` / `sproutNameFr` (labels unchanged otherwise; the `type`/`date`/`description*`/`state` fields keep their names).

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/promote.ts lib/promote.test.ts app/admin/actions.ts "app/admin/triage/[id]/page.tsx"
git commit -m "feat: triage roots new pods and beans under a plant; domain select retired"
```

---

### Task 8: Pages — timeline, vault, bean detail, directory

**Files:**
- Modify: `lib/vault.ts`, `lib/bean-detail.ts`
- Modify: `app/timeline/page.tsx`, `app/page.tsx`, `app/admin/vault/page.tsx`, `app/admin/bean/[id]/page.tsx`, `app/admin/sprout/[slug]/page.tsx`
- Test: `lib/vault.test.ts`, `lib/bean-detail.test.ts`

- [ ] **Step 1: Write the failing vault + bean-detail tests**

`lib/vault.test.ts`: existing fixtures build `TimelineEntry` objects with a `domain` field — replace it with `plant` (a minimal `Plant` literal or `null`) and change filter fixtures from `{ domain: "music" }` to `{ plant: "pl-slug" }`. Add:

```ts
test("filterVaultEntries filters by the resolved plant's slug; an unknown slug matches nothing", () => {
  const plant = { slug: "pbbls", name: "P", natures: ["work" as const], description: "" };
  const entries: TimelineEntry[] = [
    { sprout: { slug: "v1", name: "V1", type: "t", date: "2026-01-01", description: "", parents: [] }, bean: null, plant, domain: null },
    { sprout: { slug: "v2", name: "V2", type: "t", date: "2026-01-02", description: "", parents: [] }, bean: null, plant: null, domain: null },
  ];
  assert.deepEqual(filterVaultEntries(entries, { plant: "pbbls" }).map((e) => e.sprout.slug), ["v1"]);
  assert.deepEqual(filterVaultEntries(entries, { plant: "nope" }), []);
});

test("distinctPlants returns sorted unique plant slugs", () => {
  const p = (slug: string) => ({ slug, name: slug, natures: ["work" as const], description: "" });
  const entries: TimelineEntry[] = [
    { sprout: { slug: "a", name: "a", type: "t", date: "2026-01-01", description: "", parents: [] }, bean: null, plant: p("zeta"), domain: null },
    { sprout: { slug: "b", name: "b", type: "t", date: "2026-01-02", description: "", parents: [] }, bean: null, plant: p("alpha"), domain: null },
    { sprout: { slug: "c", name: "c", type: "t", date: "2026-01-03", description: "", parents: [] }, bean: null, plant: p("zeta"), domain: null },
  ];
  assert.deepEqual(distinctPlants(entries), ["alpha", "zeta"]);
});
```

`lib/bean-detail.test.ts`: fixtures gain a plant where they had a domain; the view's `domain` assertions become `plant` (slug string). Add one test:

```ts
test("beanDetail resolves the plant slug for the admin view", () => {
  const d = buildDataset({
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:pl"] }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m"] }],
  });
  assert.equal(beanDetail(d, "a")?.plant, "pl");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `VaultFilters` has no `plant`, `distinctPlants` missing, `BeanDetailView` has no `plant`.

- [ ] **Step 3: Implement `lib/vault.ts`**

```ts
import { resolveText, type TimelineEntry, type SproutState } from "./data";

const STATES: SproutState[] = ["draft", "private", "published"];

export interface VaultFilters {
  state?: string;
  plant?: string;
  tag?: string;
}

// Pure. Applies the active filters to timeline entries. An unrecognized state
// is ignored (falls back to "all"); plant and tag filter like membership — a
// blank value is ignored, a non-blank unknown value matches nothing (there is
// no plant enum to validate against). Surviving rows carry their sprout name
// resolved to a display string (B1).
export function filterVaultEntries(entries: TimelineEntry[], filters: VaultFilters): TimelineEntry[] {
  const state = STATES.includes(filters.state as SproutState) ? (filters.state as SproutState) : undefined;
  const plant = filters.plant && filters.plant.trim() ? filters.plant.trim() : undefined;
  const tag = filters.tag && filters.tag.trim() ? filters.tag.trim() : undefined;

  return entries
    .filter((e) => {
      if (state && e.sprout.state !== state) return false;
      if (plant && e.plant?.slug !== plant) return false;
      if (tag && !(e.sprout.tags ?? []).includes(tag)) return false;
      return true;
    })
    .map((e) => ({ ...e, sprout: { ...e.sprout, name: resolveText(e.sprout.name) } }));
}

// Distinct plant slugs across all entries, sorted — for the plant filter row.
export function distinctPlants(entries: TimelineEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) if (e.plant) set.add(e.plant.slug);
  return [...set].sort();
}
```

(`distinctTags` unchanged.)

- [ ] **Step 4: Implement `lib/bean-detail.ts`**

```ts
import { resolveText, type Bean, type Dataset, type Sprout } from "./data";

export interface BeanDetailView {
  bean: Bean;
  plant: string | null; // resolved plant slug (direct parent wins, then via pod)
  podParents: string[];
  sprouts: Sprout[];
}
```

and in `beanDetail`: `plant: dataset.plantForBean(slug)?.slug ?? null,` replacing the `domain:` line (rest unchanged).

- [ ] **Step 5: Update the pages**

`app/timeline/page.tsx` — the filter dimension becomes the plant slug:

```tsx
import { resolveText } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string }>;
}) {
  const { plant } = await searchParams;
  const data = await getPublicDataset();
  const plantSlugs = data.getPlants().map((p) => p.slug);
  const active = plant && plantSlugs.includes(plant) ? plant : "all";

  const entries = data
    .timelineSprouts()
    .filter((entry) => active === "all" || entry.plant?.slug === active);

  return (
    <article>
      <h1>Timeline</h1>

      <nav>
        <ul>
          {["all", ...plantSlugs].map((filter) => (
            <li key={filter}>
              {filter === active ? (
                <strong>{filter}</strong>
              ) : (
                <a href={filter === "all" ? "/timeline" : `/timeline?plant=${filter}`}>{filter}</a>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <ul>
        {entries.map((entry) => (
          <li key={entry.sprout.slug}>
            {entry.bean ? (
              <a href={`/bean/${entry.bean.slug}`}>{resolveText(entry.sprout.name)}</a>
            ) : (
              resolveText(entry.sprout.name)
            )}
            {" — "}
            <time dateTime={entry.sprout.date}>{entry.sprout.date}</time>
            {" — "}
            {entry.sprout.type}
          </li>
        ))}
      </ul>
    </article>
  );
}
```

`app/admin/vault/page.tsx`:
- Delete `DOMAIN_OPTIONS`; import `distinctPlants` from `@/lib/vault`.
- `type Active = { state?: string; plant?: string; tag?: string }` and the key list in `vaultHref` becomes `["state", "plant", "tag"] as const`; `searchParams` type follows.
- After loading: `const plantOptions = ["all", ...distinctPlants(all)];` and render `{filterRow("plant", "plant", plantOptions)}` in place of the domain row.
- Table: header `<th>domain</th>` → `<th>plant</th>`, cell `{e.domain ?? "—"}` → `{e.plant?.slug ?? "—"}`; also fix the PR1-leftover header `<th>atom</th>` → `<th>bean</th>` and `<th>version</th>` → `<th>sprout</th>`, and the empty-state copy `No matching versions.` → `No matching sprouts.`.

`app/admin/bean/[id]/page.tsx`: destructure `plant` instead of `domain` from the view; render `<li>plant: {plant ?? "—"}</li>`.

`app/admin/sprout/[slug]/page.tsx`: the `<li>atom: …</li>` label becomes `<li>bean: …</li>` (PR1 leftover).

`app/page.tsx` — the directory groups by plant (natures shown; unrooted pods and standalone beans keep a home; PR1-leftover `molecule`/`atom` variable names die here):

```tsx
import { resolveText } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const data = await getPublicDataset();
  const plants = data.getPlants();
  const unrooted = data.unrootedPods();
  const standalone = data.standaloneBeans();

  const beanList = (beans: ReturnType<typeof data.beansForPod>) => (
    <ul>
      {beans.map((bean) => (
        <li key={bean.slug}>
          <a href={`/bean/${bean.slug}`}>{resolveText(bean.name)}</a>
        </li>
      ))}
    </ul>
  );

  return (
    <article>
      <h1>Directory</h1>

      {plants.map((plant) => (
        <section key={plant.slug}>
          <h2>
            {resolveText(plant.name)} <small>({plant.natures.join(" · ")})</small>
          </h2>
          {data.beansForPlant(plant.slug).length > 0 && beanList(data.beansForPlant(plant.slug))}
          {data.podsForPlant(plant.slug).map((pod) => (
            <section key={pod.slug}>
              <h3>{resolveText(pod.name)}</h3>
              {beanList(data.beansForPod(pod.slug))}
            </section>
          ))}
        </section>
      ))}

      {(unrooted.length > 0 || standalone.length > 0) && (
        <section>
          <h2>Unrooted</h2>
          {unrooted.map((pod) => (
            <section key={pod.slug}>
              <h3>{resolveText(pod.name)}</h3>
              {beanList(data.beansForPod(pod.slug))}
            </section>
          ))}
          {standalone.length > 0 && beanList(standalone)}
        </section>
      )}
    </article>
  );
}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/vault.ts lib/vault.test.ts lib/bean-detail.ts lib/bean-detail.test.ts app/page.tsx app/timeline/page.tsx "app/admin/vault/page.tsx" "app/admin/bean/[id]/page.tsx" "app/admin/sprout/[slug]/page.tsx"
git commit -m "feat: directory, timeline, vault and bean detail speak plant instead of domain"
```

---

### Task 9: Retire `Domain`

**Files:**
- Modify: `lib/data.ts`
- Modify: `lib/data.test.ts`, `lib/visibility.test.ts`, `lib/graph.test.ts` (fixture sweep)

- [ ] **Step 1: Delete the enum and its last carriers in `lib/data.ts`**

- Delete `export type Domain = "music" | "design" | "podcast";`
- Delete `domain?: Domain;` from `Pod` (and its TEMPORARY comment).
- Delete `domain: Domain | null;` from `TimelineEntry` (and its TEMPORARY comment).
- Delete `domainForBean` from the `Dataset` interface, its implementation in `buildDataset`, its entry in the returned object, and the `domain:` line in the timeline mapping.

- [ ] **Step 2: Sweep the test fixtures**

Remove every `domain: "music" | "design" | "podcast"` property from pod literals in `lib/data.test.ts`, `lib/visibility.test.ts`, `lib/graph.test.ts`, and delete any test asserting `domainForBean` behavior (its plant-tier replacement was tested in Task 1). `lib/vault.test.ts` fixtures drop their leftover `domain: null` entries.

- [ ] **Step 3: Verify nothing references the enum**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

Run: `grep -rn "Domain\|domainFor\|\"music\"\|\"design\"\|\"podcast\"" lib app scripts --include="*.ts" --include="*.tsx"`
Expected: **zero hits** referring to the retired enum (inspect any residual hit — e.g. an unrelated word in prose — and confirm it is not the enum; spec acceptance is "no reference to `Domain` remains").

- [ ] **Step 4: Commit**

```bash
git add -A lib app
git commit -m "feat!: retire the Domain enum — the timeline groups by plant"
```

---

### Task 10: Re-tiering transform (`lib/retier.ts`)

**Files:**
- Create: `lib/retier.ts`
- Test: `lib/retier.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/retier.test.ts`. The fixture is the REAL `data/garden.yml`, so every assertion must hold on both the pre-migration file (promotion happens) and the post-migration file (already-promoted, transform is a no-op) — idempotence makes that a single property.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { retierGarden, PROMOTED, CREATED, SEED_BEES } from "./retier";
import type { RawGarden } from "./data";

function currentGarden(): RawGarden {
  const file = readFileSync(join(process.cwd(), "data", "garden.yml"), "utf8");
  return (yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawGarden) ?? {};
}

test("retierGarden promotes the six project pods to plants and removes them from pods", () => {
  const out = retierGarden(currentGarden());
  const plantSlugs = new Set((out.plants ?? []).map((p) => p.slug));
  const podSlugs = new Set((out.pods ?? []).map((p) => p.slug));
  for (const { slug } of PROMOTED) {
    assert.ok(plantSlugs.has(slug), `${slug} must be a plant`);
    assert.equal(podSlugs.has(slug), false, `${slug} must no longer be a pod`);
  }
});

test("retierGarden creates the authored plants with their natures and relations", () => {
  const out = retierGarden(currentGarden());
  const bySlug = new Map((out.plants ?? []).map((p) => [p.slug, p]));
  for (const def of CREATED) assert.ok(bySlug.has(def.slug), `${def.slug} must exist`);
  assert.deepEqual(bySlug.get("melogram")?.natures, ["work", "tool"]);
  assert.deepEqual(bySlug.get("melogram")?.relations, [{ kind: "distributes", ref: "plant:bohns-music" }]);
  assert.deepEqual(bySlug.get("arkaik")?.relations, [
    { kind: "chronicles", ref: "plant:pbbls" },
    { kind: "chronicles", ref: "plant:femfolk" },
  ]);
});

test("retierGarden keeps the albums as pods under plant:bohns-music", () => {
  const out = retierGarden(currentGarden());
  const bySlug = new Map((out.pods ?? []).map((p) => [p.slug, p]));
  for (const slug of ["wait-for-the-sun", "celesta", "republic-of-masquerade"]) {
    assert.ok(bySlug.get(slug)?.parents?.includes("plant:bohns-music"), `${slug} must root under bohns-music`);
  }
});

test("retierGarden re-parents promoted pods' beans to plant: refs and leaves album beans on pod: refs", () => {
  const out = retierGarden(currentGarden());
  const bySlug = new Map((out.beans ?? []).map((b) => [b.slug, b]));
  assert.deepEqual(bySlug.get("pbbls-webapp")?.parents, ["plant:pbbls"]);
  assert.deepEqual(bySlug.get("felina")?.parents, ["pod:celesta"]);
});

test("retierGarden leaves no domain key on any pod or plant", () => {
  const out = retierGarden(currentGarden());
  for (const p of out.pods ?? []) assert.equal("domain" in p, false, `${p.slug} still has domain`);
  for (const p of out.plants ?? []) assert.equal("domain" in p, false, `${p.slug} still has domain`);
});

test("retierGarden seeds the bees — live ones public, planned ones default-private", () => {
  const out = retierGarden(currentGarden());
  const bySlug = new Map((out.bees ?? []).map((b) => [b.slug, b]));
  for (const bee of SEED_BEES) assert.ok(bySlug.has(bee.slug), `${bee.slug} must exist`);
  assert.equal(bySlug.get("lab-note-pipeline")?.visibility, "public");
  assert.equal(bySlug.get("song-identifier")?.visibility, "public");
  assert.equal(bySlug.get("arkaik-adapter")?.visibility, undefined);
});

test("retierGarden is idempotent and pure", () => {
  const input = currentGarden();
  const snapshot = structuredClone(input);
  const once = retierGarden(input);
  assert.deepEqual(input, snapshot); // pure
  assert.deepEqual(retierGarden(structuredClone(once)), once); // idempotent
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `./retier` does not exist.

- [ ] **Step 3: Implement `lib/retier.ts`**

```ts
import { PLANT_PREFIX, POD_PREFIX, type Bee, type Plant, type PlantNature, type Pod, type RawGarden } from "./data";

// The slice-1 PR2 re-tiering (spec §4) as a pure, idempotent transform over a
// RawGarden. scripts/migrate-retier.ts applies the SAME transform to
// data/garden.yml and to Mongo; lib/retier.test.ts asserts it against the real
// garden file. Docs read from YAML/Mongo may still carry the retired `domain`
// key, which the transform strips.

// Pods of the practice promoted in place: the pod doc is absorbed into a plant
// (name/description/visibility/tags carried over), and its beans climb to
// plant: refs. natures per spec §4 — all plain works.
export const PROMOTED: { slug: string; natures: PlantNature[] }[] = [
  { slug: "pbbls", natures: ["work"] },
  { slug: "femfolk", natures: ["work"] },
  { slug: "teale", natures: ["work"] },
  { slug: "casa", natures: ["work"] },
  { slug: "pebblestones", natures: ["work"] },
  { slug: "enerfip", natures: ["work"] },
];

// Plants authored fresh. If a pod with the same slug exists (e.g. created via
// triage before this migration ran), it is absorbed instead of duplicated —
// the catalog's fields win, the pod's visibility/tags carry over.
export const CREATED: Plant[] = [
  {
    slug: "bohns-music",
    name: "Bohns Music",
    natures: ["work"],
    description: "The music practice — albums and songs published as Bohns Music.",
  },
  {
    slug: "melogram",
    name: "Melogram",
    natures: ["work", "tool"],
    description: "Music release hub — the Arkaik of music; distributes Bohns Music.",
    relations: [{ kind: "distributes", ref: "plant:bohns-music" }],
  },
  {
    slug: "arkaik",
    name: "Arkaik",
    natures: ["tool"],
    description: "Journal of record for the code practice; chronicles Pebbles and Femfolk.",
    relations: [
      { kind: "chronicles", ref: "plant:pbbls" },
      { kind: "chronicles", ref: "plant:femfolk" },
    ],
  },
  {
    slug: "ariko",
    name: "Ariko",
    natures: ["work", "tool"],
    description: "The central node — portfolio, practice graph and federation hub.",
  },
  {
    slug: "paulopus",
    name: "Paulopus",
    natures: ["work"],
    description: "World Cup 2026 oracle — predictions, briefs and the writer routine.",
  },
  {
    slug: "oxymore",
    name: "Oxymore",
    natures: ["tool"],
    description: "Third-party panel stack. Read-only in practice — no automation ever targets it.",
  },
];

export const ALBUM_PODS = ["wait-for-the-sun", "celesta", "republic-of-masquerade"];

// First bees of the federation (spec §4): the map shows the future before it
// runs. The two LIVE bees are seeded public (the explicit D1-exhibition
// opt-in); planned bees stay default-private until they exist.
export const SEED_BEES: Bee[] = [
  {
    slug: "lab-note-pipeline",
    name: "Lab Note pipeline",
    kind: "workflow",
    status: "live",
    engine: "action",
    levers: [],
    serves: ["plant:ariko", "plant:pbbls", "plant:femfolk", "plant:arkaik", "plant:melogram"],
    description: "Posts Lab Notes from sibling repos' merged PRs into the Ariko inbox.",
    visibility: "public",
  },
  {
    slug: "song-identifier",
    name: "Song identifier",
    kind: "capability",
    status: "live",
    levers: [],
    serves: ["plant:femfolk"],
    description: "Identifies songs for Femfolk research.",
    visibility: "public",
  },
  {
    slug: "arkaik-adapter",
    name: "Arkaik adapter",
    kind: "adapter",
    status: "planned",
    levers: [],
    serves: ["plant:arkaik"],
    description: "Will ingest the Arkaik journal feed into the Ariko read model (slice 3).",
  },
  {
    slug: "melogram-feed",
    name: "Melogram feed",
    kind: "adapter",
    status: "planned",
    levers: [],
    serves: ["plant:melogram"],
    description: "Will carry Melogram release events into the Ariko beanstalk.",
  },
  {
    slug: "femfolk-researcher",
    name: "Femfolk researcher",
    kind: "routine",
    status: "planned",
    engine: "claude-routine",
    levers: [],
    serves: ["plant:femfolk"],
    description: "Will research artists and prepare Femfolk episode material.",
  },
  {
    slug: "weekly-digest",
    name: "Weekly digest",
    kind: "routine",
    status: "planned",
    engine: "claude-routine",
    levers: [],
    serves: ["plant:ariko"],
    description: "Will write the weekly cross-plant digest of the beanstalk (slice 5).",
  },
];

const stripDomain = (pod: Pod): Pod => {
  const rest = { ...pod } as Pod & { domain?: unknown };
  delete rest.domain;
  return rest;
};

export function retierGarden(raw: RawGarden): RawGarden {
  const inPods = raw.pods ?? [];
  const plants = [...(raw.plants ?? [])];
  const bees = [...(raw.bees ?? [])];
  const plantSlugs = new Set(plants.map((p) => p.slug));
  const podBySlug = new Map(inPods.map((p) => [p.slug, p]));

  // Every catalog slug absorbs a same-slug pod when one exists.
  const absorbed = new Set<string>();

  for (const { slug, natures } of PROMOTED) {
    const pod = podBySlug.get(slug);
    if (pod) absorbed.add(slug);
    if (plantSlugs.has(slug) || !pod) continue; // already promoted, or nothing to promote
    const { parents: _parents, ...rest } = stripDomain(pod);
    plants.push({ ...rest, natures });
    plantSlugs.add(slug);
  }

  for (const def of CREATED) {
    const pod = podBySlug.get(def.slug);
    if (pod) absorbed.add(def.slug);
    if (plantSlugs.has(def.slug)) continue;
    plants.push({
      ...def,
      ...(pod?.visibility ? { visibility: pod.visibility } : {}),
      ...(pod?.tags ? { tags: pod.tags } : {}),
    });
    plantSlugs.add(def.slug);
  }

  const pods = inPods
    .filter((p) => !absorbed.has(p.slug))
    .map((p) => {
      const out = stripDomain(p);
      const parents = [...(out.parents ?? [])];
      if (ALBUM_PODS.includes(out.slug) && !parents.includes("plant:bohns-music")) {
        parents.push("plant:bohns-music");
      }
      return parents.length > 0 ? { ...out, parents } : out;
    });

  // A pod: ref whose slug is now a plant (and no pod with that slug remains)
  // climbs a tier. Catalog-scoped so an unrelated future pod named like a
  // plant is never rewritten by accident.
  const catalog = new Set([...PROMOTED.map((d) => d.slug), ...CREATED.map((d) => d.slug)]);
  const remainingPodSlugs = new Set(pods.map((p) => p.slug));
  const promoteRef = (ref: string): string => {
    if (!ref.startsWith(POD_PREFIX)) return ref;
    const slug = ref.slice(POD_PREFIX.length);
    return catalog.has(slug) && !remainingPodSlugs.has(slug) ? PLANT_PREFIX + slug : ref;
  };

  const beans = (raw.beans ?? []).map((b) => {
    const parents = (b.parents ?? []).map(promoteRef);
    return JSON.stringify(parents) === JSON.stringify(b.parents ?? []) ? b : { ...b, parents };
  });

  const sprouts = (raw.sprouts ?? []).map((s) => {
    if (!s.relations) return s;
    const relations = s.relations.map((r) => ({ ...r, ref: promoteRef(r.ref) }));
    return JSON.stringify(relations) === JSON.stringify(s.relations) ? s : { ...s, relations };
  });

  const beeSlugs = new Set(bees.map((b) => b.slug));
  for (const bee of SEED_BEES) {
    if (!beeSlugs.has(bee.slug)) bees.push(bee);
  }

  return { plants, pods, beans, sprouts, bees };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/retier.ts lib/retier.test.ts
git commit -m "feat: pure idempotent re-tiering transform with plant and bee catalogs"
```

---

### Task 11: Migration script + validators + garden importer

**Files:**
- Create: `scripts/migrate-retier.ts`
- Modify: `scripts/migrate-garden.ts`, `scripts/apply-validators.ts`, `package.json`

- [ ] **Step 1: Create `scripts/migrate-retier.ts`**

```ts
// Slice 1 PR2 re-tiering: plants + bees, applied to BOTH data/garden.yml and
// Mongo through the same pure transform (lib/retier.ts).
// Usage: npm run migrate:retier [-- --dry-run]
// Idempotent: a re-run is a no-op on both halves. Plants and bees are written
// with $setOnInsert only, so an admin-flipped visibility survives a re-run.
// Run together with the deploy of the PR2 merge (old code reads pods+domain,
// new code reads plants — same coupling as PR1's migrate:botanical).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { getDb, closeDb } from "../lib/db";
import { retierGarden, PROMOTED, CREATED } from "../lib/retier";
import type { Bean, Bee, Plant, Pod, RawGarden, Sprout } from "../lib/data";

const DRY = process.argv.includes("--dry-run");

async function main() {
  // 1) garden.yml — the transform the tests cover, dumped back.
  const path = join(process.cwd(), "data", "garden.yml");
  const before = (yaml.load(readFileSync(path, "utf8"), { schema: yaml.CORE_SCHEMA }) as RawGarden) ?? {};
  const after = retierGarden(before);
  console.log(
    `${DRY ? "[dry] " : ""}garden.yml: ${after.plants?.length ?? 0} plants, ${after.pods?.length ?? 0} pods, ` +
      `${after.beans?.length ?? 0} beans, ${after.sprouts?.length ?? 0} sprouts, ${after.bees?.length ?? 0} bees`,
  );
  if (!DRY) writeFileSync(path, yaml.dump(after, { lineWidth: 100 }), "utf8");

  // 2) Mongo — same transform against the live collections, diffed per doc.
  const db = await getDb();
  const noId = { projection: { _id: 0 } };
  const raw: RawGarden = {
    plants: await db.collection<Plant>("plants").find({}, noId).toArray(),
    pods: await db.collection<Pod>("pods").find({}, noId).toArray(),
    beans: await db.collection<Bean>("beans").find({}, noId).toArray(),
    sprouts: await db.collection<Sprout>("sprouts").find({}, noId).toArray(),
    bees: await db.collection<Bee>("bees").find({}, noId).toArray(),
  };
  const out = retierGarden(raw);

  for (const p of out.plants ?? []) {
    console.log(`${DRY ? "[dry] " : ""}upsert plant ${p.slug}`);
    if (!DRY) {
      await db.collection("plants").updateOne(
        { slug: p.slug },
        { $setOnInsert: { ...p, visibility: p.visibility ?? "public" } },
        { upsert: true },
      );
    }
  }

  const keptPodSlugs = new Set((out.pods ?? []).map((p) => p.slug));
  for (const p of raw.pods ?? []) {
    if (keptPodSlugs.has(p.slug)) continue;
    console.log(`${DRY ? "[dry] " : ""}remove pod ${p.slug} (absorbed into its plant)`);
    if (!DRY) await db.collection("pods").deleteOne({ slug: p.slug });
  }
  for (const p of out.pods ?? []) {
    console.log(`${DRY ? "[dry] " : ""}retier pod ${p.slug}`);
    if (!DRY) {
      await db.collection("pods").updateOne(
        { slug: p.slug },
        {
          ...(p.parents && p.parents.length > 0 ? { $set: { parents: p.parents } } : {}),
          $unset: { domain: "" },
        },
      );
    }
  }

  const beansBefore = new Map((raw.beans ?? []).map((b) => [b.slug, b]));
  for (const b of out.beans ?? []) {
    const prev = beansBefore.get(b.slug);
    if (prev && JSON.stringify(prev.parents) === JSON.stringify(b.parents)) continue;
    console.log(`${DRY ? "[dry] " : ""}re-parent bean ${b.slug} -> ${JSON.stringify(b.parents)}`);
    if (!DRY) await db.collection("beans").updateOne({ slug: b.slug }, { $set: { parents: b.parents } });
  }

  const sproutsBefore = new Map((raw.sprouts ?? []).map((s) => [s.slug, s]));
  for (const s of out.sprouts ?? []) {
    const prev = sproutsBefore.get(s.slug);
    if (!s.relations || (prev && JSON.stringify(prev.relations) === JSON.stringify(s.relations))) continue;
    console.log(`${DRY ? "[dry] " : ""}retier relations on sprout ${s.slug}`);
    if (!DRY) await db.collection("sprouts").updateOne({ slug: s.slug }, { $set: { relations: s.relations } });
  }

  for (const bee of out.bees ?? []) {
    console.log(`${DRY ? "[dry] " : ""}upsert bee ${bee.slug}`);
    if (!DRY) {
      await db.collection("bees").updateOne(
        { slug: bee.slug },
        { $setOnInsert: { ...bee, visibility: bee.visibility ?? "private" } },
        { upsert: true },
      );
    }
  }

  // Stored seeds suggesting a now-promoted pod: the suggestion climbs a tier.
  const catalog = [...PROMOTED.map((d) => d.slug), ...CREATED.map((d) => d.slug)];
  const filter = { "suggested.podSlug": { $in: catalog } };
  const n = await db.collection("seeds").countDocuments(filter);
  console.log(`${DRY ? "[dry] " : ""}retier suggested.podSlug -> plantSlug on ${n} seeds`);
  if (!DRY && n > 0) {
    await db.collection("seeds").updateMany(filter, { $rename: { "suggested.podSlug": "suggested.plantSlug" } });
  }

  await closeDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 2: Add the npm script**

In `package.json` scripts, after `migrate:botanical`:

```json
"migrate:retier": "node --env-file=.env.local --import tsx scripts/migrate-retier.ts"
```

- [ ] **Step 3: Extend `scripts/migrate-garden.ts`**

After the existing three `createIndex` calls add:

```ts
await db.collection("plants").createIndex({ slug: 1 }, { unique: true });
await db.collection("bees").createIndex({ slug: 1 }, { unique: true });
```

Before the pods loop add (plants default public like pods; bees default PRIVATE):

```ts
for (const p of raw.plants ?? []) {
  await db.collection("plants").updateOne(
    { slug: p.slug },
    p.visibility
      ? { $set: { ...p } }
      : { $set: { ...p }, $setOnInsert: { visibility: "public" } },
    { upsert: true },
  );
}
```

After the sprouts loop add:

```ts
for (const b of raw.bees ?? []) {
  await db.collection("bees").updateOne(
    { slug: b.slug },
    b.visibility
      ? { $set: { ...b } }
      : { $set: { ...b }, $setOnInsert: { visibility: "private" } },
    { upsert: true },
  );
}
```

Update the final `console.log` to include plants and bees counts.

- [ ] **Step 4: Extend `scripts/apply-validators.ts`**

Add after the `beans` validator:

```ts
await applyValidator("plants", {
  bsonType: "object",
  properties: {
    visibility: { enum: ["private", "public"] },
    natures: { bsonType: "array", items: { enum: ["work", "tool"] } },
    relations: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["kind", "ref"],
        properties: { kind: { bsonType: "string" }, ref: { bsonType: "string" } },
      },
    },
  },
});

await applyValidator("bees", {
  bsonType: "object",
  required: ["slug", "kind", "status"],
  properties: {
    slug: { bsonType: "string" },
    kind: { enum: ["adapter", "routine", "workflow", "capability"] },
    status: { enum: ["planned", "live", "paused", "broken"] },
    visibility: { enum: ["private", "public"] },
    serves: { bsonType: "array", items: { bsonType: "string" } },
    levers: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["label"],
        properties: {
          label: { bsonType: "string" },
          url: { bsonType: "string" },
          ref: { bsonType: "string" },
        },
      },
    },
  },
});
```

Also fix the two PR1-leftover log lines: `"capture indexes ensured"` → `"seed indexes ensured"`, `"atomic indexes ensured"` → `"botanical indexes ensured"`.

- [ ] **Step 5: Typecheck + full suite (scripts compile under tsc)**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. **Do not run any `npm run migrate:*` script — Mongo is prod.**

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-retier.ts scripts/migrate-garden.ts scripts/apply-validators.ts package.json
git commit -m "feat: re-tiering migration script, plant/bee validators and garden importer support"
```

---

### Task 12: Run the migration (WITH the deploy — prod Mongo)

**Files:**
- Modify: `data/garden.yml` (rewritten by the script)

**⚠️ This task talks to production Atlas.** Execute it at merge/deploy time, not during development. Sequence mirrors PR1: the promoted pods vanish from `pods` the moment the Mongo half runs, so the previously-deployed code loses them from its directory until the new deploy is live — run the two together.

- [ ] **Step 1: Apply validators and indexes**

Run: `npm run validators`
Expected: `validator applied: …` lines including `plants` and `bees`; `seed indexes ensured`; `botanical indexes ensured`.

- [ ] **Step 2: Dry-run and REVIEW the output**

Run: `npm run migrate:retier -- --dry-run`
Expected: `[dry]` lines only — 12 plant upserts, 6 pod removals, `retier pod` lines, `re-parent bean` lines for the promoted pods' beans (e.g. `pbbls-webapp -> ["plant:pbbls"]`), 6 bee upserts, and a seeds count. If anything looks off (unexpected removals, unknown slugs), STOP and report.

- [ ] **Step 3: Run for real, then prove idempotence**

Run: `npm run migrate:retier`
Then: `npm run migrate:retier -- --dry-run`
Expected second run: plant/bee upserts remain (they are `$setOnInsert` no-ops by construction), but **zero** `remove pod`, **zero** `re-parent bean`, and `0 seeds`.

- [ ] **Step 4: Commit the rewritten garden.yml**

The script rewrote `data/garden.yml` (plants + bees sections, domains stripped, album pods re-parented). The retier tests double as the fixture check — run `npm test` (all green, now against the post-migration file), then:

```bash
git add data/garden.yml
git commit -m "chore: re-tier garden.yml — plants and first bees"
```

- [ ] **Step 5: Verify live behavior (after deploy)**

- `/` shows plant sections (Bohns Music with the three album pods; Pebbles with its beans directly).
- `/timeline` filter row lists plant slugs; filtering works.
- `/api/graph` contains `plant:` node ids, the two public bees, a `distributes` edge and `serves` edges.
- `/admin/vault` filters by plant; `/admin/triage/<id>` shows the Plant select.

---

### Task 13: Final review + PR

**Files:** none

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

Run: `grep -rn "molecule\|atom\|Molecule\|Atom\|Domain" lib app scripts --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "atomic\|anatomy"`
Expected: hits ONLY in `lib/inbox.ts` (the deliberate boundary alias) and historical comments that explicitly describe the legacy wire contract. Anything else is a leftover — fix it.

- [ ] **Step 2: Push and open the PR — with a Lab Note (required: this ships visitor-visible changes)**

```bash
git push -u origin feat/plants-bees
```

PR title: `Slice 1 PR2 — plants, bees and the re-tiering`. Body must include the spec link, a summary of the tiers/cascade changes, the migration run instructions (Task 12), and this Lab Note section:

````markdown
## Lab Note

```yaml
en:
  title: The garden now grows whole plants — and its first bees
  summary: Every project is now a plant on the map, from the Pebbles app to the Bohns Music albums, and the timeline lets you browse by plant. Six worker bees have landed on the graph too, showing what tends the garden.
fr:
  title: Le jardin fait pousser des plantes entières — et ses premières abeilles
  summary: Chaque projet est désormais une plante sur la carte, de l'app Pebbles aux albums Bohns Music, et tu peux explorer la timeline plante par plante. Six abeilles ouvrières se sont aussi posées sur le graphe — elles montrent qui prend soin du jardin.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```
````

- [ ] **Step 3: Use superpowers:finishing-a-development-branch** to close out once review passes.

---

## Spec coverage self-check (§5 PR2 acceptance)

| Acceptance item | Task |
|---|---|
| Cascade tests extended to the plant tier, fail-closed; publish climbs to plants; unpublish honors sheltered plants | Tasks 2, 3 |
| Re-tiering dry-run asserted against a fixture of the current garden; idempotent on re-run | Tasks 10, 12 |
| Graph snapshot: plants + public-only bees, `distributes`/`chronicles` edges, both-ends prune | Task 4 |
| Beans parented directly to a plant are first-class (dataset, filterPublic, timeline) | Tasks 1, 2, 8 |
| Timeline groups by plant; no reference to `Domain` remains | Tasks 8, 9 |
