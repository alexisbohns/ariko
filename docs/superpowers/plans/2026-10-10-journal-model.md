# The Journal Model (slice two, part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sprout becomes a dated journal entry: a closed `kind` vocabulary replaces the free `type`, an authored `about: ["pod:…", "bean:…"]` replaces the `parents: ["bean:…"]` containment, its plant is DERIVED from `about`, publishing flips only that plant, the unpublish cascade is deleted, and one migration re-anchors every stored sprout.

**Architecture:** Spec `docs/superpowers/specs/2026-10-10-journal-model-design.md` §1.2, §2, §3 (admin half), §4 steps 1/3/4, §6. `lib/sprout-kind.ts` is the client-safe vocabulary (the `lib/sprout-state.ts` pattern). `resolveSproutPlants` / `resolveSproutPlant` in `lib/data.ts` is the ONE place the derivation is spelled; `filterPublic`, `buildDataset`, `publishCascade`, the admin tables and the about panel all call it. `lib/sprout-anchor.ts` validates an authored `about` against the garden for the two write doors (the sprout page's about panel and seed promotion). `scripts/migrate-journal.ts` grows a second phase (re-anchor) behind the article fold it already carries. The PUBLIC reading surfaces (`/sprout/[slug]`, the plant/pod/bean journals, deleting `articleFor`) are **part B**, a separate plan — this part keeps every existing public page rendering on the new shape and stops there.

**Tech Stack:** Next.js 15 / React 19 / TypeScript / MongoDB; tests are `node:test` + `node:assert/strict`.

**Working rules for every task:**
- Work in the worktree this plan lives in (`git rev-parse --show-toplevel`), on branch `journal/journal-model`, which is stacked on `journal/bean-narrative` (PR #115). Never build or clear `.next` in `/Users/alexis/code/ariko`.
- Run a single test file with `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test <file>`. `npm test` is the unit suite; `npx tsc --noEmit` and `npx eslint .` are the other two gates. DB tests: `npm run test:db` (serial, against `beanstalk_scratch`; `.env.local` points at production, so `MONGODB_DB` must stay forced — the npm script does that).
- Fixture convention: a sprout literal in a test now reads `kind: "milestone"` (or another member) and `about: ["bean:x"]`; never `type:`, never `parents: ["bean:…"]`. A plant-level sprout reads `parents: ["plant:x"]` with no `about`.
- Every rule a test pins passes `tsc`, `npm test` and `npm run build` while silently false — when a task says "pin", write the assertion so that deleting the guarded line turns it red, and check that it does.
- Commit after each task with the repo's commit voice (imperative, lowercase after a `Scope:` prefix is NOT used — look at `git log --oneline -20` and match it) and end the message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Shape of the data after this plan

```ts
interface Sprout {
  slug: string;
  name: Text;
  kind: SproutKind;            // "log" | "milestone" | "release" | "essay" | "decision" | "digest"
  date: string;                // YYYY-MM-DD
  description: Text;
  about?: string[];            // "pod:…" / "bean:…" refs — the plant is DERIVED from them
  parents?: string[];          // ONE "plant:…" ref, ONLY when `about` is empty
  relations?: Relation[]; state?: SproutState; content?: Text; media?: Media[];
  links?: PlatformLink[]; source?: Source; tags?: string[];
}
```

Derivation (`resolveSproutPlants`): for each `about` ref — a bean contributes its direct `plant:` parents and the `plant:` parents of each of its `pod:` parents; a pod contributes its `plant:` parents. With `about` empty, the sprout's own `parents` `plant:` refs. Dangling refs are ignored everywhere, as `filterPublic` ignores them. `resolveSproutPlant` is that set when it has EXACTLY one member, else `null` — an ambiguous sprout is treated as unresolvable, fail-closed, on every read.

Type mapping for stored data (spec §4, used by the migration AND by the fixture sweep):

| old `type` | `kind` |
|---|---|
| note | log |
| milestone, feature, song, episode | milestone |
| release | release |
| essay | essay |
| decision | decision |
| digest | digest |
| article | folded by phase one (never re-anchored) |
| anything else | refused — the operator retypes or deletes it in the admin |

---

### Task 1: The kind vocabulary

**Files:**
- Create: `lib/sprout-kind.ts`, `lib/sprout-kind.test.ts`
- Modify: `lib/glyphs.ts`, `lib/glyphs.test.ts`, `components/admin/glyphs.tsx`, `lib/sprout-edit.ts`, `lib/sprout-edit.test.ts`, `lib/synthesis.ts`
- Delete: `lib/sprout-type.ts`, `lib/sprout-type.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/sprout-kind.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_KIND, DIGEST_KIND, SPROUT_KINDS, isSproutKind, kindForSuggestion } from "./sprout-kind";
import { sproutKindLabel } from "./glyphs";

test("the vocabulary is the six kinds of the journal model, in display order", () => {
  assert.deepEqual([...SPROUT_KINDS], ["log", "milestone", "release", "essay", "decision", "digest"]);
  assert.equal(DEFAULT_KIND, "log");
  assert.equal(DIGEST_KIND, "digest");
});

test("isSproutKind admits members only — no free strings, no padding, no case", () => {
  for (const k of SPROUT_KINDS) assert.equal(isSproutKind(k), true);
  for (const bad of ["", "note", "song", "digest ", " log", "Log", "article", "bla"]) {
    assert.equal(isSproutKind(bad), false, bad);
  }
});

test("every kind has a label, and the label is the word capitalized", () => {
  assert.equal(sproutKindLabel("log"), "Log");
  assert.equal(sproutKindLabel("milestone"), "Milestone");
  assert.equal(sproutKindLabel("release"), "Release");
  assert.equal(sproutKindLabel("essay"), "Essay");
  assert.equal(sproutKindLabel("decision"), "Decision");
  assert.equal(sproutKindLabel("digest"), "Digest");
});

test("kindForSuggestion maps a lab note's type onto the vocabulary, defaulting to log", () => {
  assert.equal(kindForSuggestion("feature"), "milestone");
  assert.equal(kindForSuggestion("improvement"), "milestone");
  assert.equal(kindForSuggestion("announcement"), "release");
  assert.equal(kindForSuggestion("fix"), "log");
  assert.equal(kindForSuggestion("anything"), "log");
  assert.equal(kindForSuggestion(undefined), "log");
  // A member passes through unchanged: a seed may already name a kind.
  assert.equal(kindForSuggestion("decision"), "decision");
});
```

- [ ] **Step 2: Run it** — expect `Cannot find module './sprout-kind'`.

- [ ] **Step 3: Write `lib/sprout-kind.ts`** (client-safe, imports NOTHING — the `lib/sprout-state.ts` reason: the kind popover lives in the sprout head, a client island, and `lib/data.ts` opens with `node:fs`):

```ts
/**
 * A sprout's kind as a VOCABULARY — the closed list the journal model gives the
 * field that used to be the free string `type` (spec 2026-10-10 §1.2).
 *
 * **Client-safe, and imports nothing**, for `lib/sprout-state.ts`'s reason: the
 * kind popover lives in `app/admin/_components/sprout-hero.tsx`, a client
 * island, and a value import from `lib/data.ts` (which opens with `node:fs`)
 * would fail `npm run build` four modules downstream. `lib/data.ts` imports the
 * TYPE from here, never the other way round.
 *
 * The WORDS are in `lib/glyphs.ts` (`sproutKindLabel`) and the ICONS in
 * `components/admin/glyphs.tsx` (`SPROUT_KIND_ICONS`), the split every admin
 * enum makes. Sub-species — retrospective, learning, experiment — are TAGS, not
 * members: the vocabulary names what an entry IS, tags name what it is about.
 */
export const SPROUT_KINDS = ["log", "milestone", "release", "essay", "decision", "digest"] as const;
export type SproutKind = (typeof SPROUT_KINDS)[number];

/** A dated note on work done — what an entry is unless it says otherwise. */
export const DEFAULT_KIND: SproutKind = "log";
/** The machine-written weekly wrap. The one member with behaviour: publishing a
 *  digest marks review sign-off, not exhibition, so it is exempt from the
 *  publish cascade (`shouldCascadePublish`) and `bucketWeek` never narrates one. */
export const DIGEST_KIND: SproutKind = "digest";

export function isSproutKind(raw: string): raw is SproutKind {
  return (SPROUT_KINDS as readonly string[]).includes(raw);
}

/**
 * A lab note's `suggested.type` (feature | improvement | fix | announcement —
 * the Lab Note wire contract, unchanged) onto the vocabulary. A hint for the
 * triage form's default radio, never a commitment; a value that already names a
 * kind passes through, anything unknown is a log.
 */
export function kindForSuggestion(type: string | undefined): SproutKind {
  if (type !== undefined && isSproutKind(type)) return type;
  switch (type) {
    case "feature":
    case "improvement":
      return "milestone";
    case "announcement":
      return "release";
    default:
      return DEFAULT_KIND;
  }
}
```

- [ ] **Step 4: Add the label to `lib/glyphs.ts`** (below `sproutStateLabel`):

```ts
import type { SproutKind } from "./sprout-kind";

/** A sprout's six kinds, in words — the display half of `lib/sprout-kind.ts`. */
const SPROUT_KIND_LABELS: Record<SproutKind, string> = {
  log: "Log",
  milestone: "Milestone",
  release: "Release",
  essay: "Essay",
  decision: "Decision",
  digest: "Digest",
};

export function sproutKindLabel(kind: SproutKind): string {
  return SPROUT_KIND_LABELS[kind];
}
```

- [ ] **Step 5: Add the icon map and glyph to `components/admin/glyphs.tsx`**, directly under `SproutStateGlyph`, mirroring `SPROUT_STATE_ICONS` / `SproutStateGlyph` exactly (same `IconGlyph`, label from `sproutKindLabel`, no tone):

```tsx
import type { SproutKind } from "@/lib/sprout-kind";
// add to the lucide import: NotebookPen, Flag, Package, Feather, Scale, Newspaper

/** EXPORTED for the same reason `SPROUT_STATE_ICONS` is: the sprout head's kind
 *  trigger draws from this map, so the icon on the head is the icon on the row. */
export const SPROUT_KIND_ICONS: Record<SproutKind, ComponentType<{ className?: string }>> = {
  log: NotebookPen,
  milestone: Flag,
  release: Package,
  essay: Feather,
  decision: Scale,
  digest: Newspaper,
};

export function SproutKindGlyph({ kind }: { kind: SproutKind }) {
  return <IconGlyph icon={SPROUT_KIND_ICONS[kind]} label={sproutKindLabel(kind)} />;
}
```

(Check each lucide name exists in the installed `lucide-react`: `ls node_modules/lucide-react/dist/esm/icons | grep -E '^(notebook-pen|flag|package|feather|scale|newspaper)\.js$'`. Substitute a near synonym if one is missing, and say so in your report.)

- [ ] **Step 6: Re-key the digest exemption.** `lib/synthesis.ts`: delete `export const DIGEST_TYPE = "digest";` and add `import { DIGEST_KIND } from "./sprout-kind";` where the module needs it (Task 10 finishes this file; here only make it compile: `WindowSprout.type` → `kind: SproutKind` and `if (s.kind === DIGEST_KIND) continue;`). `lib/sprout-edit.ts` becomes:

```ts
import { DIGEST_KIND, type SproutKind } from "./sprout-kind";

/**
 * Pure gate for the publish cascade (final review C1, re-keyed by the journal
 * model). Digest publication marks review sign-off, not public exhibition: the
 * digest beans and plants are curated private containers, and flipping them
 * public is a separate human act on the plant itself. Every other kind makes
 * its plant public on publish (spec 2026-10-10 §2).
 */
export function shouldCascadePublish(kind: SproutKind): boolean {
  return kind !== DIGEST_KIND;
}
```

and its test:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldCascadePublish } from "./sprout-edit";
import { DIGEST_KIND, SPROUT_KINDS } from "./sprout-kind";

test("shouldCascadePublish: a digest is exempt; every other kind cascades", () => {
  for (const kind of SPROUT_KINDS) {
    assert.equal(shouldCascadePublish(kind), kind !== DIGEST_KIND, kind);
  }
});
```

- [ ] **Step 7: Delete `lib/sprout-type.ts` and `lib/sprout-type.test.ts`.** `grep -rn "sprout-type\|isSproutType\|DIGEST_TYPE" lib app scripts plugins components` — every remaining importer is handled by a later task (`app/admin/actions.ts` Task 7, `lib/garden-manifest.ts` Task 12, `lib/synthesis-store.ts` Task 10, `lib/journal-migration.ts` Task 14). Leave those for now; `tsc` is expected to be red until the tasks that own them land.

- [ ] **Step 8: Run** `lib/sprout-kind.test.ts`, `lib/sprout-edit.test.ts`, `lib/glyphs.test.ts` — all pass.

- [ ] **Step 9: Commit** — `git add -A lib/sprout-kind.ts lib/sprout-kind.test.ts lib/glyphs.ts lib/glyphs.test.ts components/admin/glyphs.tsx lib/sprout-edit.ts lib/sprout-edit.test.ts lib/synthesis.ts && git rm -q lib/sprout-type.ts lib/sprout-type.test.ts && git commit`.

---

### Task 2: The model — `kind`, `about`, the derived plant, the dataset

**Files:**
- Modify: `lib/data.ts`, `lib/data.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `lib/data.test.ts`:

```ts
import { resolveSproutPlant, resolveSproutPlants } from "./data";

const derivation: RawGarden = {
  plants: [
    { slug: "p1", name: "P1", natures: ["work"], role: { kind: "owner" }, description: "" },
    { slug: "p2", name: "P2", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  pods: [
    { slug: "pod1", name: "Pod 1", description: "", parents: ["plant:p1"] },
    { slug: "pod2", name: "Pod 2", description: "", parents: ["plant:p2"] },
    { slug: "unrooted", name: "Unrooted", description: "", parents: [] },
  ],
  beans: [
    { slug: "b-in-pod", name: "B", parents: ["pod:pod1"] },
    { slug: "b-direct", name: "B", parents: ["plant:p1"] },
    { slug: "b-other", name: "B", parents: ["pod:pod2"] },
    { slug: "b-orphan", name: "B", parents: ["pod:unrooted"] },
  ],
  sprouts: [],
};

test("resolveSproutPlants follows bean → pod → plant and bean → plant", () => {
  assert.deepEqual(resolveSproutPlants({ about: ["bean:b-in-pod"] }, derivation).map((p) => p.slug), ["p1"]);
  assert.deepEqual(resolveSproutPlants({ about: ["bean:b-direct"] }, derivation).map((p) => p.slug), ["p1"]);
  assert.deepEqual(resolveSproutPlants({ about: ["pod:pod2"] }, derivation).map((p) => p.slug), ["p2"]);
});

test("two refs under one plant resolve to that plant once; refs under two plants list both", () => {
  assert.deepEqual(
    resolveSproutPlants({ about: ["bean:b-in-pod", "bean:b-direct", "pod:pod1"] }, derivation).map((p) => p.slug),
    ["p1"],
  );
  assert.deepEqual(
    resolveSproutPlants({ about: ["bean:b-in-pod", "bean:b-other"] }, derivation).map((p) => p.slug),
    ["p1", "p2"],
  );
});

test("dangling and unrooted refs contribute nothing", () => {
  assert.deepEqual(resolveSproutPlants({ about: ["bean:nope", "pod:nope"] }, derivation), []);
  assert.deepEqual(resolveSproutPlants({ about: ["bean:b-orphan"] }, derivation), []);
});

test("with about empty, the sprout's own plant parent is the plant; with about present, parents are ignored", () => {
  assert.deepEqual(resolveSproutPlants({ parents: ["plant:p2"] }, derivation).map((p) => p.slug), ["p2"]);
  assert.deepEqual(resolveSproutPlants({ about: [], parents: ["plant:p2"] }, derivation).map((p) => p.slug), ["p2"]);
  assert.deepEqual(
    resolveSproutPlants({ about: ["bean:b-in-pod"], parents: ["plant:p2"] }, derivation).map((p) => p.slug),
    ["p1"],
  );
  assert.deepEqual(resolveSproutPlants({ parents: ["plant:nope"] }, derivation), []);
  assert.deepEqual(resolveSproutPlants({}, derivation), []);
});

test("resolveSproutPlant is the derivation when it names exactly one plant, else null (fail-closed)", () => {
  assert.equal(resolveSproutPlant({ about: ["bean:b-in-pod"] }, derivation)?.slug, "p1");
  assert.equal(resolveSproutPlant({ about: ["bean:b-in-pod", "bean:b-other"] }, derivation), null);
  assert.equal(resolveSproutPlant({ about: ["bean:nope"] }, derivation), null);
});

test("a bean moved to another pod moves its sprouts with it", () => {
  const sprout = { about: ["bean:b-in-pod"] };
  assert.equal(resolveSproutPlant(sprout, derivation)?.slug, "p1");
  const moved: RawGarden = {
    ...derivation,
    beans: derivation.beans!.map((b) => (b.slug === "b-in-pod" ? { ...b, parents: ["pod:pod2"] } : b)),
  };
  assert.equal(resolveSproutPlant(sprout, moved)?.slug, "p2");
});

const journal: RawGarden = {
  ...derivation,
  sprouts: [
    { slug: "s-bean", name: "S", kind: "log", date: "2026-01-03", description: "", about: ["bean:b-in-pod"] },
    { slug: "s-pod", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["pod:pod1"] },
    { slug: "s-plant", name: "S", kind: "log", date: "2026-01-04", description: "", parents: ["plant:p1"] },
    { slug: "s-other", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b-other"] },
    { slug: "s-two", name: "S", kind: "log", date: "2026-01-05", description: "", about: ["bean:b-in-pod", "bean:b-direct"] },
  ],
};

test("sproutsForBean lists the sprouts about that bean, newest first", () => {
  const ds = buildDataset(journal);
  assert.deepEqual(ds.sproutsForBean("b-in-pod").map((s) => s.slug), ["s-two", "s-bean"]);
  assert.deepEqual(ds.sproutsForBean("b-direct").map((s) => s.slug), ["s-two"]);
  assert.deepEqual(ds.sproutsForBean("nope"), []);
});

test("sproutsForPod lists sprouts about the pod OR about a bean inside it, newest first, once each", () => {
  const ds = buildDataset(journal);
  assert.deepEqual(ds.sproutsForPod("pod1").map((s) => s.slug), ["s-two", "s-bean", "s-pod"]);
  assert.deepEqual(ds.sproutsForPod("pod2").map((s) => s.slug), ["s-other"]);
});

test("sproutsForPlant lists every sprout whose DERIVED plant is this one, newest first", () => {
  const ds = buildDataset(journal);
  assert.deepEqual(ds.sproutsForPlant("p1").map((s) => s.slug), ["s-two", "s-plant", "s-bean", "s-pod"]);
  assert.deepEqual(ds.sproutsForPlant("p2").map((s) => s.slug), ["s-other"]);
});

test("timeline entries carry the first about-bean (or null) and the derived plant", () => {
  const byslug = new Map(buildDataset(journal).timelineSprouts().map((e) => [e.sprout.slug, e]));
  assert.equal(byslug.get("s-bean")!.bean?.slug, "b-in-pod");
  assert.equal(byslug.get("s-bean")!.plant?.slug, "p1");
  assert.equal(byslug.get("s-pod")!.bean, null);
  assert.equal(byslug.get("s-pod")!.plant?.slug, "p1");
  assert.equal(byslug.get("s-plant")!.bean, null);
  assert.equal(byslug.get("s-plant")!.plant?.slug, "p1");
});
```

- [ ] **Step 2: Run** `lib/data.test.ts` — the new tests fail (`resolveSproutPlants is not a function`; existing fixtures still carry `type`/`parents` and will fail to type-check under `tsx`? No — tsx does not type-check; they fail at runtime only where behaviour changed. Expect the OLD `sproutsForBean` / timeline tests to break too once Step 3 lands; Step 5 fixes the fixtures.)

- [ ] **Step 3: Change the model in `lib/data.ts`.** Replace the `Sprout` interface:

```ts
import type { SproutKind } from "./sprout-kind";

/**
 * A dated journal entry about a plant and the things in it (spec 2026-10-10
 * §1.2). NOT a version of a bean: a bean's story is its own `content`, and an
 * entry is a dated record — of work done, a state reached, a release, an
 * essay, a decision, or the weekly digest.
 *
 * Its plant is DERIVED, never stored: `about` names the pods and beans the
 * entry is about, every one of which rolls up to a plant, and all of them must
 * roll up to the SAME plant (the write doors refuse otherwise; the read side
 * treats an ambiguous sprout as unresolvable, fail-closed). `parents` holds
 * ONE `plant:` ref and only when `about` is empty — the plant-level entry with
 * no feature to hang on, the exception rather than the rule. A sprout carries
 * exactly one of the two, so a bean moved to another pod moves its entries
 * with it and nothing drifts. `resolveSproutPlant` below is the one place the
 * derivation is spelled; `filterPublic`, `buildDataset`, `publishCascade` and
 * the admin all call it.
 *
 * `about` is a typed field and not a relation kind because it is authored,
 * validated and rendered as doors, while `relations` is machine-mirrored from
 * prose and scrubbed.
 */
export interface Sprout {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  kind: SproutKind;
  date: string;
  description: Text;
  about?: string[]; // "pod:…" / "bean:…" refs; see the docblock
  parents?: string[]; // exactly one "plant:…" ref, ONLY when `about` is empty
  relations?: Relation[]; // non-containment edges (G2); scrubbed by filterPublic
  state?: SproutState; // absent => NOT published (safe default)
  content?: Text; // optional rich markdown, localizable
  media?: Media[];
  links?: PlatformLink[]; // destinations, never rendered inline — see PlatformLink
  source?: Source;
  tags?: string[];
}
```

The `[key: string]: unknown` index signature is REMOVED: a closed model has no per-type properties, and removing it is what makes `tsc` list every stale `type:` / `parents: ["bean:…"]` in a fixture (Step 5's checklist). If production code turns out to read an ad-hoc key through it, stop and report `DONE_WITH_CONCERNS` naming the reader.

Add, after `byDateDesc`:

```ts
/** The lookups the derivation needs — `RawGarden`'s three container tiers. */
export interface SproutGarden {
  plants?: Plant[];
  pods?: Pod[];
  beans?: Bean[];
}

/**
 * Every plant a sprout's refs roll up to, deduped, in first-reached order. A
 * bean contributes its direct `plant:` parents and the `plant:` parents of
 * each of its `pod:` parents; a pod contributes its `plant:` parents. With
 * `about` empty (or absent), the sprout's own `parents` `plant:` refs — and
 * with `about` present, `parents` is NOT consulted, because a sprout carries
 * one or the other and a stale `parents` must not become a second source of
 * truth. Dangling refs are ignored, exactly as filterPublic ignores them.
 */
export function resolveSproutPlants(
  sprout: Pick<Sprout, "about" | "parents">,
  garden: SproutGarden,
): Plant[] {
  const plantBySlug = new Map((garden.plants ?? []).map((p) => [p.slug, p]));
  const podBySlug = new Map((garden.pods ?? []).map((p) => [p.slug, p]));
  const beanBySlug = new Map((garden.beans ?? []).map((b) => [b.slug, b]));
  const found = new Map<string, Plant>();
  const addPlant = (slug: string): void => {
    const plant = plantBySlug.get(slug);
    if (plant) found.set(slug, plant);
  };
  const addPod = (slug: string): void => {
    const pod = podBySlug.get(slug);
    if (pod) for (const p of parentsWithPrefix(pod.parents, PLANT_PREFIX)) addPlant(p);
  };

  const about = sprout.about ?? [];
  if (about.length === 0) {
    for (const p of parentsWithPrefix(sprout.parents, PLANT_PREFIX)) addPlant(p);
    return [...found.values()];
  }
  for (const ref of about) {
    if (ref.startsWith(BEAN_PREFIX)) {
      const bean = beanBySlug.get(ref.slice(BEAN_PREFIX.length));
      if (!bean) continue;
      for (const p of parentsWithPrefix(bean.parents, PLANT_PREFIX)) addPlant(p);
      for (const p of parentsWithPrefix(bean.parents, POD_PREFIX)) addPod(p);
    } else if (ref.startsWith(POD_PREFIX)) {
      addPod(ref.slice(POD_PREFIX.length));
    }
  }
  return [...found.values()];
}

/** The sprout's plant: the derivation when it names EXACTLY one plant, else
 *  null. Zero is a dangling sprout; two is an ambiguous one, and the read side
 *  treats both as unresolvable rather than picking — fail-closed, as every
 *  privacy decision in this file is. */
export function resolveSproutPlant(
  sprout: Pick<Sprout, "about" | "parents">,
  garden: SproutGarden,
): Plant | null {
  const plants = resolveSproutPlants(sprout, garden);
  return plants.length === 1 ? plants[0] : null;
}
```

In `Dataset`, replace the `sproutsForBean` line with:

```ts
  /** Entries about this bean, newest first. */
  sproutsForBean(slug: string): Sprout[];
  /** Entries about this pod OR about a bean inside it, newest first, once each. */
  sproutsForPod(slug: string): Sprout[];
  /** Entries whose DERIVED plant is this one, newest first. */
  sproutsForPlant(slug: string): Sprout[];
```

In `buildDataset`, replace the "bean slug -> sprouts" block and the `timeline` construction with:

```ts
  // The journal indexes. One pass computes each sprout's derived plant and
  // its about-refs; the three maps below are filled from that, and sorted
  // once. `resolveSproutPlant` is the ONE derivation (see its docblock) —
  // nothing here re-derives.
  const sproutsByBean = new Map<string, Sprout[]>();
  const sproutsByPod = new Map<string, Sprout[]>();
  const sproutsByPlant = new Map<string, Sprout[]>();
  const push = (map: Map<string, Sprout[]>, key: string, sprout: Sprout): void => {
    const list = map.get(key) ?? [];
    if (!list.includes(sprout)) list.push(sprout);
    map.set(key, list);
  };
  const timeline: TimelineEntry[] = [];
  for (const sprout of sprouts) {
    const about = sprout.about ?? [];
    let firstBean: Bean | null = null;
    for (const beanSlug of parentsWithPrefix(about, BEAN_PREFIX)) {
      const bean = beanBySlug.get(beanSlug);
      if (!bean) continue;
      firstBean ??= bean;
      push(sproutsByBean, beanSlug, sprout);
      for (const podSlug of parentsWithPrefix(bean.parents, POD_PREFIX)) {
        if (podBySlug.has(podSlug)) push(sproutsByPod, podSlug, sprout);
      }
    }
    for (const podSlug of parentsWithPrefix(about, POD_PREFIX)) {
      if (podBySlug.has(podSlug)) push(sproutsByPod, podSlug, sprout);
    }
    const plant = resolveSproutPlant(sprout, raw);
    if (plant) push(sproutsByPlant, plant.slug, sprout);
    timeline.push({ sprout, bean: firstBean, plant });
  }
  for (const map of [sproutsByBean, sproutsByPod, sproutsByPlant]) {
    for (const list of map.values()) list.sort(byDateDesc);
  }
  timeline.sort((a, b) => byDateDesc(a.sprout, b.sprout));
```

and in the returned object:

```ts
    sproutsForBean: (slug) => sproutsByBean.get(slug) ?? [],
    sproutsForPod: (slug) => sproutsByPod.get(slug) ?? [],
    sproutsForPlant: (slug) => sproutsByPlant.get(slug) ?? [],
```

(`plantForBean` stays — the bean page and tables still use it.) Also update the `TimelineEntry` docblock: `bean` is "the first existing `bean:` ref in `about`, or null"; `plant` is "the DERIVED plant, or null".

- [ ] **Step 4: Run `npx tsc --noEmit`** and record the error list — it is the sweep checklist for Step 5 and Task 3's callers. Expected production-code errors (owned by later tasks, leave them): `lib/data.ts` filterPublic/publishCascade/unpublishCascade (Task 3–4), `lib/graph.ts` (Task 11), `lib/synthesis-store.ts` (Task 10), `lib/pbbls-legacy.ts` and `scripts/migrate-pbbls-legacy.ts` (Task 13), `lib/journal-migration.ts` and `scripts/migrate-journal.ts` (Task 14), `lib/garden-manifest.ts` / `lib/plant-garden-apply.ts` (Task 12), `lib/promote.ts` (Task 7), `app/admin/actions.ts` (Task 4/7), `app/admin/_components/sprout-hero.tsx` and `app/admin/(chrome)/sprout/[slug]/page.tsx` (Task 8), the two beanstalk pages (Task 9), `lib/sprout-hero-a11y.test.ts` (Task 8).

- [ ] **Step 5: Sweep the fixtures in `lib/data.test.ts` only** (the other test files are Task 3's and later tasks' — each task sweeps the test files it owns, and Task 15 runs the final `grep` that none remain): every sprout literal gets `kind:` per the mapping table and `about:` instead of `parents: ["bean:…"]`. The `publishCascade` / `unpublishCascade` tests in this file are DELETED or rewritten by Task 4 — leave them broken here, but make every other test in the file green.

- [ ] **Step 6: Run** `lib/data.test.ts` — everything except the cascade tests passes.

- [ ] **Step 7: Commit.**

---

### Task 3: `filterPublic` — drop by derived plant, scrub `about`

**Files:**
- Modify: `lib/data.ts` (`filterPublic`), `lib/visibility.test.ts`

- [ ] **Step 1: Write the failing tests** — in `lib/visibility.test.ts`, FIRST sweep the existing fixtures to the new shape (every sprout: `kind: "milestone"`, `about: ["bean:…"]` instead of `parents`). Then add:

```ts
test("filterPublic keeps a published sprout whose DERIVED plant is public, through a bean or a pod", () => {
  const seed: RawGarden = {
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p"] }],
    beans: [{ slug: "b", name: "B", parents: ["pod:pod"] }],
    sprouts: [
      { slug: "via-bean", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b"], state: "published" },
      { slug: "via-pod", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["pod:pod"], state: "published" },
      { slug: "plant-level", name: "S", kind: "log", date: "2026-01-03", description: "", parents: ["plant:p"], state: "published" },
    ],
  };
  assert.deepEqual((filterPublic(seed).sprouts ?? []).map((s) => s.slug).sort(), ["plant-level", "via-bean", "via-pod"]);
});

test("filterPublic drops a published sprout under a private plant, and one whose plant cannot be derived", () => {
  const seed: RawGarden = {
    plants: [
      { slug: "pub", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
      { slug: "priv", name: "P", natures: ["work"], role: { kind: "owner" }, description: "", visibility: "private" },
    ],
    pods: [{ slug: "pod-priv", name: "Pod", description: "", parents: ["plant:priv"] }],
    beans: [
      { slug: "b-priv-plant", name: "B", parents: ["pod:pod-priv"] },
      { slug: "b-pub", name: "B", parents: ["plant:pub"] },
    ],
    sprouts: [
      { slug: "under-private-plant", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b-priv-plant"], state: "published" },
      { slug: "dangling", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["bean:nope"], state: "published" },
      { slug: "ambiguous", name: "S", kind: "log", date: "2026-01-03", description: "", about: ["bean:b-pub", "bean:b-priv-plant"], state: "published" },
      { slug: "no-anchor", name: "S", kind: "log", date: "2026-01-04", description: "", state: "published" },
    ],
  };
  assert.deepEqual(filterPublic(seed).sprouts, []);
});

test("filterPublic keeps a sprout about a PRIVATE bean under a PUBLIC plant, and scrubs the door", () => {
  const seed: RawGarden = {
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p"] }],
    beans: [
      { slug: "b-pub", name: "B", parents: ["pod:pod"] },
      { slug: "b-priv", name: "B", parents: ["pod:pod"], visibility: "private" },
    ],
    sprouts: [
      { slug: "s", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b-priv", "bean:b-pub", "pod:pod", "bean:gone"], state: "published" },
      { slug: "untouched", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["bean:b-pub"], state: "published" },
      { slug: "no-about", name: "S", kind: "log", date: "2026-01-03", description: "", parents: ["plant:p"], state: "published" },
    ],
  };
  const out = filterPublic(seed).sprouts ?? [];
  const s = out.find((x) => x.slug === "s")!;
  assert.deepEqual(s.about, ["bean:b-pub", "pod:pod"]);
  // Pure: the input is never mutated, and an unchanged array is the SAME array.
  assert.deepEqual(seed.sprouts![0].about, ["bean:b-priv", "bean:b-pub", "pod:pod", "bean:gone"]);
  assert.equal(out.find((x) => x.slug === "untouched")!.about, seed.sprouts![1].about);
  // Absent stays absent — never materialize [].
  assert.equal("about" in out.find((x) => x.slug === "no-about")!, false);
});

test("filterPublic tolerates a malformed about from a direct DB write (non-array → [], non-strings dropped)", () => {
  const seed = {
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    beans: [{ slug: "b", name: "B", parents: ["plant:p"] }],
    sprouts: [
      { slug: "junk", name: "S", kind: "log", date: "2026-01-01", description: "", about: "bean:b", parents: ["plant:p"], state: "published" },
      { slug: "mixed", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["bean:b", 7, null], state: "published" },
    ],
  } as unknown as RawGarden;
  const out = filterPublic(seed).sprouts ?? [];
  // A non-array `about` is empty for derivation purposes (parents decide) and
  // is scrubbed to [] rather than leaked as whatever string it was.
  assert.deepEqual(out.find((x) => x.slug === "junk")!.about, []);
  assert.deepEqual(out.find((x) => x.slug === "mixed")!.about, ["bean:b"]);
});
```

Note the last test: `resolveSproutPlants` must treat a non-array `about` as empty. Add to its first lines: `const about = Array.isArray(sprout.about) ? sprout.about.filter((r): r is string => typeof r === "string") : [];` — and use that `about` in `buildDataset` too (extract a tiny `aboutRefs(sprout): string[]` helper exported from `lib/data.ts` and use it in BOTH places, so the derivation and the indexes read the field through one door).

- [ ] **Step 2: Run** `lib/visibility.test.ts` — new tests fail.

- [ ] **Step 3: Implement.** In `filterPublic`, replace the `keptSprouts` filter:

```ts
  // A sprout is public ONLY when published AND its DERIVED plant survived
  // above. The derivation runs against the RAW garden — a sprout about a
  // private bean under a public plant still has a plant, and keeps its place
  // in the plant's journal with the door to the bean scrubbed below. A sprout
  // whose refs all dangle, or roll up to two plants, has no plant and drops:
  // fail-closed, like every other decision here (spec 2026-10-10 §2).
  const keptSprouts = rawSprouts.filter((s) => {
    if (s.state !== "published") return false;
    const plant = resolveSproutPlant(s, raw);
    return plant !== null && plantKept.has(plant.slug);
  });
```

and the sprout scrub line:

```ts
  const sprouts = keptSprouts.map((s) => scrubAbout(scrubRelations(s, refSurvives), refSurvives));
```

with, beside `scrubRelations`:

```ts
// The `about` scrub — the relations scrub's rule applied to the authored
// field: absent stays absent, a non-array (a direct DB write) becomes [], and
// every ref whose target did not survive this projection drops. A public
// sprout about a private bean shows the sprout and not the door.
function scrubAbout<T extends { about?: string[] }>(item: T, refSurvives: (ref: string) => boolean): T {
  if (item.about === undefined) return item;
  if (!Array.isArray(item.about)) return { ...item, about: [] };
  const scrubbed = item.about.filter((ref) => typeof ref === "string" && refSurvives(ref));
  return scrubbed.length === item.about.length ? item : { ...item, about: scrubbed };
}
```

Update the `filterPublic` docblock's sprout bullets: "a Sprout is public ONLY when state === 'published' AND its derived plant (resolveSproutPlant) survives; its `about` is scrubbed like `relations`".

- [ ] **Step 4: Run** `lib/visibility.test.ts` and `lib/data.test.ts` — pass (cascade tests excepted).

- [ ] **Step 5: Commit.**

---

### Task 4: Publishing flips the plant; the unpublish cascade is deleted

**Files:**
- Modify: `lib/data.ts`, `lib/data.test.ts`, `lib/botanical.ts`, `lib/garden-cache-source.test.ts`, `app/admin/actions.ts`, `app/admin/_components/sprout-hero.tsx` (STATE_HINTS only), `lib/garden-cache.ts` (docblock), `lib/lineage.ts` (docblock)

- [ ] **Step 1: Write the failing tests** — in `lib/data.test.ts`, DELETE every test naming `unpublishCascade` or `unpublishCascadeForBeans` (lines 168–360 and 422–455 and 541–603 in the pre-task file; find them by `grep -n unpublish`) and rewrite the `publishCascade` tests as:

```ts
const cascade: RawGarden = {
  plants: [
    { slug: "p1", name: "P", natures: ["work"], role: { kind: "owner" }, description: "", visibility: "private" },
    { slug: "p2", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p1"], visibility: "private" }],
  beans: [
    { slug: "b", name: "B", parents: ["pod:pod"], visibility: "private" },
    { slug: "b2", name: "B", parents: ["plant:p2"] },
  ],
  sprouts: [
    { slug: "s", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b"] },
    { slug: "s-plant", name: "S", kind: "log", date: "2026-01-02", description: "", parents: ["plant:p1"] },
    { slug: "s-two", name: "S", kind: "log", date: "2026-01-03", description: "", about: ["bean:b", "bean:b2"] },
    { slug: "s-dangling", name: "S", kind: "log", date: "2026-01-04", description: "", about: ["bean:nope"] },
  ],
};

test("publishCascade names the sprout's DERIVED plant and nothing else — the bean and pod stay as they are", () => {
  assert.deepEqual(publishCascade(cascade, "s"), { plantSlugs: ["p1"] });
  assert.deepEqual(publishCascade(cascade, "s-plant"), { plantSlugs: ["p1"] });
});

test("publishCascade is idempotent — the plant is named regardless of its current visibility", () => {
  assert.deepEqual(publishCascade(cascade, "s-two" /* ambiguous */), { plantSlugs: [] });
  assert.deepEqual(publishCascade(cascade, "s-dangling"), { plantSlugs: [] });
  assert.deepEqual(publishCascade(cascade, "unknown"), { plantSlugs: [] });
});
```

(The second test's name says "idempotent": `p1` is private in the fixture and still named by the first test; keep both assertions where they are. An ambiguous sprout flips NOTHING — the write doors refuse to store one, and a publish of a stored one must not pick a plant.)

- [ ] **Step 2: Run** — `publishCascade` returns the old three-array shape; fails.

- [ ] **Step 3: Implement in `lib/data.ts`.** Replace `publishCascade`, `unpublishCascadeForBeans` and `unpublishCascade` (all three, with their docblocks) by:

```ts
/**
 * The publish cascade (spec 2026-10-10 §2): publishing a sprout makes ITS
 * PLANT public — the one `resolveSproutPlant` derives — and nothing else. The
 * beans and pods it is about are not flipped: a bean's visibility is editorial
 * now, and going public must not republish a feature held back on its own
 * terms. Pure; the plant's current visibility is not consulted (idempotent
 * flip). Unknown slug, dangling refs and an ambiguous derivation all name no
 * plant — the last because a publish must never PICK one.
 *
 * There is no unpublish cascade any more. A plant stays public once chosen,
 * and a bean with no published entry is simply a bean.
 */
export function publishCascade(raw: RawGarden, sproutSlug: string): { plantSlugs: string[] } {
  const sprout = (raw.sprouts ?? []).find((s) => s.slug === sproutSlug);
  if (!sprout) return { plantSlugs: [] };
  const plant = resolveSproutPlant(sprout, raw);
  return { plantSlugs: plant ? [plant.slug] : [] };
}
```

- [ ] **Step 4: `lib/botanical.ts`.** Delete `setPrivate` and its comment; change `setPublic`'s signature to `setPublic(plantSlugs: string[]): Promise<void>` calling `setVisibility(plantSlugs, [], [], "public")` — read `setVisibility` first; if it is only ever reached from these two, narrow IT to plants as well and delete the pod/bean branches (dead code reading as a live rule). Update the docblock near line 636 that says "Deliberately NOT setPublic/setPrivate". In `lib/garden-cache-source.test.ts` `GARDEN_WRITERS`, remove `"setPrivate"` (keep `setPublic`).

- [ ] **Step 5: `app/admin/actions.ts`.** Remove `unpublishCascade`, `unpublishCascadeForBeans`, `setPrivate` from the imports. In `promoteSeedAction`: `const { plantSlugs } = publishCascade(await loadRawGarden(), input.slug); await setPublic(plantSlugs);`. In `setSproutStateAction`: keep the `if (state === "published" && shouldCascadePublish(existing.kind))` branch with the same two-line shape, DELETE the `else if (existing.state === "published")` branch, and rewrite the docblock (the "two cascades" paragraph becomes: one cascade, upward, to the plant; an unpublish flips nothing — a plant stays public once chosen). In `deleteSproutAction`: delete `wasPublished`, the `unpublishCascadeForBeans` block and the `beanSlugs` capture; the redirect goes to the first `bean:` ref in `existing.about` (`/admin/bean/<slug>`) or `/admin/sprouts`; rewrite its docblock (a delete changes no visibility). `shouldCascadePublish(existing.type)` → `existing.kind`.

- [ ] **Step 6: Prose that described the old cascade.** `sprout-hero.tsx` `STATE_HINTS.published` → `"On the public site — and its plant is made public with it, unless it is a digest. Its beans and pods are not touched."`; `STATE_HINTS.draft` → `"Being written. Off the public site."`. `lib/garden-cache.ts`'s docblock mentions the cascade re-reading after write — keep it, it is still true for `publishCascade`. `lib/lineage.ts`'s docblock "exactly as publishCascade and filterPublic drop them" — still true.

- [ ] **Step 7: Run** `lib/data.test.ts`, `lib/garden-cache-source.test.ts`, `npx tsc --noEmit` (errors only in files owned by later tasks).

- [ ] **Step 8: Commit.**

---

### Task 5: The two sprout writers — `updateSproutKind`, `updateSproutAnchor`

**Files:**
- Create: `lib/sprout-anchor.ts` (the TYPE only, in this task; Task 6 adds the validator)
- Modify: `lib/botanical.ts`, `lib/garden-cache-source.test.ts`, `lib/content-store.test.ts`

- [ ] **Step 1: Create `lib/sprout-anchor.ts`** with the type:

```ts
/**
 * Where a sprout hangs — the write-side shape of spec 2026-10-10 §1.2. Exactly
 * one of the two: `about` refs (the plant is derived), or a plant (the
 * plant-level entry, `parents: ["plant:…"]` in storage). `updateSproutAnchor`
 * writes one and UNSETS the other, so a sprout never carries both.
 */
export type SproutAnchor = { about: string[] } | { plant: string };
```

- [ ] **Step 2: Write the failing DB test** — in `lib/content-store.test.ts` (sweep its existing sprout fixture to `kind: "milestone"`, `about: ["bean:__test__b"]` first), add:

```ts
import { updateSproutAnchor, updateSproutKind } from "./botanical";

test("updateSproutAnchor writes about and unsets parents, or writes a plant parent and unsets about", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__anchor", name: "S", kind: "log", date: "2026-10-10", description: "",
    parents: ["plant:__test__p"], state: "draft", media: [], source: { kind: "manual" },
  });

  await updateSproutAnchor("__test__anchor", { about: ["bean:__test__b", "pod:__test__pod"] });
  let doc = await db.collection("sprouts").findOne({ slug: "__test__anchor" }, { projection: { _id: 0 } });
  assert.deepEqual(doc!.about, ["bean:__test__b", "pod:__test__pod"]);
  assert.equal("parents" in doc!, false);

  await updateSproutAnchor("__test__anchor", { plant: "__test__p2" });
  doc = await db.collection("sprouts").findOne({ slug: "__test__anchor" }, { projection: { _id: 0 } });
  assert.deepEqual(doc!.parents, ["plant:__test__p2"]);
  assert.equal("about" in doc!, false);
  // Everything else untouched.
  assert.equal(doc!.state, "draft");
  assert.equal(doc!.kind, "log");
});

test("updateSproutKind writes kind and nothing else", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__kind", name: "S", kind: "log", date: "2026-10-10", description: "",
    about: ["bean:__test__b"], state: "private", media: [], source: { kind: "manual" },
  });
  await updateSproutKind("__test__kind", "decision");
  const doc = await db.collection("sprouts").findOne({ slug: "__test__kind" }, { projection: { _id: 0 } });
  assert.equal(doc!.kind, "decision");
  assert.equal(doc!.state, "private");
  assert.deepEqual(doc!.about, ["bean:__test__b"]);
});
```

- [ ] **Step 3: Run** `npm run test:db` (or the single file with `MONGODB_DB=beanstalk_scratch` forced and `--env-file=.env.local`) — fails: not exported.

- [ ] **Step 4: Implement in `lib/botanical.ts`.** Replace `updateSproutType` (and its docblock) with:

```ts
import type { SproutKind } from "./sprout-kind";
import type { SproutAnchor } from "./sprout-anchor";

/**
 * A sprout's kind — and nothing else. A sibling of `updateSproutState`. The
 * value is a NAMED MEMBER of `lib/sprout-kind.ts`, re-validated by
 * `setSproutKindAction` before it reaches here; nothing checks it here.
 */
export async function updateSproutKind(slug: string, kind: SproutKind): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").updateOne({ slug }, { $set: { kind } });
}

/**
 * Where a sprout hangs (`lib/sprout-anchor.ts`). ONE write that sets one field
 * and unsets the other, so no sprout ever carries both `about` and `parents`
 * — the invariant the derivation (`resolveSproutPlants`) relies on to ignore
 * `parents` whenever `about` is present. Validation (every ref exists, all
 * roll up to one plant) is `resolveAnchor`'s, at the door; nothing checks it
 * here.
 */
export async function updateSproutAnchor(slug: string, anchor: SproutAnchor): Promise<void> {
  const db = await getDb();
  const update =
    "about" in anchor
      ? { $set: { about: anchor.about }, $unset: { parents: "" } }
      : { $set: { parents: [`${PLANT_PREFIX}${anchor.plant}`] }, $unset: { about: "" } };
  await db.collection<Sprout>("sprouts").updateOne({ slug }, update);
}
```

(`PLANT_PREFIX` is already exported from `./data`; import it if the file does not.) In `lib/garden-cache-source.test.ts` `GARDEN_WRITERS`: replace `"updateSproutType"` with `"updateSproutKind"`, add `"updateSproutAnchor"`.

- [ ] **Step 5: Run** the DB file and `lib/garden-cache-source.test.ts` — pass.

- [ ] **Step 6: Commit.**

---

### Task 6: `resolveAnchor` — the write-side validator

**Files:**
- Modify: `lib/sprout-anchor.ts`
- Create: `lib/sprout-anchor.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/sprout-anchor.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAnchor } from "./sprout-anchor";
import type { SproutGarden } from "./data";

const garden: SproutGarden = {
  plants: [
    { slug: "p1", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
    { slug: "p2", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  pods: [{ slug: "pod1", name: "Pod", description: "", parents: ["plant:p1"] }],
  beans: [
    { slug: "b1", name: "B", parents: ["pod:pod1"] },
    { slug: "b2", name: "B", parents: ["plant:p2"] },
  ],
};

test("about refs under one plant resolve to an about anchor and that plant", () => {
  assert.deepEqual(resolveAnchor(["bean:b1", "pod:pod1"], null, garden), {
    ok: true, anchor: { about: ["bean:b1", "pod:pod1"] }, plantSlug: "p1",
  });
});

test("refs are trimmed and deduped, in first-seen order", () => {
  const r = resolveAnchor([" bean:b1", "bean:b1", "pod:pod1 "], null, garden);
  assert.ok(r.ok);
  assert.deepEqual(r.anchor, { about: ["bean:b1", "pod:pod1"] });
});

test("an unknown ref, a wrong prefix and a blank are each refused by name", () => {
  assert.deepEqual(resolveAnchor(["bean:nope"], null, garden), { ok: false, error: "unknown ref bean:nope" });
  assert.deepEqual(resolveAnchor(["plant:p1"], null, garden), { ok: false, error: "an about ref names a pod or a bean, not plant:p1" });
  assert.deepEqual(resolveAnchor(["sprout:x"], null, garden), { ok: false, error: "an about ref names a pod or a bean, not sprout:x" });
  assert.deepEqual(resolveAnchor([""], null, garden), { ok: false, error: "an about ref names a pod or a bean, not (blank)" });
});

test("refs that roll up to two plants are refused, naming both", () => {
  assert.deepEqual(resolveAnchor(["bean:b1", "bean:b2"], null, garden), {
    ok: false, error: "about refs roll up to two plants (p1, p2) — a sprout belongs to one",
  });
});

test("a ref that rolls up to no plant is refused", () => {
  const unrooted: SproutGarden = { ...garden, pods: [{ slug: "pod1", name: "Pod", description: "", parents: [] }] };
  assert.deepEqual(resolveAnchor(["bean:b1"], null, unrooted), {
    ok: false, error: "about refs roll up to no plant — root the pod or bean under a plant first",
  });
});

test("a stated plant must agree with the derived one", () => {
  assert.equal(resolveAnchor(["bean:b1"], "p1", garden).ok, true);
  assert.deepEqual(resolveAnchor(["bean:b1"], "p2", garden), {
    ok: false, error: "about refs roll up to p1, not the chosen plant p2",
  });
});

test("with no refs, the plant is the anchor; it must exist", () => {
  assert.deepEqual(resolveAnchor([], "p1", garden), { ok: true, anchor: { plant: "p1" }, plantSlug: "p1" });
  assert.deepEqual(resolveAnchor([], "nope", garden), { ok: false, error: "unknown plant nope" });
  assert.deepEqual(resolveAnchor([], null, garden), { ok: false, error: "a sprout needs a plant, a pod or a bean" });
  assert.deepEqual(resolveAnchor([], "", garden), { ok: false, error: "a sprout needs a plant, a pod or a bean" });
});
```

- [ ] **Step 2: Run** — `resolveAnchor` not exported.

- [ ] **Step 3: Implement** — append to `lib/sprout-anchor.ts`:

```ts
import { BEAN_PREFIX, POD_PREFIX, resolveSproutPlants, type SproutGarden } from "./data";

export type AnchorResult =
  | { ok: true; anchor: SproutAnchor; plantSlug: string }
  | { ok: false; error: string };

/**
 * The validator both write doors run before `updateSproutAnchor` or
 * `createSprout` (the sprout page's about panel and seed promotion). Every
 * ref must name a pod or a bean that exists, and all of them must roll up —
 * through `resolveSproutPlants`, the one derivation — to exactly one plant;
 * when the caller also states a plant, the two must agree. With no refs, the
 * stated plant IS the anchor, and it must exist. Each error ends in what to
 * do, because the author reading it is the one who has to do it.
 *
 * `resolveSproutPlants`, not a re-derivation: this module decides whether to
 * WRITE, and the read side decides what it MEANS, and the two must not drift.
 */
export function resolveAnchor(
  rawRefs: string[],
  plantSlug: string | null,
  garden: SproutGarden,
): AnchorResult {
  const refs = [...new Set(rawRefs.map((r) => r.trim()))];
  const plant = plantSlug?.trim() || null;

  if (refs.length === 0) {
    if (!plant) return { ok: false, error: "a sprout needs a plant, a pod or a bean" };
    if (!(garden.plants ?? []).some((p) => p.slug === plant)) return { ok: false, error: `unknown plant ${plant}` };
    return { ok: true, anchor: { plant }, plantSlug: plant };
  }

  const podSlugs = new Set((garden.pods ?? []).map((p) => p.slug));
  const beanSlugs = new Set((garden.beans ?? []).map((b) => b.slug));
  for (const ref of refs) {
    const isPod = ref.startsWith(POD_PREFIX);
    const isBean = ref.startsWith(BEAN_PREFIX);
    if (!isPod && !isBean) return { ok: false, error: `an about ref names a pod or a bean, not ${ref || "(blank)"}` };
    const slug = ref.slice(ref.indexOf(":") + 1);
    if (isPod ? !podSlugs.has(slug) : !beanSlugs.has(slug)) return { ok: false, error: `unknown ref ${ref}` };
  }

  const plants = resolveSproutPlants({ about: refs }, garden).map((p) => p.slug);
  if (plants.length === 0) {
    return { ok: false, error: "about refs roll up to no plant — root the pod or bean under a plant first" };
  }
  if (plants.length > 1) {
    return { ok: false, error: `about refs roll up to two plants (${plants.join(", ")}) — a sprout belongs to one` };
  }
  if (plant && plant !== plants[0]) {
    return { ok: false, error: `about refs roll up to ${plants[0]}, not the chosen plant ${plant}` };
  }
  return { ok: true, anchor: { about: refs }, plantSlug: plants[0] };
}
```

("two plants" in the message even for three is fine; if you prefer `${plants.length} plants`, change the test and the message together.)

- [ ] **Step 4: Run** — pass. **Step 5: Commit.**

---

### Task 7: The actions — kind, about, and promotion

**Files:**
- Modify: `app/admin/actions.ts`, `lib/promote.ts`, `lib/promote.test.ts`, `lib/sprout-lang-redirect-source.test.ts`, `app/admin/(chrome)/triage/[id]/page.tsx`

- [ ] **Step 1: `lib/promote.ts`.** `SproutInput`:

```ts
import type { SproutKind } from "./sprout-kind";
import type { SproutAnchor } from "./sprout-anchor";

export interface SproutInput {
  slug: string;
  name: Text;
  kind: SproutKind;
  date: string;
  description: Text;
  state: SproutState;
  about?: string[];   // from the anchor — exactly one of about / parents
  parents?: string[];
  media: Media[];
  source: Source;
  content?: Text;
  relations?: Relation[];
}
```

`buildSproutInput(form, seed, anchor: SproutAnchor | null)`: `kind: get("kind") as SproutKind` (validated below — read raw here and let `validateSproutInput` decide, so the builder stays total: type it `kind: string` on an internal shape? No — keep `SproutInput.kind: SproutKind`, and have the builder do `const kindRaw = get("kind"); const kind: SproutKind = isSproutKind(kindRaw) ? kindRaw : DEFAULT_KIND;` with `validateSproutInput` checking the RAW form value is a member). Simplest honest version: builder returns `kind: kindRaw as SproutKind` and `validateSproutInput` rejects `!isSproutKind(v.kind)` with `"sprout kind must be one of log, milestone, release, essay, decision, digest"`. The anchor spreads in: `...(anchor && "about" in anchor ? { about: anchor.about } : {}), ...(anchor && "plant" in anchor ? { parents: [\`plant:${anchor.plant}\`] } : {})`. Delete the old `parents: beanParentSlug ? … : []` line and the `beanParentSlug` parameter. Update `lib/promote.test.ts` accordingly (kind radios, anchor spreading, the validator's kind refusal; sweep its fixtures).

- [ ] **Step 2: `app/admin/actions.ts` — `promoteSeedAction`.** After the pod/bean choices are resolved and BEFORE any write, compute the anchor:

```ts
  // Where the sprout hangs (spec 2026-10-10 §1.2). A created parent is rooted
  // by construction — a new bean under the chosen pod or plant, a new pod under
  // the chosen plant — so the anchor is composed directly; EXISTING refs go
  // through resolveAnchor against the live garden, which is also what refuses
  // a pod or bean that rolls up to a different plant than the one picked.
  const aboutRefs =
    beanChoice.mode !== "none" ? [`bean:${beanChoice.slug}`]
    : podChoice.mode !== "none" ? [`pod:${podChoice.slug}`]
    : [];
  let anchor: SproutAnchor;
  if (podChoice.mode === "create" || beanChoice.mode === "create") {
    if (!plantSlug && !(beanChoice.mode === "create" && podChoice.mode === "existing")) {
      redirect(`/admin/triage/${seedId}?error=${encodeURIComponent("pick a plant to root the new pod or bean under")}`);
    }
    anchor = { about: aboutRefs };
  } else {
    const resolved = resolveAnchor(aboutRefs, plantSlug, await loadRawGarden());
    if (!resolved.ok) redirect(`/admin/triage/${seedId}?error=${encodeURIComponent(resolved.error)}`);
    anchor = resolved.anchor;
  }
```

(Read the surrounding code: `plantSlug` is already parsed above; `resolveAnchor` and `SproutAnchor` get imported.) The precheck becomes `validateSproutInput(buildSproutInput(formData, seed, null))`; the create call `buildSproutInput(formData, seed, anchor)`. The existing-bean-under-new-pod guard stays.

- [ ] **Step 3: `setSproutKindAction`** replaces `setSproutTypeAction` — same shape as `setSproutDateAction`, field `kind`, `form` name `"kind"`:

```ts
/**
 * A sprout's kind — and nothing else. A NAMED MEMBER of `lib/sprout-kind.ts`,
 * re-validated here rather than trusted (the rule `flipPlantField` states for
 * the plant's two enums). One consequence worth naming: `shouldCascadePublish`
 * is consulted at publish time only, so moving a published sprout off `digest`
 * HERE does not flip its plant — the author's next act on the state control is
 * what settles it. `setSproutStateAction` reads `existing.kind`, so the gap
 * lives between two actions rather than inside one.
 */
export async function setSproutKindAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const lang = editLang(formData.get("lang"));

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const kind = String(formData.get("kind") ?? "").trim();
  if (!isSproutKind(kind)) {
    redirect(withEditLang(sproutHref(slug, `unknown kind: ${kind || "(blank)"}`, "kind"), lang));
  }

  await updateSproutKind(slug, kind);

  revalidateGarden();
  redirect(withEditLang(sproutHref(slug), lang));
}
```

- [ ] **Step 4: `setSproutAboutAction`** (new, same file, after the kind action):

```ts
/**
 * Where a sprout hangs — the about panel's one write. `about` arrives as
 * checkbox values (getAll), `plant` as the page's statement of the sprout's
 * CURRENT derived plant: the panel offers that plant's pods and beans and
 * nothing else, and `resolveAnchor` refuses a ref that would move the sprout to
 * another plant — moving a sprout between plants is not this slice's feature.
 * Nothing checked files the entry under the plant itself (`parents`).
 *
 * The write unsets the field it does not set (`updateSproutAnchor`), so the
 * derivation never meets a sprout carrying both.
 */
export async function setSproutAboutAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const lang = editLang(formData.get("lang"));

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const refs = formData.getAll("about").map((v) => String(v));
  const plant = String(formData.get("plant") ?? "").trim() || null;
  const resolved = resolveAnchor(refs, plant, await loadRawGarden());
  if (!resolved.ok) {
    redirect(withEditLang(sproutHref(slug, `could not save: ${resolved.error}`, "about"), lang));
  }

  await updateSproutAnchor(slug, resolved.anchor);

  revalidateGarden();
  redirect(withEditLang(sproutHref(slug), lang));
}
```

`lib/sprout-lang-redirect-source.test.ts` `FUNCTION_NAMES`: replace `"setSproutTypeAction"` with `"setSproutKindAction"` and add `"setSproutAboutAction"`. Read that test to see what else it pins per function (every redirect wrapped in `withEditLang`) and keep the new actions in that shape. `lib/garden-cache-source.test.ts` walks `actions.ts` per function for `revalidateGarden()` — both new actions call it.

- [ ] **Step 5: The triage page.** Replace the `Type` text input block with kind radios, drawn with the vocabulary's labels:

```tsx
import { SPROUT_KINDS, kindForSuggestion } from "@/lib/sprout-kind";
import { sproutKindLabel } from "@/lib/glyphs";
// …
<div className="flex flex-col gap-2">
  <span className="text-sm font-medium">Kind</span>
  <div className="flex flex-wrap items-center gap-4 pt-1">
    {SPROUT_KINDS.map((kind) => (
      <ChoiceLabel key={kind}>
        <NativeRadio name="kind" value={kind} defaultChecked={kind === kindForSuggestion(seed.suggested?.type)} />{" "}
        {sproutKindLabel(kind)}
      </ChoiceLabel>
    ))}
  </div>
</div>
```

Rewrite the Plant fieldset's comment: "The plant roots whatever is CREATED below, and is the sprout's anchor when no pod or bean is picked (a plant-level entry). With an existing pod or bean picked, the sprout's plant is derived from it and this select must agree."

- [ ] **Step 6: Run** `npx tsc --noEmit` (remaining errors only in Task 8–14 files), `lib/promote.test.ts`, `lib/sprout-lang-redirect-source.test.ts`, `lib/garden-cache-source.test.ts`.

- [ ] **Step 7: Commit.**

---

### Task 8: The sprout page — kind popover, about panel

**Files:**
- Modify: `app/admin/_components/sprout-hero.tsx`, `app/admin/(chrome)/sprout/[slug]/page.tsx`, `app/admin/_components/rail-icons.ts`, `lib/sprout-hero-a11y.test.ts`
- Create: `app/admin/_components/sprout-about-form.tsx`, `lib/sprout-about-form.test.ts`

- [ ] **Step 1: Failing tests.** In `lib/sprout-hero-a11y.test.ts`: the `hero()` default gets `kind: "log"` instead of `type: "article"`; the date/type test becomes:

```ts
test("the date and kind triggers name their stored values", async () => {
  const html = await hero({ date: "2026-09-12", kind: "essay" });
  assert.match(html, /aria-label="Date: 2026-09-12"/);
  assert.match(html, /aria-label="Kind: Essay"/);
});
```

(The "three fact triggers" count stays three.) New `lib/sprout-about-form.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import type { SproutGarden } from "@/lib/data";

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

const garden: SproutGarden = {
  plants: [
    { slug: "p1", name: "Plant One", natures: ["work"], role: { kind: "owner" }, description: "" },
    { slug: "p2", name: "Plant Two", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  pods: [
    { slug: "pod1", name: "Pod One", description: "", parents: ["plant:p1"] },
    { slug: "pod2", name: "Pod Two", description: "", parents: ["plant:p2"] },
  ],
  beans: [
    { slug: "b-in-pod", name: "In Pod", parents: ["pod:pod1"] },
    { slug: "b-direct", name: "Direct", parents: ["plant:p1"] },
    { slug: "b-other", name: "Other", parents: ["pod:pod2"] },
  ],
};

async function form(sprout: Record<string, unknown>) {
  const { SproutAboutForm } = await import("@/app/admin/_components/sprout-about-form");
  return render(React.createElement(SproutAboutForm, { sprout, garden, lang: "en" } as any));
}

test("the panel offers the derived plant's pods and beans as checkboxes, checked where the sprout is about them", async () => {
  const html = await form({ slug: "s", about: ["bean:b-in-pod"] });
  assert.match(html, /name="plant" value="p1"/);
  assert.match(html, /name="about" value="pod:pod1"/);
  assert.match(html, /name="about" value="bean:b-in-pod"[^>]*checked/);
  assert.match(html, /name="about" value="bean:b-direct"/);
  assert.doesNotMatch(html, /value="pod:pod2"/, "another plant's pod is not offered");
  assert.doesNotMatch(html, /value="bean:b-other"/, "another plant's bean is not offered");
  assert.match(html, /Plant One/, "the plant is shown, not edited");
  assert.match(html, /name="slug" value="s"/);
  assert.match(html, /name="lang" value="en"/);
});

test("a plant-level sprout checks nothing and still offers the plant's pods and beans", async () => {
  const html = await form({ slug: "s", parents: ["plant:p1"] });
  assert.match(html, /name="plant" value="p1"/);
  assert.doesNotMatch(html, /checked/);
});

test("a sprout with no derivable plant draws no form — only the explanation", async () => {
  const html = await form({ slug: "s", about: ["bean:b-in-pod", "bean:b-other"] });
  assert.doesNotMatch(html, /<form/);
  assert.match(html, /p1, p2/, "names the plants it rolls up to");
  const dangling = await form({ slug: "s", about: ["bean:nope"] });
  assert.doesNotMatch(dangling, /<form/);
});
```

- [ ] **Step 2: Run both** — fail.

- [ ] **Step 3: `sprout-hero.tsx`.** Props: `type: string` → `kind: SproutKind` (type import from `@/lib/sprout-kind`); `Surface = "meta" | "state" | "date" | "kind"`; the third `FactPopover` becomes the kind popover — label `` `Kind: ${sproutKindLabel(kind)}` ``, icon `SPROUT_KIND_ICONS[kind]` (import beside `SPROUT_STATE_ICONS`), body `<KindForm slug current={kind} lang />`. Write `KindForm` as a copy of `StateForm` over `SPROUT_KINDS` / `SPROUT_KIND_ICONS` / `sproutKindLabel` / `setSproutKindAction` with `name="kind"`, ids `kind-${option}`, Save disabled until the pick differs, and hints:

```ts
const KIND_HINTS: Record<SproutKind, string> = {
  log: "A dated note on work done — the default.",
  milestone: "A state reached: shipped, launched, recorded.",
  release: "A tagged version, usually mirrored from a feed.",
  essay: "A retrospective, a reflection, a learning.",
  decision: "A choice made, and why.",
  digest: "The machine-written weekly wrap. Publishing one marks review, and does not make its plant public.",
};
```

`FieldForm` loses the `"type"` member of its `field` union (it is now date-only; keep the component). Update the component docblock: "the three things a sprout IS — a state, a date, a kind".

- [ ] **Step 4: `sprout-about-form.tsx`** (a SERVER component — no `"use client"`, it renders a `<form action>` with native controls, like `sprout-meta-form.tsx`):

```tsx
import { resolveSproutPlant, resolveSproutPlants, resolveText, parentsWithPrefix, PLANT_PREFIX, POD_PREFIX, type Sprout, type SproutGarden } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { setSproutAboutAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ChoiceLabel, NativeCheckbox } from "@/components/ui/native-controls";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Where a sprout hangs, as a panel on the sprout page's rail (spec 2026-10-10
 * §3, admin). Server-rendered and handed to `EntityRail` as a ReactNode, per
 * the rail rule — the island learns no field name from it.
 *
 * The derived plant is SHOWN, not edited: the panel lists that plant's pods
 * (each with its beans) and its direct beans as checkboxes, and
 * `setSproutAboutAction` refuses anything that would roll up elsewhere.
 * Nothing checked files the entry under the plant itself. A sprout whose plant
 * cannot be derived — refs that dangle, or that roll up to two plants — gets
 * the explanation and no form: there is no honest list to offer it.
 */
export function SproutAboutForm({ sprout, garden, lang, error }: {
  sprout: Pick<Sprout, "slug" | "about" | "parents">;
  garden: SproutGarden;
  lang: Lang;
  error?: string;
}) {
  const plant = resolveSproutPlant(sprout, garden);
  if (!plant) {
    const plants = resolveSproutPlants(sprout, garden).map((p) => p.slug);
    return (
      <p className="text-sm text-muted-foreground">
        {plants.length === 0
          ? "This sprout's refs resolve to no plant. Root its pod or bean under a plant, or re-anchor it from a seed."
          : `This sprout's refs roll up to ${plants.length} plants (${plants.join(", ")}). It belongs to one — remove the refs under the other.`}
      </p>
    );
  }
  const checked = new Set(sprout.about ?? []);
  const pods = (garden.pods ?? []).filter((p) => parentsWithPrefix(p.parents, PLANT_PREFIX).includes(plant.slug));
  const beansOfPod = (podSlug: string) =>
    (garden.beans ?? []).filter((b) => parentsWithPrefix(b.parents, POD_PREFIX).includes(podSlug));
  const directBeans = (garden.beans ?? []).filter((b) => parentsWithPrefix(b.parents, PLANT_PREFIX).includes(plant.slug));

  const box = (ref: string, label: string, indent = false) => (
    <ChoiceLabel key={ref} className={indent ? "ml-6" : undefined}>
      <NativeCheckbox name="about" value={ref} defaultChecked={checked.has(ref)} /> {label}
    </ChoiceLabel>
  );

  return (
    <form action={setSproutAboutAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={sprout.slug} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="plant" value={plant.slug} />
      {error ? (
        <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}
      <p className="text-sm">
        <span className="text-muted-foreground">Plant </span>
        {resolveText(plant.name, lang)}
      </p>
      <div className="flex flex-col gap-2">
        {pods.map((pod) => [
          box(`pod:${pod.slug}`, resolveText(pod.name, lang)),
          ...beansOfPod(pod.slug).map((b) => box(`bean:${b.slug}`, resolveText(b.name, lang), true)),
        ])}
        {directBeans.map((b) => box(`bean:${b.slug}`, resolveText(b.name, lang)))}
      </div>
      <p className="text-xs leading-snug text-muted-foreground">
        What this entry is about. Nothing checked files it under the plant itself.
      </p>
      <div className="flex justify-end">
        <Button type="submit" size="sm">Save</Button>
      </div>
    </form>
  );
}
```

(`NativeCheckbox` exists in `components/ui/native-controls.tsx`. If a bean sits under two of this plant's pods it is listed twice — dedupe with a `seen` Set so a ref is offered once.)

- [ ] **Step 5: `rail-icons.ts`**: add `Route` to the re-export. **The sprout page**: `kind={sprout.kind}`; the fingerprint array swaps `sprout.type` for `sprout.kind` and ADDS `JSON.stringify(sprout.about ?? sprout.parents ?? [])`; `heroForm` admits `"kind"` instead of `"type"`; `railForm` becomes `error && (form === "delete" || form === "about") ? form : undefined`; the rail gains, between Source and Media:

```tsx
    {
      id: "about",
      label: "About",
      heading: "About",
      icon: Route,
      panel: (
        <SproutAboutForm
          sprout={sprout}
          garden={{ plants: raw.plants, pods: raw.pods, beans: raw.beans }}
          lang={lang}
          {...(railForm === "about" ? { error } : {})}
        />
      ),
    },
```

and `SproutDeleteForm` gets `error` only when `railForm === "delete"`. `openOnError={railForm}`. Lineage: `resolveLineage([...(sprout.about ?? []), ...(sprout.parents ?? [])], raw, …)` — a plant-level sprout then draws its plant, an about-sprout its bean, pod and plant. Update the page docblock ("state, date and kind as three icons"; the About panel).

- [ ] **Step 6: Run** `lib/sprout-hero-a11y.test.ts`, `lib/sprout-about-form.test.ts`, `lib/entity-rail-source.test.ts`, `npx tsc --noEmit`.

- [ ] **Step 7: Commit.**

---

### Task 9: Tables and the two beanstalks

**Files:**
- Modify: `app/admin/_components/sprout-table.tsx`, `app/admin/(chrome)/beanstalk/page.tsx`, `app/(public)/(chrome)/beanstalk/page.tsx`, `lib/beanstalk.test.ts`, `lib/sprouts.test.ts`, `lib/synthesis.test.ts` (fixtures only)

- [ ] **Step 1: `sprout-table.tsx`.** Add a `kind` column right after `state` drawing `<SproutKindGlyph kind={e.sprout.kind} />`; rename the `bean` column header to `about` and draw `(e.sprout.about ?? []).map((r) => r.slice(r.indexOf(":") + 1)).join(", ") || "—"` (the `showBean` flag keeps its name and meaning: the bean page passes false because every row there is about it). Update the docblock ("seven columns").

- [ ] **Step 2: Beanstalks.** Admin: `<span>{sproutKindLabel(e.entry.sprout.kind)}</span>`; public: `<Badge variant="secondary">{sproutKindLabel(e.entry.sprout.kind)}</Badge>` — `lib/glyphs.ts` is already imported by public code? Check: it is pure and icon-free, and `lib/server-safe-source.test.ts` does not list it; it imports only types from `./data`, so it is safe to import from the public page. ADD `lib/glyphs.ts` to `SERVER_SAFE` in `lib/server-safe-source.test.ts` the day the public zone starts importing it (that is this step).

- [ ] **Step 3: Sweep fixtures** in `lib/beanstalk.test.ts`, `lib/sprouts.test.ts`, `lib/synthesis.test.ts` (`type:` → `kind:` per table, `parents: ["bean:…"]` → `about:`; `WindowSprout.type` → `kind`). Run each.

- [ ] **Step 4: Run** `lib/admin-table-source.test.ts`, `lib/server-safe-source.test.ts`, `npx tsc --noEmit`. **Step 5: Commit.**

---

### Task 10: The synthesis door writes `kind` and `about`

**Files:**
- Modify: `lib/synthesis.ts`, `lib/synthesis-store.ts`, `lib/synthesis.test.ts`, `lib/synthesis-route.test.ts` (fixtures), `README.md` (§synthesis — the stored shape only; the WIRE keeps `parents`)

- [ ] **Step 1:** `lib/synthesis.ts`: `WindowSprout.kind: SproutKind` (done in Task 1 if not already), `DraftSprout.parents` stays — it is the wire contract the arkaik routine posts (`"parents must be exactly one bean ref"` unchanged). Update the docblock over `DraftSprout`: "`parents` on the WIRE; stored as `about` (spec 2026-10-10 §1.2)".

- [ ] **Step 2:** `lib/synthesis-store.ts`: `loadWeekMaterial` maps `kind: e.sprout.kind`; `upsertDigestDrafts` `$set` becomes `{ name, kind: DIGEST_KIND, date, about: d.parents, content, relations, description }` and `$unset: { state: "", type: "", parents: "" }` (a pre-migration draft re-posted after this deploy loses its legacy fields in the same write — say so in a comment).

- [ ] **Step 3:** Add a test in `lib/synthesis.test.ts` pinning `bucketWeek` skips `kind: "digest"` and keeps `kind: "log"`. Sweep fixtures. Run the synthesis tests.

- [ ] **Step 4: Commit.**

---

### Task 11: The graph

**Files:**
- Modify: `lib/graph.ts`, `lib/graph.test.ts`, `README.md` (§graph: `type` on a sprout node is its kind; a new `about` edge kind)

- [ ] **Step 1: Failing test** — in `lib/graph.test.ts` (sweep fixtures first):

```ts
test("a sprout's about refs become `about` edges from the pod or bean to the sprout; a plant-level sprout is contained by its plant", () => {
  const g = toGraph({
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p"] }],
    beans: [{ slug: "b", name: "B", parents: ["pod:pod"] }],
    sprouts: [
      { slug: "s", name: "S", kind: "essay", date: "2026-01-01", description: "", about: ["bean:b", "pod:pod", "bean:gone"] },
      { slug: "s-plant", name: "S", kind: "log", date: "2026-01-02", description: "", parents: ["plant:p"] },
    ],
  });
  const edges = g.edges.filter((e) => e.target.startsWith("sprout:"));
  assert.deepEqual(edges, [
    { source: "bean:b", target: "sprout:s", kind: "about" },
    { source: "pod:pod", target: "sprout:s", kind: "about" },
    { source: "plant:p", target: "sprout:s-plant", kind: "contains" },
  ]);
  assert.equal(g.nodes.find((n) => n.id === "sprout:s")!.type, "essay");
});
```

- [ ] **Step 2: Implement.** Node: `type: v.kind`. `sproutsByBean` (for covers) indexes by `about` bean refs (use `aboutRefs` from `lib/data.ts`). Replace the bean→sprout containment loop with: for each sprout, for each `about` ref in order — `bean:` whose slug exists → `addEdge(ref, SPROUT_PREFIX + slug, "about")`, `pod:` likewise; then for each `plant:` in `parents` (only read when `about` is empty, matching the derivation) → `addEdge(PLANT_PREFIX + slug, SPROUT_PREFIX + sprout.slug, "contains")`. Update the module docblock's edge list and `GraphNode.type`'s comment ("sprouts (sprout.kind) and bees (bee.kind)").

- [ ] **Step 3: Run** `lib/graph.test.ts`. **Step 4: Commit.**

---

### Task 12: The garden manifest, the applier, the plugin

**Files:**
- Modify: `lib/garden-manifest.ts`, `lib/garden-manifest.test.ts`, `lib/plant-garden-apply.ts`, `lib/plant-garden.test.ts`, `lib/garden-plan.test.ts` (fixtures), `plugins/garden-plant/skills/garden-plant/SKILL.md`

- [ ] **Step 1: Failing tests** in `lib/garden-manifest.test.ts`:

```ts
test("a sprout's kind is a member of the vocabulary", () => {
  const r = parseManifest(withSprout({ slug: "s", name: "S", kind: "essay", date: "2026-01-01", description: "" }));
  assert.ok(r.ok);
  assert.equal(r.manifest.pod.beans[0].sprouts[0].kind, "essay");
  const bad = parseManifest(withSprout({ slug: "s", name: "S", kind: "note", date: "2026-01-01", description: "" }));
  assert.ok(!bad.ok);
  assert.match(bad.error, /kind must be one of log, milestone, release, essay, decision, digest \(got "note"\)/);
});

test("the old `type` key is refused BY NAME, naming `kind`", () => {
  const r = parseManifest(withSprout({ slug: "s", name: "S", type: "note", date: "2026-01-01", description: "" }));
  assert.ok(!r.ok);
  assert.match(r.error, /sprouts\[0\]\.type is not a key any more — a sprout's kind is `kind:`/);
});
```

(Use whatever helper the file already has to wrap one sprout in a valid manifest; `withSprout` is a placeholder name for it — read the file.)

- [ ] **Step 2: Implement.** `ManifestSprout.type` → `kind: SproutKind`; in `buildSprout`: refuse `"type" in raw` first with the message above, then `const kind = str(raw.kind); if (!isSproutKind(kind)) return { ok: false, error: \`${where}.kind must be one of ${SPROUT_KINDS.join(", ")} (got "${kind}")\` };`. `lib/plant-garden-apply.ts` sprout create: `kind: sprout.kind, about: [\`bean:${action.parentSlug}\`]` and NO `parents`. In `lib/plant-garden.test.ts`, assert a planted sprout has `about` and no `parents`. Sweep `lib/garden-plan.test.ts`.

- [ ] **Step 3: SKILL.md** — every `type:` in a sprout example becomes `kind:`; add the six-member table with one line each; say the plant is derived (a sprout under a bean is about that bean). `plugins/garden-plant/` README if there is one.

- [ ] **Step 4: Run** the three test files and `npm run test:db` (the plant-garden file is in it). **Step 5: Commit.**

---

### Task 13: Legacy fixtures — `pbbls-legacy`, `data/garden.yml`, the spent script

**Files:**
- Modify: `lib/pbbls-legacy.ts`, `lib/pbbls-legacy.test.ts`, `data/garden.yml`, `lib/data.test.ts` ("garden.yml parses…"), `package.json`
- Delete: `scripts/migrate-pbbls-legacy.ts`

- [ ] **Step 1:** `lib/pbbls-legacy.ts`: `MILESTONE_TYPE` → `MILESTONE_KIND = "milestone" as const`; `retireLegacyBeans` re-anchors with `about = [\`bean:${target}\`]`, compares `s.kind === MILESTONE_KIND && JSON.stringify(s.about) === JSON.stringify(about)`, and returns `{ ...rest, about, kind: MILESTONE_KIND }` where `rest` is the sprout WITHOUT `parents` (destructure it off). Update its docblock.

- [ ] **Step 2: Convert `data/garden.yml`** — 39 sprouts, all `type: song | feature | episode | milestone` → `kind: milestone`, `parents: [bean:x]` → `about: [bean:x]`. Do it with a throwaway script in the scratchpad (NOT committed) that loads with `yaml.load(file, { schema: yaml.CORE_SCHEMA })`, maps, and `yaml.dump`s — then DIFF it against the original and hand-fix formatting so the diff is only the two fields per sprout (the file is hand-edited; `lib/pbbls-legacy.test.ts` says so). Alternatively `sed` the four `type:` values and the `parents:` key inside the `sprouts:` block only. Verify: `grep -c 'kind: milestone' data/garden.yml` → 39; `grep -n 'type:\|parents:' data/garden.yml` inside the sprouts block → none.

- [ ] **Step 3:** Delete `scripts/migrate-pbbls-legacy.ts` and the `"migrate:pbbls-legacy"` script in `package.json` — the migration it performed ran in September and cannot be expressed against the new shape; `lib/pbbls-legacy.ts` keeps the catalog the yml fixed-point test needs. Say this in the commit message.

- [ ] **Step 4:** Update the "garden.yml parses into a garden with only botanical prefixes" test and `lib/pbbls-legacy.test.ts` for the new keys. Run both and `lib/data.test.ts`.

- [ ] **Step 5: Commit.**

---

### Task 14: The migration — phase two, re-anchor

**Files:**
- Modify: `lib/journal-migration.ts`, `lib/journal-migration.test.ts`, `scripts/migrate-journal.ts`, `.gitignore` (already covers `data/retired/2026-10-10-*.json`)

- [ ] **Step 1: Failing tests** — append to `lib/journal-migration.test.ts`:

```ts
import { planReanchor, type LegacySprout } from "./journal-migration";

const garden = {
  plants: [{ slug: "p", name: "P", natures: ["work"] as ["work"], role: { kind: "owner" as const }, description: "" }],
  pods: [
    { slug: "pod", name: "Pod", description: "", parents: ["plant:p"] },
    { slug: "krabs", name: "Krabs", description: "", parents: [] },
  ],
  beans: [
    { slug: "b", name: "B", parents: ["pod:pod"] },
    { slug: "kb", name: "KB", parents: ["pod:krabs"] },
  ],
};
const legacy = (over: Partial<LegacySprout>): LegacySprout => ({
  slug: "s", name: "S", date: "2026-01-01", description: "", type: "note", parents: ["bean:b"], ...over,
});

test("planReanchor maps type to kind by the table and parents to about", () => {
  const plan = planReanchor([legacy({ type: "note" }), legacy({ slug: "m", type: "song" }), legacy({ slug: "d", type: "digest" })], garden);
  assert.deepEqual(plan.refusals, []);
  assert.deepEqual(plan.moves, [
    { slug: "s", type: "note", kind: "log", about: ["bean:b"] },
    { slug: "m", type: "song", kind: "milestone", about: ["bean:b"] },
    { slug: "d", type: "digest", kind: "digest", about: ["bean:b"] },
  ]);
});

test("a sprout already carrying kind and no type is skipped (idempotent)", () => {
  const plan = planReanchor([legacy({ type: undefined, kind: "log", parents: undefined, about: ["bean:b"] })], garden);
  assert.deepEqual(plan, { moves: [], refusals: [] });
});

test("refusals: unknown type, article, no bean parent, dangling bean, unrooted plant", () => {
  const plan = planReanchor(
    [
      legacy({ slug: "bla", type: "bla" }),
      legacy({ slug: "art", type: "article" }),
      legacy({ slug: "none", parents: [] }),
      legacy({ slug: "dangling", parents: ["bean:nope"] }),
      legacy({ slug: "krabs-1", parents: ["bean:kb"] }),
    ],
    garden,
  );
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.refusals, [
    'bla: type "bla" has no kind — retype or delete it in the admin',
    "art: an article folds, it does not re-anchor — run the fold first",
    "none: no bean: parent to derive a plant from — re-anchor it by hand",
    "dangling: bean nope not found — re-anchor it by hand",
    "krabs-1: rolls up to no plant (bean kb) — root the pod under a plant in the admin first",
  ]);
});

test("a sprout with two bean parents under one plant keeps both as about; under two plants it is refused", () => {
  const twoPlants = { ...garden, plants: [...garden.plants, { ...garden.plants[0], slug: "p2" }], pods: [...garden.pods, { slug: "pod2", name: "P2", description: "", parents: ["plant:p2"] }], beans: [...garden.beans, { slug: "b2", name: "B2", parents: ["pod:pod2"] }] };
  assert.deepEqual(planReanchor([legacy({ parents: ["bean:b", "bean:b"] })], twoPlants).moves[0].about, ["bean:b"]);
  assert.deepEqual(planReanchor([legacy({ parents: ["bean:b", "bean:b2"] })], twoPlants).refusals, [
    "s: rolls up to two plants (p, p2) — a sprout belongs to one; split it in the admin",
  ]);
});
```

- [ ] **Step 2: Implement in `lib/journal-migration.ts`.** Add:

```ts
import { resolveSproutPlants, type SproutGarden } from "./data";
import type { SproutKind } from "./sprout-kind";

/** A stored sprout as the migration finds it — the pre-journal shape (`type`,
 *  `parents: ["bean:…"]`) and the post-journal one (`kind`, `about`) both
 *  admitted, because the script reads documents, not the TypeScript model. */
export interface LegacySprout {
  slug: string;
  name: Text;
  date: string;
  description: Text;
  type?: string;
  kind?: SproutKind;
  parents?: string[];
  about?: string[];
  state?: string;
  content?: Text;
  media?: unknown[];
  relations?: Relation[];
}

export const KIND_FOR_TYPE: Record<string, SproutKind> = {
  note: "log",
  milestone: "milestone",
  feature: "milestone",
  song: "milestone",
  episode: "milestone",
  release: "release",
  essay: "essay",
  decision: "decision",
  digest: "digest",
};

export interface Reanchor { slug: string; type: string; kind: SproutKind; about: string[] }
export interface ReanchorPlan { moves: Reanchor[]; refusals: string[] }

/**
 * Spec §4 steps 1 and 3 as a PURE plan. Step 4 (the `bla` test sprout) is an
 * operator act: it arrives here as an unknown type and is refused with the
 * remedy, rather than this module knowing one junk value by name.
 */
export function planReanchor(sprouts: LegacySprout[], garden: SproutGarden): ReanchorPlan {
  const moves: Reanchor[] = [];
  const refusals: string[] = [];
  const beanSlugs = new Set((garden.beans ?? []).map((b) => b.slug));
  for (const s of sprouts) {
    if (s.type === undefined && s.kind !== undefined) continue; // already re-anchored
    const type = s.type ?? "";
    if (type === ARTICLE_TYPE) { refusals.push(`${s.slug}: an article folds, it does not re-anchor — run the fold first`); continue; }
    const kind = KIND_FOR_TYPE[type];
    if (!kind) { refusals.push(`${s.slug}: type "${type}" has no kind — retype or delete it in the admin`); continue; }
    const beans = [...new Set(parentsWithPrefix(s.parents, BEAN_PREFIX))];
    if (beans.length === 0) { refusals.push(`${s.slug}: no bean: parent to derive a plant from — re-anchor it by hand`); continue; }
    const missing = beans.find((b) => !beanSlugs.has(b));
    if (missing) { refusals.push(`${s.slug}: bean ${missing} not found — re-anchor it by hand`); continue; }
    const about = beans.map((b) => `${BEAN_PREFIX}${b}`);
    const plants = resolveSproutPlants({ about }, garden).map((p) => p.slug);
    if (plants.length === 0) { refusals.push(`${s.slug}: rolls up to no plant (bean ${beans.join(", ")}) — root the pod under a plant in the admin first`); continue; }
    if (plants.length > 1) { refusals.push(`${s.slug}: rolls up to two plants (${plants.join(", ")}) — a sprout belongs to one; split it in the admin`); continue; }
    moves.push({ slug: s.slug, type, kind, about });
  }
  return { moves, refusals };
}
```

Retype `planArticleFold(beans, sprouts: LegacySprout[])` (it reads `s.type`, `s.parents`, `s.content`, `s.media`, `s.relations` — all on `LegacySprout`). Keep `ARTICLE_TYPE`.

- [ ] **Step 3: The script.** `scripts/migrate-journal.ts` reads ALL sprouts (not only articles) and plants/pods as well; phase one is the fold as today; phase two is `planReanchor(sprouts.filter((s) => !foldedSlugs.has(s.slug)), { plants, pods, beans })`. Print both plans, refuse to write while EITHER has refusals (exit 2), apply phase one then phase two. Phase two's backup: `data/retired/2026-10-10-journal-reanchor.json` holding `{ slug, type, parents }` for every move (the pre-image of exactly the fields unset), same exists-check. Each move:

```ts
const r = await sproutsCol.updateOne(
  { slug: m.slug, type: m.type, kind: { $exists: false } },
  { $set: { kind: m.kind, about: m.about }, $unset: { type: "", parents: "" } },
);
if (r.matchedCount !== 1) throw new Error(`sprout ${m.slug} changed under us — stopping`);
```

Header comment: the operator sequence (dry, read, `--apply`, dry again expecting `0 fold(s)` and `0 move(s)`, then an admin save to invalidate the cache — the re-anchor changes PUBLIC data, exactly as the fold does). Idempotency: a second run plans nothing. A crash between two moves leaves the first ones done and the rest planned on the next run — safe, because every move is independent. Phase two's summary line: `N move(s), M refusal(s), K sprout(s) read`.

- [ ] **Step 4: Run** `lib/journal-migration.test.ts`; `npx tsc --noEmit` is now expected CLEAN. Run `npm run migrate:journal` from the worktree (dry; `.env.local` points at production — it is a read) and paste the summary lines into your report. Do NOT pass `--apply`.

- [ ] **Step 5: Commit.**

---

### Task 15: Docs, the sweep, the gates

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/TAXONOMY.md`, `docs/superpowers/specs/2026-10-10-journal-model-design.md`

- [ ] **Step 1: The sweep.** `grep -rn --include='*.ts' --include='*.tsx' -E '\btype: "(note|song|feature|episode|milestone|article|digest|release|essay|decision|bla)"' lib app components scripts` must list NOTHING outside `lib/journal-migration.test.ts` and the fold's own fixtures; `grep -rn 'parents: \["bean:' lib app components scripts` likewise. `grep -rn 'sprout-type\|isSproutType\|DIGEST_TYPE\|unpublishCascade\|setPrivate\|updateSproutType\|setSproutTypeAction' lib app components scripts plugins docs CLAUDE.md README.md` — fix every live reference (docs: rewrite the sentence; code: it should already be gone).

- [ ] **Step 2: CLAUDE.md.** First paragraph: "`Pod → Bean → Sprout`" → "`Plant → Pod → Bean`, with `Sprout` journal entries about them". In "No enum writes on the click that opens it": a sprout's `kind` is the FIFTH enum (list it; `lib/sprout-kind.ts`); the sentence "A sprout's `date` and `type` open the same way but are not enums" becomes about `date` alone; the `lib/sprout-type.ts` argument paragraph (the `"digest "` story) is rewritten in one sentence: the free string is gone, the vocabulary is closed, and `shouldCascadePublish` keys on a member — keep the `bean-tags` paragraph, which still refers to `lib/sprout-type.ts` as its sibling (now `lib/sprout-date.ts`). "The sprout's `state` earns the rule hardest — publishing cascades upward through its bean, pod and plant" → "publishing makes its plant public"; the bean-visibility bullet's "going public must not republish sprouts" stays true. The garden rule paragraph naming `setSproutStateAction`'s cascade re-read stays. In "Planting a project": "A manifest cannot publish" bullet — the sprout `state` sentence stays; add one line under it: a sprout's `kind` is a member of `lib/sprout-kind.ts` and `type` is refused by name. Add a short new bullet to "Rules the tests pin": **A sprout's plant is derived.** `resolveSproutPlant` is the one derivation; `filterPublic`, `buildDataset`, `publishCascade` and `resolveAnchor` call it; a sprout carries `about` OR a `plant:` parent, never both (`updateSproutAnchor`); there is no unpublish cascade. Name `lib/data.test.ts`, `lib/visibility.test.ts`, `lib/sprout-anchor.test.ts`.

- [ ] **Step 3: README.md** lines ~29 (Sprout definition), ~340 (triage: kind radios), ~371 (sprout page: kind, About panel; no unpublish cascade; delete changes no visibility), ~390 (graph `type` = kind; `about` edges). **docs/TAXONOMY.md** §Sprout table (`kind`, `about`, `parents`; drop `[key: string]`), the `type` paragraph, §485 synthesis row ("`kind: digest`"). **The spec**: §4 — step 4 becomes an operator act ("delete `Tentative` in the admin before running; the script refuses an unknown type by name"), and the script is one with two phases; §3 admin — the about panel is on the entity rail. Append a "Part B" note: public surfaces are the next plan.

- [ ] **Step 4: Gates** — `npx tsc --noEmit`, `npx eslint .`, `npm test`, `npm run test:db`. All green. Paste the summary lines.

- [ ] **Step 5: Commit.**

---

## Self-review (done while writing)

- Spec coverage, part A: §1.2 (kind, about, derived plant, exactly-one-of) — Tasks 1, 2, 5, 6; §2 (plant-only publish, cascade deleted, filterPublic scrub/drop) — Tasks 3, 4; §3 admin (kind popover as radios, about panel on the rail, create-sprout anchor, tables) — Tasks 7, 8, 9; §3 doors (synthesis kind, manifest kind) — Tasks 10, 12; §4 steps 1, 3 — Task 14; step 4 reinterpreted as an operator act (spec amended in Task 15); §6 bullets 1–5 and 7 — Tasks 6, 2, 3, 4, 1/7, 14. §6 bullet 6 (`/sprout/[slug]` in SERVER_SAFE) and bullet 8 (manifest sprouts nested under a bean refused) are part B / slice four. The public bean page keeps rendering through `narrativeFor` + `sproutsForBean` (now by `about`); both beanstalks keep rendering with `kind`.
- Names used consistently: `SproutKind`, `SPROUT_KINDS`, `DEFAULT_KIND`, `DIGEST_KIND`, `isSproutKind`, `kindForSuggestion`, `sproutKindLabel`, `SPROUT_KIND_ICONS`, `SproutKindGlyph`, `SproutGarden`, `aboutRefs`, `resolveSproutPlants`, `resolveSproutPlant`, `sproutsForPod`, `sproutsForPlant`, `publishCascade → { plantSlugs }`, `setPublic(plantSlugs)`, `SproutAnchor`, `resolveAnchor`, `updateSproutKind`, `updateSproutAnchor`, `setSproutKindAction`, `setSproutAboutAction`, `SproutAboutForm`, `LegacySprout`, `KIND_FOR_TYPE`, `planReanchor`.
