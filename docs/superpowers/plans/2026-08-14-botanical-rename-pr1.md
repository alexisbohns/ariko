# Botanical Rename (Slice 1, PR1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename ariko's content model to the botanical vocabulary — Molecule→Pod, Atom→Bean, Version→Sprout, Capture→Seed — across types, prefixes, routes, Mongo collections, and the seed file, with **zero behavior change**.

**Architecture:** Strangler rename inside one PR: Task 1 introduces the new names in `lib/data.ts` with temporary deprecated aliases so every commit compiles and tests stay green; Tasks 2–7 migrate module clusters; Task 8 deletes the aliases and greps the repo clean. Tasks 9–10 move the data (garden.yml + Mongo migration). The `Domain` type, `beanstalk` DB name, `beanstalk_admin` cookie, and the external Lab-Note YAML contract (`suggested.molecule`) are **deliberately untouched** — Domain retires in PR2; the wire alias `moleculeSlug`→`podSlug` at the inbox boundary is the only alias that survives this PR.

**Tech Stack:** Next.js 15 App Router, TypeScript 5.7, MongoDB driver, js-yaml, `node --test` + tsx.

**Spec:** `docs/superpowers/specs/2026-08-14-botanical-rename-practice-graph-design.md`

**Verification commands used throughout** (run from repo root):
- Typecheck: `npx tsc --noEmit`
- Tests: `npm test`
- Both must pass at every commit.

---

### Task 0: Branch

**Files:** none

- [ ] **Step 1: Create the working branch off main**

```bash
git checkout main && git pull && git checkout -b rename/botanical
```

- [ ] **Step 2: Verify baseline is green**

Run: `npx tsc --noEmit && npm test`
Expected: exit 0, all tests pass. If not, STOP and report — the baseline must be green before renaming.

---

### Task 1: Core rename in `lib/data.ts` (with temporary aliases)

**Files:**
- Modify: `lib/data.ts`
- Modify: `lib/data.test.ts`

- [ ] **Step 1: Apply the identifier rename map inside `lib/data.ts`**

Rename map (whole-word, case-sensitive; applies to types, constants, functions, parameters, comments):

| Old | New |
|---|---|
| `Molecule` | `Pod` |
| `Atom` | `Bean` |
| `Version` (the interface + `version` locals) | `Sprout` / `sprout` |
| `Capture` / `CaptureStatus` / `CaptureSuggestion` | `Seed` / `SeedStatus` / `SeedSuggestion` |
| `MOLECULE_PREFIX` = `"molecule:"` | `POD_PREFIX` = `"pod:"` |
| `ATOM_PREFIX` = `"atom:"` | `BEAN_PREFIX` = `"bean:"` |
| `VERSION_PREFIX` = `"version:"` | `SPROUT_PREFIX` = `"sprout:"` |
| `RawSeed` fields `molecules`/`atoms`/`versions` | `pods` / `beans` / `sprouts` |
| `RawSeed` | `RawGarden` |
| `VersionState` | `SproutState` |
| `TimelineEntry` fields `version`/`atom` | `sprout` / `bean` |
| Dataset methods `getMolecules`/`atomsForMolecule`/`standaloneAtoms`/`getAtom`/`versionsForAtom`/`domainForAtom` | `getPods` / `beansForPod` / `standaloneBeans` / `getBean` / `sproutsForBean` / `domainForBean` |
| `moleculeSlug(s)` / `atomSlug(s)` locals & cascade return keys | `podSlug(s)` / `beanSlug(s)` |
| `unpublishCascadeForAtoms` | `unpublishCascadeForBeans` |

Do NOT rename: `Domain`, `Visibility`, `Text`/`LocalizedText`, `Media*`, `Source`, `Relation`, `Dataset`, `filterPublic`, `publishCascade`, `unpublishCascade`, `resolveText`/`textPart`/`composeText`, `buildDataset`, `getDataset`. `SeedSuggestion` fields become `podSlug?` / `beanSlug?` (were `moleculeSlug?` / `atomSlug?`). `Seed` (ex-Capture) keeps `promotedTo: string[]` (sprout slugs, unprefixed — comment updates only).

`getDataset()` still reads `data/seed.yml` for now (file moves in Task 9).

- [ ] **Step 2: Add the temporary alias block at the END of `lib/data.ts`**

```ts
// ── TEMPORARY rename scaffolding — DELETED in the last task of this PR. ──
// Lets un-migrated modules compile while clusters rename one commit at a time.
/** @deprecated use Pod */ export type Molecule = Pod;
/** @deprecated use Bean */ export type Atom = Bean;
/** @deprecated use Sprout */ export type Version = Sprout;
/** @deprecated use Seed */ export type Capture = Seed;
/** @deprecated use SeedStatus */ export type CaptureStatus = SeedStatus;
/** @deprecated use SeedSuggestion */ export type CaptureSuggestion = SeedSuggestion;
/** @deprecated use SproutState */ export type VersionState = SproutState;
/** @deprecated use RawGarden */ export type RawSeed = RawGarden;
/** @deprecated */ export const MOLECULE_PREFIX = POD_PREFIX;
/** @deprecated */ export const ATOM_PREFIX = BEAN_PREFIX;
/** @deprecated */ export const VERSION_PREFIX = SPROUT_PREFIX;
```

CAREFUL: aliasing types is enough for most importers, but `RawSeed.molecules` field accesses in un-migrated modules WILL break because the fields renamed. That is intended — Task 1 must also mechanically update **field/method call sites in every importer** just enough to compile, WITHOUT renaming those modules' own identifiers yet (those come in their cluster tasks). Concretely: in `lib/store.ts`, `lib/atomic.ts`, `lib/vault.ts`, `lib/graph.ts`, `lib/captures.ts`, `lib/inbox.ts`, `lib/capture-form.ts`, `lib/promote.ts`, `lib/atom-detail.ts`, `lib/version-edit.ts`, `app/**` pages/actions, `scripts/migrate-seed.ts` — fix only: `raw.molecules`→`raw.pods`, `raw.atoms`→`raw.beans`, `raw.versions`→`raw.sprouts`, Dataset method calls per the map above, cascade return keys `{ moleculeSlugs, atomSlugs }`→`{ podSlugs, beanSlugs }`, `suggested.moleculeSlug`→`suggested.podSlug`, `suggested.atomSlug`→`suggested.beanSlug`, `TimelineEntry` `.version`→`.sprout` / `.atom`→`.bean`. Let `npx tsc --noEmit` be the checklist: fix errors until zero.

**Prefix data note:** `POD_PREFIX` now emits `"pod:"` but the DB/seed still contain `"molecule:"` refs until Tasks 9–10. Tests use in-memory fixtures so they stay green; the dev server would show orphaned parents until the data tasks land — acceptable inside the PR, called out in the PR description.

- [ ] **Step 3: Update `lib/data.test.ts` fixtures and assertions to the new names** (same map; fixture refs become `pod:`/`bean:`/`sprout:`).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: exit 0, same test count as baseline, all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "rename: Pod/Bean/Sprout/Seed core model with temporary aliases"
```

---

### Task 2: Cluster — store, atomic→botanical, vault

**Files:**
- Rename: `lib/atomic.ts` → `lib/botanical.ts`; `lib/atomic.test.ts` → `lib/botanical.test.ts`
- Modify: `lib/store.ts`, `lib/store.test.ts`, `lib/vault.ts`, `lib/vault.test.ts`, `scripts/apply-validators.ts` (import path only), `app/admin/actions.ts` + any page importing `lib/atomic`

- [ ] **Step 1: `git mv lib/atomic.ts lib/botanical.ts && git mv lib/atomic.test.ts lib/botanical.test.ts`; fix importers' paths.**

- [ ] **Step 2: Apply the Task-1 rename map to identifiers inside all four modules** — including `ensureAtomicIndexes`→`ensureBotanicalIndexes`, `CreateAtomInput`/`CreateMoleculeInput`→`CreateBeanInput`/`CreatePodInput` (field `moleculeSlug`→`podSlug`), `SlugExistsError("molecule"…)`→`("pod"…)`, and the parent template `` `molecule:${…}` ``→`` `pod:${…}` ``. **Collection name strings (`"molecules"` etc.) stay OLD in this task** — they flip together in Task 10 with the Mongo migration.

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm test` → all green.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "rename: store/botanical/vault cluster"`

---

### Task 3: Cluster — seeds (captures), inbox with wire alias, promote, forms

**Files:**
- Rename: `lib/captures.ts`→`lib/seeds.ts` (+ test), `lib/capture-form.ts`→`lib/seed-form.ts` (+ test)
- Modify: `lib/inbox.ts`, `lib/inbox.test.ts`, `lib/inbox-route.test.ts`, `lib/promote.ts`, `lib/promote.test.ts`, `app/api/inbox/route.ts`, `app/admin/actions.ts`, `app/admin/page.tsx`, `app/admin/triage/[id]/page.tsx`

- [ ] **Step 1: Write the failing boundary-alias test in `lib/inbox.test.ts`**

```ts
test("inbox suggestion accepts legacy wire keys moleculeSlug/atomSlug as podSlug/beanSlug", () => {
  const legacy = parseInboxPayload({
    title: "t",
    source: { kind: "github", externalId: "o/r#1" },
    suggested: { moleculeSlug: "pbbls", atomSlug: "ios", type: "feature" },
  });
  assert.deepEqual(legacy.ok && legacy.value.suggested, {
    podSlug: "pbbls", beanSlug: "ios", type: "feature",
  });
  const canonical = parseInboxPayload({
    title: "t",
    source: { kind: "github", externalId: "o/r#2" },
    suggested: { podSlug: "pbbls" },
  });
  assert.deepEqual(canonical.ok && canonical.value.suggested, { podSlug: "pbbls" });
});
```

(Adapt the entry-point name to the actual exported parser in `lib/inbox.ts` — currently the validation function that returns the normalized payload around line 136.)

- [ ] **Step 2: Run it to make sure it fails** — `npm test` → the new test FAILS (legacy keys pass through unmapped).

- [ ] **Step 3: Implement the boundary normalizer in `lib/inbox.ts`**, replacing the bare `body.suggested` cast:

```ts
// Boundary alias — the ONLY place legacy vocabulary survives. Sibling repos'
// lab-note payloads send moleculeSlug/atomSlug; internally we speak pod/bean.
function normalizeSuggestion(s: unknown): SeedSuggestion | undefined {
  if (!isObject(s)) return undefined;
  const src = s as Record<string, unknown>;
  const out: SeedSuggestion = {};
  const pod = src.podSlug ?? src.moleculeSlug;
  const bean = src.beanSlug ?? src.atomSlug;
  if (typeof pod === "string" && pod) out.podSlug = pod;
  if (typeof bean === "string" && bean) out.beanSlug = bean;
  if (typeof src.type === "string" && src.type) out.type = src.type;
  if (Array.isArray(src.tags)) {
    const tags = src.tags.filter((t): t is string => typeof t === "string");
    if (tags.length) out.tags = tags;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
```

Use it where `suggested` was previously copied verbatim.

- [ ] **Step 4: Run tests** — `npm test` → new test PASSES, all others green.

- [ ] **Step 5: `git mv` the two file pairs; apply the rename map across the cluster** (`Capture`→`Seed` everywhere, `createOrUpdateCapture`→`createOrUpdateSeed`, `ensureCaptureIndexes`→`ensureSeedIndexes`, promote/triage/admin call sites). Collection string `"captures"` stays OLD until Task 10. `scripts/lab-note/lib.mjs` is NOT touched — it keeps emitting `moleculeSlug`, which the alias absorbs.

- [ ] **Step 6: Verify** — `npx tsc --noEmit && npm test` → green.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "rename: seeds/inbox cluster with legacy wire alias"`

---

### Task 4: Cluster — graph

**Files:** Modify: `lib/graph.ts`, `lib/graph.test.ts`, `app/api/graph/route.ts`

- [ ] **Step 1: Update `lib/graph.test.ts` expectations first**: node ids `pod:`/`bean:`/`sprout:`, `GraphNode.kind` values `"pod" | "bean" | "sprout"`. Run `npm test` → graph tests FAIL (old kinds).

- [ ] **Step 2: Apply the rename map to `lib/graph.ts`** — `GraphNode.kind` union becomes `"pod" | "bean" | "sprout"`; comments updated; edge logic unchanged. This is the accepted breaking change to `/api/graph` (spec §2).

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm test` → green.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "rename: graph projection speaks pod/bean/sprout"`

---

### Task 5: Cluster — detail/edit helpers + remaining lib

**Files:**
- Rename: `lib/atom-detail.ts`→`lib/bean-detail.ts` (+ test), `lib/version-edit.ts`→`lib/sprout-edit.ts` (+ test)
- Modify: `lib/visibility.test.ts`, `lib/embeds.ts` (comment-level only if it mentions versions)

- [ ] **Step 1: `git mv` both pairs; apply the rename map inside; fix importers (`app/atom/[id]/page.tsx`, `app/admin/**`).**
- [ ] **Step 2: Apply the map to `lib/visibility.test.ts` fixtures/assertions.**
- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm test` → green.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "rename: detail/edit helper cluster"`

---

### Task 6: Routes — directories and pages

**Files:**
- Rename: `app/atom/[id]/` → `app/bean/[id]/`; `app/admin/atom/[id]/` → `app/admin/bean/[id]/`; `app/admin/version/[slug]/` → `app/admin/sprout/[slug]/`
- Modify: every `<Link>`/`redirect()`/`revalidatePath` that names those paths (`app/page.tsx`, `app/timeline/page.tsx`, `app/admin/**`, `app/admin/actions.ts`)

- [ ] **Step 1: `git mv` the three route directories.**
- [ ] **Step 2: Grep-and-fix path literals**

Run: `grep -rn '"/atom\|/admin/atom\|/admin/version' app lib`
Fix every hit to `/bean`, `/admin/bean`, `/admin/sprout`. Re-run until zero hits.

- [ ] **Step 3: Apply the rename map to identifiers inside the moved pages.**
- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm test`, then `npm run build` → all green, build succeeds.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "rename: routes /bean and /admin/{bean,sprout}"`

---

### Task 7: Public redirect

**Files:** Modify: `next.config.ts`

- [ ] **Step 1: Add the permanent redirect for the only public renamed path**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => [
    { source: "/atom/:id", destination: "/bean/:id", permanent: true },
  ],
};

export default nextConfig;
```

(Admin paths get no redirects — private, no shared links.)

- [ ] **Step 2: Verify** — `npm run build` succeeds; `npm run dev` + `curl -sI localhost:3000/atom/x | head -3` shows `308` with `location: /bean/x`.
- [ ] **Step 3: Commit** — `git add next.config.ts && git commit -m "rename: 308 redirect /atom/:id -> /bean/:id"`

---

### Task 8: Delete the aliases; grep gate

**Files:** Modify: `lib/data.ts`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Delete the entire temporary alias block from `lib/data.ts`.**
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → zero errors (any error = a straggler; fix it with the rename map).
- [ ] **Step 3: Grep gate — no legacy vocabulary outside sanctioned locations**

Run:
```bash
grep -rniE '\b(molecule|atom|capture)\b' lib app scripts/*.ts next.config.ts middleware.ts \
  | grep -v 'moleculeSlug\|atomSlug'   # the two legacy wire keys in lib/inbox.ts only
```
Expected: hits ONLY in `lib/inbox.ts` (boundary alias + its comment) and `lib/inbox.test.ts`. `\bversion\b` is checked separately by eye (`grep -rniE '\bversion\b' lib app scripts/*.ts`) because package/tool "version" words are legitimate — every remaining hit must be non-model usage.

- [ ] **Step 4: Update docs** — `CLAUDE.md`: model line becomes `Pod → Bean → Sprout` (the Lab-Note YAML contract section keeps `suggested.molecule` — external contract, unchanged until slice 3). `README.md`: same vocabulary sweep, pipeline docs keep the YAML key.
- [ ] **Step 5: Verify** — `npx tsc --noEmit && npm test` → green.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "rename: drop scaffolding aliases; docs speak botanical"`

---

### Task 9: garden.yml — transform script + file move

**Files:**
- Create: `scripts/rename-garden.ts`
- Rename (output): `data/seed.yml` → `data/garden.yml`
- Modify: `lib/data.ts` (`getDataset` path), `scripts/migrate-seed.ts` → rename to `scripts/migrate-garden.ts`, `package.json` (script entry)

- [ ] **Step 1: Write the failing equivalence test** — append to `lib/data.test.ts`:

```ts
test("garden.yml parses into a dataset with only botanical prefixes", () => {
  const file = readFileSync(join(process.cwd(), "data", "garden.yml"), "utf8");
  const raw = yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawGarden;
  assert.ok((raw.pods ?? []).length > 0);
  const refs = [
    ...(raw.beans ?? []).flatMap((b) => b.parents ?? []),
    ...(raw.sprouts ?? []).flatMap((s) => [...(s.parents ?? []), ...(s.relations ?? []).map((r) => r.ref)]),
  ];
  for (const ref of refs) {
    assert.match(ref, /^(pod|bean|sprout):/, `legacy prefix survived: ${ref}`);
  }
});
```

Run `npm test` → FAILS (`data/garden.yml` missing).

- [ ] **Step 2: Write `scripts/rename-garden.ts`** — one-shot, parse/transform/dump:

```ts
// One-shot: data/seed.yml -> data/garden.yml with botanical keys and prefixes.
// Idempotent: running on an already-botanical file is a no-op rewrite.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const src = ["garden.yml", "seed.yml"].map((f) => join(process.cwd(), "data", f)).find(existsSync);
if (!src) throw new Error("no data/seed.yml or data/garden.yml found");
const raw = yaml.load(readFileSync(src, "utf8"), { schema: yaml.CORE_SCHEMA }) as Record<string, unknown[]>;

const ref = (r: string) =>
  r.replace(/^molecule:/, "pod:").replace(/^atom:/, "bean:").replace(/^version:/, "sprout:");
const mapParents = (x: any) => ({ ...x, ...(x.parents ? { parents: x.parents.map(ref) } : {}) });

const out = {
  pods: (raw.pods ?? raw.molecules ?? []),
  beans: (raw.beans ?? raw.atoms ?? []).map(mapParents),
  sprouts: (raw.sprouts ?? raw.versions ?? []).map((v: any) => ({
    ...mapParents(v),
    ...(v.relations ? { relations: v.relations.map((rel: any) => ({ ...rel, ref: ref(rel.ref) })) } : {}),
  })),
};

writeFileSync(join(process.cwd(), "data", "garden.yml"), yaml.dump(out, { lineWidth: 100 }), "utf8");
console.log(`garden.yml written: ${out.pods.length} pods, ${out.beans.length} beans, ${out.sprouts.length} sprouts`);
```

- [ ] **Step 3: Run it, delete the old file, point the reader at the new one**

```bash
npx tsx scripts/rename-garden.ts && git rm data/seed.yml
```
In `lib/data.ts` `getDataset()`: `join(process.cwd(), "data", "garden.yml")` (comment updated). `git diff --stat` the new file and eyeball a few entries against the old one (yaml.dump loses comments/ordering nuances — verify none existed or re-add them).

- [ ] **Step 4: Rename the baseline importer** — `git mv scripts/migrate-seed.ts scripts/migrate-garden.ts`; inside, read `data/garden.yml`, upsert into collections **`pods`/`beans`/`sprouts`** (new names — this script only runs against a migrated DB from now on), keep the `$setOnInsert` semantics. `package.json`: `"migrate": "node --env-file=.env.local --import tsx scripts/migrate-garden.ts"`.
- [ ] **Step 5: Verify** — `npm test` → equivalence test PASSES; whole suite green.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "rename: seed.yml becomes garden.yml with botanical prefixes"`

---

### Task 10: Mongo migration — collections, refs, validators

**Files:**
- Create: `scripts/migrate-botanical.ts`
- Modify: `lib/store.ts`, `lib/botanical.ts`, `lib/seeds.ts` (collection strings), `scripts/apply-validators.ts`, `package.json`

- [ ] **Step 1: Write `scripts/migrate-botanical.ts`** — idempotent, dry-run-able:

```ts
// One-shot production migration to botanical collections + prefixes.
// Usage: npm run migrate:botanical [-- --dry-run]
import { getDb, closeDb } from "../lib/db";

const DRY = process.argv.includes("--dry-run");
const RENAMES: [string, string][] = [
  ["molecules", "pods"], ["atoms", "beans"], ["versions", "sprouts"], ["captures", "seeds"],
];
const ref = (r: string) =>
  r.replace(/^molecule:/, "pod:").replace(/^atom:/, "bean:").replace(/^version:/, "sprout:");

async function main() {
  const db = await getDb();
  const names = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const [from, to] of RENAMES) {
    if (names.has(from) && !names.has(to)) {
      console.log(`${DRY ? "[dry] " : ""}rename ${from} -> ${to}`);
      if (!DRY) await db.renameCollection(from, to);
    } else {
      console.log(`skip ${from} -> ${to} (${names.has(to) ? "target exists" : "source absent"})`);
    }
  }
  // Rewrite prefixed refs inside docs (small data: loop is fine, idempotent).
  for (const coll of ["beans", "sprouts"]) {
    const docs = await db.collection(coll).find({}).toArray();
    for (const d of docs) {
      const update: Record<string, unknown> = {};
      if (Array.isArray(d.parents)) update.parents = d.parents.map(ref);
      if (Array.isArray(d.relations))
        update.relations = d.relations.map((rel: any) => ({ ...rel, ref: ref(rel.ref) }));
      const changed = JSON.stringify(update) !== JSON.stringify(
        Object.fromEntries(Object.keys(update).map((k) => [k, d[k]])),
      );
      if (Object.keys(update).length && changed) {
        console.log(`${DRY ? "[dry] " : ""}rewrite refs on ${coll}/${d.slug}`);
        if (!DRY) await db.collection(coll).updateOne({ _id: d._id }, { $set: update });
      }
    }
  }
  // Legacy suggestion keys on stored seeds.
  const seedFilter = {
    $or: [{ "suggested.moleculeSlug": { $exists: true } }, { "suggested.atomSlug": { $exists: true } }],
  };
  const n = await db.collection("seeds").countDocuments(seedFilter);
  console.log(`${DRY ? "[dry] " : ""}rename suggestion keys on ${n} seeds`);
  if (!DRY && n > 0)
    await db.collection("seeds").updateMany(seedFilter, {
      $rename: { "suggested.moleculeSlug": "suggested.podSlug", "suggested.atomSlug": "suggested.beanSlug" },
    });
  await closeDb();
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
```

`package.json`: add `"migrate:botanical": "node --env-file=.env.local --import tsx scripts/migrate-botanical.ts"`.

- [ ] **Step 2: Flip the collection strings in code** — `lib/store.ts`, `lib/botanical.ts` (`ensureBotanicalIndexes` included), `lib/seeds.ts`: `"molecules"`→`"pods"`, `"atoms"`→`"beans"`, `"versions"`→`"sprouts"`, `"captures"`→`"seeds"`. Update `scripts/apply-validators.ts` to apply the same four validators to the NEW collection names.
- [ ] **Step 3: Run against local dev DB** — `npm run migrate:botanical -- --dry-run` (review output), then `npm run migrate:botanical`, then `npm run validators`. Re-run `npm run migrate:botanical` → all lines say `skip`/no-op (idempotency proof).
- [ ] **Step 4: Verify app against migrated local DB** — `npx tsc --noEmit && npm test && npm run build`; `npm run dev` and eyeball `/`, `/timeline`, one `/bean/[id]`, `/admin` inbox.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "rename: botanical Mongo collections, ref rewrite, validators"`

---

### Task 11: PR

**Files:** none

- [ ] **Step 1: Final full gate** — `npx tsc --noEmit && npm test && npm run build` → all green.
- [ ] **Step 2: Push and open the PR** with a body that includes the deploy runbook and a Lab Note:

Runbook (in PR body): after merge+deploy, run `npm run migrate:botanical -- --dry-run` then `npm run migrate:botanical` then `npm run validators` against production (`.env` pointed at prod), immediately — old code reads old collections, new code reads new ones, so deploy and migration should happen together; brief inconsistency window accepted (personal site).

Lab Note (this is a visitor-noticeable change only via the `/atom/*`→`/bean/*` URL move; model rename is internal — per the gate, a small note is right):

```yaml
en:
  title: The vault went botanical
  summary: The portfolio's inner world is now a garden — pods, beans and sprouts instead of molecules, atoms and versions. Old links keep working.
fr:
  title: La voûte passe au botanique
  summary: Le monde intérieur du portfolio devient un jardin — gousses, haricots et pousses. Tes anciens liens fonctionnent toujours.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```

```bash
git push -u origin rename/botanical && gh pr create --title "Slice 1 PR1: botanical rename" --body-file <runbook+note file>
```

---

## Self-review notes (already applied)

- **Spec coverage:** §2 table → Tasks 1–10 (types T1, prefixes T1/T9/T10, collections T10, garden.yml T9, routes T6, redirects T7, DB/cookie untouched — no task, correct). §2 boundary alias → T3. §2 graph break → T4. §5 PR1 acceptance: suite green (every task), redirects (T7), both wire keys (T3), migration idempotent (T9 idempotent re-run guard in script, T10 Step 3 re-run proof). Docs → T8.
- **Deliberately absent:** `Domain` rename, plant/bee anything, lab-note lib.mjs changes — PR2/slice-3 scope.
- **Type consistency:** `SeedSuggestion.podSlug/beanSlug` used consistently in T1 map, T3 normalizer/test, T10 `$rename`. `RawGarden.pods/beans/sprouts` consistent across T1, T9 script/test, T10.
