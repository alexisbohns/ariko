# Garden Plant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent in a sibling repo describe a pod, its beans and their opening sprouts in a `garden.yml`, and let Ariko plant that file into Mongo with one reviewed command.

**Architecture:** Three pure modules and one thin script. `lib/garden-manifest.ts` parses and validates YAML into a typed manifest (no DB, no I/O). `lib/garden-plan.ts` diffs that manifest against the garden's existing slugs and returns a list of actions. `scripts/plant-garden.ts` is I/O only: read file, validate, load garden, plan, print, apply. Every write goes through `createPod` / `createBean` / `createSprout` / `updatePodContent` / `updateSproutContent` in `lib/botanical.ts`, so the unique slug index, the prefixed-ref grammar and private-at-birth are inherited rather than restated. A `plugins/garden-plant/` skill teaches sibling agents to author the file and stop there.

**Tech Stack:** TypeScript, `js-yaml` (already a dependency), `node --import tsx`, `node --test`, MongoDB driver via `lib/db.ts`.

**Spec:** `docs/superpowers/specs/2026-09-13-garden-plant-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/garden-manifest.ts` | **Create.** Manifest types + `parseManifest(yamlText)` → ok/error. Pure; no DB. |
| `lib/garden-manifest.test.ts` | **Create.** Validation cases. Runs under `npm test` (no DB). |
| `lib/garden-plan.ts` | **Create.** `planGarden(manifest, garden, { update })` → typed actions. Pure. |
| `lib/garden-plan.test.ts` | **Create.** Diff cases against fixture gardens. Runs under `npm test`. |
| `scripts/plant-garden.ts` | **Create.** CLI: args, file read, orchestration, printing, writes. |
| `lib/plant-garden.test.ts` | **Create.** End-to-end against a scratch DB. Runs under `npm run test:db`. |
| `package.json` | **Modify.** Add `garden:plant` script; add the new DB test to `test:db`. |
| `plugins/garden-plant/.claude-plugin/plugin.json` | **Create.** Plugin manifest, mirroring `plugins/lab-note/`. |
| `plugins/garden-plant/skills/garden-plant/SKILL.md` | **Create.** The skill sibling agents install. |
| `.claude-plugin/marketplace.json` | **Modify.** List the second plugin. |
| `CLAUDE.md` | **Modify.** Always-loaded summary of the planting door. |

Two pure modules rather than one because they fail for different reasons and are read at different times: a manifest is wrong because the *author* made a mistake, a plan is surprising because the *garden* already contains something. Keeping them apart means the diff logic is testable without a YAML string and the validator is testable without a garden.

---

### Task 1: Manifest types and parsing

**Files:**
- Create: `lib/garden-manifest.ts`
- Create: `lib/garden-manifest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/garden-manifest.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./garden-manifest";

const MINIMAL = `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans: []
`;

test("parses a minimal pod-only manifest", () => {
  const result = parseManifest(MINIMAL);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.pod.slug, "krabs");
  assert.equal(result.manifest.pod.plant, null);
  assert.deepEqual(result.manifest.pod.name, "Krabs");
  assert.deepEqual(result.manifest.beans, []);
});

test("a bilingual pair composes to an {en, fr} Text", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs, fr: Krabs }
  plant: null
  description: { en: A small ledger., fr: Un petit registre. }
beans: []
`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.pod.description, {
    en: "A small ledger.",
    fr: "Un petit registre.",
  });
});

test("rejects invalid YAML with a readable error", () => {
  const result = parseManifest("pod: [unclosed");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /YAML/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test lib/garden-manifest.test.ts`
Expected: FAIL — `Cannot find module './garden-manifest'`.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/garden-manifest.ts`:

```ts
/**
 * The manifest a sibling repo writes, parsed and checked as a WHOLE before
 * anything is written.
 *
 * Pure on purpose: no `getDb`, no `node:fs`, no argv. What is wrong here is
 * wrong about the AUTHOR's file, and can be reported without a database
 * existing. `lib/garden-plan.ts` is the other half — what is surprising about
 * the GARDEN.
 */
import { composeText, type Text } from "./data";

export interface ManifestSprout {
  slug: string;
  type: string;
  date: string;
  name: Text;
  description: Text;
  content?: Text;
}

export interface ManifestBean {
  slug: string;
  name: Text;
  description: Text;
  sprouts: ManifestSprout[];
}

export interface ManifestPod {
  slug: string;
  name: Text;
  plant: string | null;
  description: Text;
  content?: Text;
}

export interface GardenManifest {
  pod: ManifestPod;
  beans: ManifestBean[];
}

export type ParseResult =
  | { ok: true; manifest: GardenManifest }
  | { ok: false; error: string };

/** A `{ en, fr }` pair from the file, composed into the garden's `Text`. */
function readText(value: unknown, where: string): Text | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return `${where} must be a mapping with an "en" key`;
  }
  const pair = value as Record<string, unknown>;
  const en = typeof pair.en === "string" ? pair.en : "";
  const fr = typeof pair.fr === "string" ? pair.fr : "";
  if (!en.trim()) return `${where}.en is required and must be non-blank`;
  return composeText(en, fr);
}

export function parseManifest(yamlText: string): ParseResult {
  let doc: unknown;
  try {
    // Lazy require keeps this module importable from a test that never parses.
    doc = (require("js-yaml") as typeof import("js-yaml")).load(yamlText);
  } catch (err) {
    return { ok: false, error: `YAML parse failed: ${(err as Error).message}` };
  }
  return buildManifest(doc);
}

function buildManifest(doc: unknown): ParseResult {
  if (typeof doc !== "object" || doc === null) {
    return { ok: false, error: "manifest must be a mapping with pod: and beans:" };
  }
  const root = doc as Record<string, unknown>;

  const podRaw = root.pod;
  if (typeof podRaw !== "object" || podRaw === null) {
    return { ok: false, error: "pod: is required" };
  }
  const p = podRaw as Record<string, unknown>;

  const podName = readText(p.name, "pod.name");
  if (typeof podName === "string") return { ok: false, error: podName };
  const podDescription = readText(p.description, "pod.description");
  if (typeof podDescription === "string") return { ok: false, error: podDescription };

  const pod: ManifestPod = {
    slug: typeof p.slug === "string" ? p.slug : "",
    name: podName,
    plant: typeof p.plant === "string" && p.plant.trim() ? p.plant.trim() : null,
    description: podDescription,
  };
  if (p.content !== undefined) {
    const content = readText(p.content, "pod.content");
    if (typeof content === "string") return { ok: false, error: content };
    pod.content = content;
  }

  const beansRaw = root.beans ?? [];
  if (!Array.isArray(beansRaw)) return { ok: false, error: "beans: must be a list" };

  const beans: ManifestBean[] = [];
  for (let i = 0; i < beansRaw.length; i += 1) {
    const b = beansRaw[i] as Record<string, unknown>;
    const where = `beans[${i}]`;
    if (typeof b !== "object" || b === null) {
      return { ok: false, error: `${where} must be a mapping` };
    }
    const name = readText(b.name, `${where}.name`);
    if (typeof name === "string") return { ok: false, error: name };
    const description = readText(b.description, `${where}.description`);
    if (typeof description === "string") return { ok: false, error: description };

    const sproutsRaw = b.sprouts ?? [];
    if (!Array.isArray(sproutsRaw)) return { ok: false, error: `${where}.sprouts must be a list` };

    const sprouts: ManifestSprout[] = [];
    for (let j = 0; j < sproutsRaw.length; j += 1) {
      const s = sproutsRaw[j] as Record<string, unknown>;
      const swhere = `${where}.sprouts[${j}]`;
      if (typeof s !== "object" || s === null) {
        return { ok: false, error: `${swhere} must be a mapping` };
      }
      const sname = readText(s.name, `${swhere}.name`);
      if (typeof sname === "string") return { ok: false, error: sname };
      const sdescription = readText(s.description, `${swhere}.description`);
      if (typeof sdescription === "string") return { ok: false, error: sdescription };

      const sprout: ManifestSprout = {
        slug: typeof s.slug === "string" ? s.slug : "",
        // A YAML date scalar parses to a Date; force the authored text back.
        type: typeof s.type === "string" ? s.type : "",
        date: s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date ?? ""),
        name: sname,
        description: sdescription,
      };
      if (s.content !== undefined) {
        const content = readText(s.content, `${swhere}.content`);
        if (typeof content === "string") return { ok: false, error: content };
        sprout.content = content;
      }
      sprouts.push(sprout);
    }

    beans.push({
      slug: typeof b.slug === "string" ? b.slug : "",
      name,
      description,
      sprouts,
    });
  }

  return { ok: true, manifest: { pod, beans } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test lib/garden-manifest.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/garden-manifest.ts lib/garden-manifest.test.ts
git commit -m "Parse a garden manifest into typed entities"
```

---

### Task 2: The shape rules — slugs, dates, types, content size

The validator must reuse `lib/sprout-date.ts` and `lib/sprout-type.ts` rather than write its own regex. See the spec, "Validation reuses the shape modules".

**Files:**
- Modify: `lib/garden-manifest.ts`
- Modify: `lib/garden-manifest.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/garden-manifest.test.ts`:

```ts
function manifestWith(sproutFields: string): string {
  return `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: krabs-import
    name: { en: Import }
    description: { en: Bringing data in. }
    sprouts:
      - slug: krabs-import-intro
        name: { en: Intro }
        description: { en: First note. }
${sproutFields}
`;
}

test("rejects a date that is not YYYY-MM-DD", () => {
  const result = parseManifest(manifestWith(`        type: note\n        date: "09/12/2026"`));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /date/);
});

test("rejects a type with surrounding whitespace", () => {
  const result = parseManifest(manifestWith(`        type: "digest "\n        date: 2026-09-13`));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /type/);
});

test("rejects a slug that is not kebab-case", () => {
  const result = parseManifest(`
pod:
  slug: Krabs_Pod
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /slug/);
});

test("rejects duplicate slugs inside one manifest", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: krabs-import
    name: { en: Import }
    description: { en: One. }
    sprouts: []
  - slug: krabs-import
    name: { en: Import again }
    description: { en: Two. }
    sprouts: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /krabs-import/);
});

test("rejects content over the 64 KiB ceiling", () => {
  const huge = "x".repeat(64 * 1024 + 1);
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
  content: { en: "${huge}" }
beans: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /64/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test lib/garden-manifest.test.ts`
Expected: FAIL — five new tests report `ok === true` where `false` was expected.

- [ ] **Step 3: Write the implementation**

In `lib/garden-manifest.ts`, add the imports and helpers:

```ts
import { isTimelineDate } from "./sprout-date";
import { isSproutType } from "./sprout-type";
import { MAX_CONTENT_BYTES } from "./content-edit";
import { resolveText } from "./data";

/**
 * The slug shape the rest of the garden assumes. Every slug in the store is a
 * URL segment — `/pod/[slug]`, `/bean/[id]` — so a capital or an underscore
 * is not merely untidy: it round-trips through `encodeURIComponent` into
 * something an author cannot retype from the address bar.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugError(slug: string, where: string): string | null {
  if (!slug) return `${where}.slug is required`;
  if (!SLUG.test(slug)) return `${where}.slug must be kebab-case (got "${slug}")`;
  return null;
}

function contentError(content: Text | undefined, where: string): string | null {
  if (content === undefined) return null;
  for (const part of [resolveText(content, "en"), resolveText(content, "fr")]) {
    if (new TextEncoder().encode(part).length > MAX_CONTENT_BYTES) {
      return `${where}.content exceeds ${MAX_CONTENT_BYTES / 1024} KiB`;
    }
  }
  return null;
}
```

Then, immediately before the final `return { ok: true, manifest: … }` in `buildManifest`, insert the whole-manifest check:

```ts
  const seen = new Set<string>();
  const claim = (slug: string, where: string): string | null => {
    const bad = slugError(slug, where);
    if (bad) return bad;
    if (seen.has(slug)) return `duplicate slug "${slug}" at ${where}`;
    seen.add(slug);
    return null;
  };

  const errors: (string | null)[] = [claim(pod.slug, "pod"), contentError(pod.content, "pod")];
  for (let i = 0; i < beans.length; i += 1) {
    const bean = beans[i];
    errors.push(claim(bean.slug, `beans[${i}]`));
    for (let j = 0; j < bean.sprouts.length; j += 1) {
      const s = bean.sprouts[j];
      const where = `beans[${i}].sprouts[${j}]`;
      errors.push(claim(s.slug, where));
      errors.push(contentError(s.content, where));
      if (!isTimelineDate(s.date)) {
        errors.push(`${where}.date must be YYYY-MM-DD (got "${s.date}")`);
      }
      if (!isSproutType(s.type)) {
        errors.push(`${where}.type must be non-blank and untrimmed-free (got "${s.type}")`);
      }
    }
  }
  const firstError = errors.find((e) => e !== null);
  if (firstError) return { ok: false, error: firstError };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test lib/garden-manifest.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/garden-manifest.ts lib/garden-manifest.test.ts
git commit -m "Enforce slug, date, type and content-size shapes on a manifest"
```

---

### Task 3: Refuse the keys the manifest may not carry

Per the spec, "What the manifest may not say": a forbidden key is an error, never a silently ignored field.

**Files:**
- Modify: `lib/garden-manifest.ts`
- Modify: `lib/garden-manifest.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/garden-manifest.test.ts`:

```ts
test("refuses `content` on a bean, naming the sprout as the place for prose", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: krabs-import
    name: { en: Import }
    description: { en: One. }
    content: { en: A narrative that would vanish. }
    sprouts: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /bean has no content/i);
  assert.match(result.error, /sprout/i);
});

for (const key of ["visibility", "state", "relations", "exhibited", "order", "parents"]) {
  test(`refuses \`${key}\` rather than ignoring it`, () => {
    const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: krabs-import
    name: { en: Import }
    description: { en: One. }
    ${key}: something
    sprouts: []
`);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, new RegExp(key));
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test lib/garden-manifest.test.ts`
Expected: FAIL — the seven new tests get `ok === true`.

- [ ] **Step 3: Write the implementation**

In `lib/garden-manifest.ts`, add:

```ts
/**
 * Keys a manifest may never carry, and why each one is an ERROR rather than a
 * field quietly dropped.
 *
 * `visibility`, `state`, `exhibited` and `order` are the publishing decision,
 * which lives in the admin behind the enum rule — a named member of a
 * vocabulary and a Save that confirms. A manifest that appears to publish and
 * does not is worse than one that refuses: the author believes the thing is
 * live, and nothing anywhere looks wrong.
 *
 * `relations` is DERIVED, never authored — `lib/articles-store.ts:128` mirrors
 * it from the body's entity refs, and this script does the same.
 *
 * `parents` is containment, and re-homing an entity is a privacy cascade
 * decision (`lib/data.ts:695`). The only parentage a manifest states is
 * `pod.plant`, on creation.
 *
 * `content` on a BEAN is the one that needs a sentence rather than a word,
 * because it is the mistake every agent makes: the field does not exist
 * (`lib/data.ts:174`), so it would parse, write nothing, and lose the prose in
 * silence.
 */
const FORBIDDEN = ["visibility", "state", "exhibited", "order", "relations", "parents"] as const;

function forbiddenError(raw: Record<string, unknown>, where: string): string | null {
  for (const key of FORBIDDEN) {
    if (raw[key] !== undefined) {
      return `${where}.${key} is not allowed — see the garden-plant skill for why`;
    }
  }
  return null;
}
```

Add the bean-specific check beside it:

```ts
function beanContentError(raw: Record<string, unknown>, where: string): string | null {
  if (raw.content === undefined) return null;
  return `${where}.content is not allowed — a bean has no content field; put the prose in a sprout under it`;
}
```

Wire them in. In `buildManifest`, after `const p = podRaw as Record<string, unknown>;` add:

```ts
  const podForbidden = forbiddenError(p, "pod");
  if (podForbidden) return { ok: false, error: podForbidden };
```

Inside the bean loop, after the `must be a mapping` guard, add:

```ts
    const beanForbidden = forbiddenError(b, where) ?? beanContentError(b, where);
    if (beanForbidden) return { ok: false, error: beanForbidden };
```

Inside the sprout loop, after its `must be a mapping` guard, add:

```ts
      const sproutForbidden = forbiddenError(s, swhere);
      if (sproutForbidden) return { ok: false, error: sproutForbidden };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test lib/garden-manifest.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/garden-manifest.ts lib/garden-manifest.test.ts
git commit -m "Refuse the keys a manifest may not carry"
```

---

### Task 4: The plan — diffing a manifest against the garden

**Files:**
- Create: `lib/garden-plan.ts`
- Create: `lib/garden-plan.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/garden-plan.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { planGarden } from "./garden-plan";
import { parseManifest } from "./garden-manifest";
import type { Bean, Pod, Sprout } from "./data";

const YAML = `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
  content: { en: The narrative. }
beans:
  - slug: krabs-import
    name: { en: Import }
    description: { en: Bringing data in. }
    sprouts:
      - slug: krabs-import-intro
        type: note
        date: 2026-09-13
        name: { en: Intro }
        description: { en: First note. }
        content: { en: Body. }
`;

function manifest() {
  const result = parseManifest(YAML);
  if (!result.ok) throw new Error(result.error);
  return result.manifest;
}

const EMPTY = { pods: [] as Pod[], beans: [] as Bean[], sprouts: [] as Sprout[] };

test("an empty garden plans three creates", () => {
  const plan = planGarden(manifest(), EMPTY, { update: false });
  assert.deepEqual(
    plan.map((a) => [a.action, a.tier, a.slug]),
    [
      ["create", "pod", "krabs"],
      ["create", "bean", "krabs-import"],
      ["create", "sprout", "krabs-import-intro"],
    ],
  );
});

test("existing slugs are skipped, not touched", () => {
  const plan = planGarden(
    manifest(),
    {
      pods: [{ slug: "krabs", name: "Krabs", description: "old" } as Pod],
      beans: [{ slug: "krabs-import", name: "Import", parents: [] } as Bean],
      sprouts: [] as Sprout[],
    },
    { update: false },
  );
  assert.deepEqual(
    plan.map((a) => [a.action, a.slug]),
    [
      ["skip", "krabs"],
      ["skip", "krabs-import"],
      ["create", "krabs-import-intro"],
    ],
  );
});

test("--update turns a skip into an update", () => {
  const plan = planGarden(
    manifest(),
    {
      pods: [{ slug: "krabs", name: "Krabs", description: "old" } as Pod],
      beans: [] as Bean[],
      sprouts: [] as Sprout[],
    },
    { update: true },
  );
  assert.equal(plan[0].action, "update");
  assert.equal(plan[0].slug, "krabs");
});

test("a bean whose pod is being created still plans after it", () => {
  const plan = planGarden(manifest(), EMPTY, { update: false });
  assert.ok(plan.findIndex((a) => a.tier === "pod") < plan.findIndex((a) => a.tier === "bean"));
  assert.ok(plan.findIndex((a) => a.tier === "bean") < plan.findIndex((a) => a.tier === "sprout"));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test lib/garden-plan.test.ts`
Expected: FAIL — `Cannot find module './garden-plan'`.

- [ ] **Step 3: Write the implementation**

Create `lib/garden-plan.ts`:

```ts
/**
 * What planting THIS manifest into THIS garden would do — decided before a
 * single write, and printable.
 *
 * Pure, and separate from `lib/garden-manifest.ts` because the two fail for
 * different reasons: a manifest is invalid because the author made a mistake,
 * a plan is surprising because the garden already contains something. This
 * half needs no YAML and that half needs no database.
 *
 * ORDER IS THE OUTPUT. A bean's `parents` names its pod and a sprout's names
 * its bean, so the list is emitted pod → bean → sprout and applied in that
 * order. A parent created after its child would leave a dangling ref, which
 * `filterPublic` tolerates on read (a dangling parent is ignored) — which is
 * exactly why it must not be produced: nothing would fail.
 */
import type { Bean, Pod, Sprout } from "./data";
import type { GardenManifest, ManifestBean, ManifestPod, ManifestSprout } from "./garden-manifest";

export type Tier = "pod" | "bean" | "sprout";
export type Verb = "create" | "skip" | "update";

export interface PlanAction {
  action: Verb;
  tier: Tier;
  slug: string;
  /** The manifest entry this action is for; the applier reads it. */
  entry: ManifestPod | ManifestBean | ManifestSprout;
  /** The bean a sprout hangs from / the pod a bean hangs from. Absent on the pod. */
  parentSlug?: string;
}

export interface GardenSlugs {
  pods: Pod[];
  beans: Bean[];
  sprouts: Sprout[];
}

export interface PlanOptions {
  update: boolean;
}

function verb(exists: boolean, opts: PlanOptions): Verb {
  if (!exists) return "create";
  return opts.update ? "update" : "skip";
}

export function planGarden(
  manifest: GardenManifest,
  garden: GardenSlugs,
  opts: PlanOptions,
): PlanAction[] {
  const podSlugs = new Set(garden.pods.map((p) => p.slug));
  const beanSlugs = new Set(garden.beans.map((b) => b.slug));
  const sproutSlugs = new Set(garden.sprouts.map((s) => s.slug));

  const actions: PlanAction[] = [
    {
      action: verb(podSlugs.has(manifest.pod.slug), opts),
      tier: "pod",
      slug: manifest.pod.slug,
      entry: manifest.pod,
    },
  ];

  for (const bean of manifest.beans) {
    actions.push({
      action: verb(beanSlugs.has(bean.slug), opts),
      tier: "bean",
      slug: bean.slug,
      entry: bean,
      parentSlug: manifest.pod.slug,
    });
    for (const sprout of bean.sprouts) {
      actions.push({
        action: verb(sproutSlugs.has(sprout.slug), opts),
        tier: "sprout",
        slug: sprout.slug,
        entry: sprout,
        parentSlug: bean.slug,
      });
    }
  }

  return actions;
}

/** The tree `--dry-run` prints, and the summary every run ends with. */
export function renderPlan(actions: PlanAction[]): string {
  const lines = actions.map((a) => {
    const indent = a.tier === "pod" ? "" : a.tier === "bean" ? "  " : "    ";
    return `${a.action.padEnd(6)} ${indent}${a.tier} ${a.slug}`;
  });
  const counts = { create: 0, skip: 0, update: 0 };
  for (const a of actions) counts[a.action] += 1;
  lines.push("");
  lines.push(`${counts.create} to create, ${counts.update} to update, ${counts.skip} skipped`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test lib/garden-plan.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/garden-plan.ts lib/garden-plan.test.ts
git commit -m "Plan what planting a manifest would do, before writing"
```

---

### Task 5: The script

**Files:**
- Create: `scripts/plant-garden.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

Create `scripts/plant-garden.ts`:

```ts
/**
 * Plants a sibling repo's `garden.yml` into the garden.
 *
 *   npm run garden:plant -- ../krabs/garden.yml [--dry-run] [--update]
 *
 * THE CREDENTIAL NEVER LEAVES THIS REPO. The agent in the other repo writes
 * the file and stops; a human reviews the diff and runs this. That is the
 * whole reason the manifest exists rather than an ingest route: a new
 * token-gated write surface would put a bad payload one curl away from
 * production.
 *
 * NOTHING IS PUBLISHED. No `visibility` and no sprout `state` is ever written,
 * so `createPod`, `createBean` and `createSprout` leave everything private at
 * birth exactly as the triage flow does. The beans are published in the admin,
 * through the enum rule — a named member of a vocabulary and a Save that
 * confirms. A `--publish` flag here would run `publishCascade` from a CLI and
 * flip the bean and the pod above it with no confirmation, which is the shape
 * the rulebook rejected for a stray click on a globe.
 *
 * THE CACHE IS NOT INVALIDATED, AND MUST NOT BE. A CLI has no Next request
 * store, so `revalidateGarden()` takes its tolerated branch and does nothing —
 * an invalidation that looks like one and is not. It is not needed either:
 * everything written here is private, so `filterPublic` drops all of it and
 * the cached public dataset is unchanged by definition. The cache matters at
 * the moment of publishing, and publishing happens at the four real doors.
 */
import { readFileSync } from "node:fs";
import { parseManifest } from "../lib/garden-manifest";
import { planGarden, renderPlan, type PlanAction } from "../lib/garden-plan";
import type { ManifestBean, ManifestPod, ManifestSprout } from "../lib/garden-manifest";
import { loadRawGarden } from "../lib/store";
import {
  createBean,
  createPod,
  createSprout,
  updateBeanMeta,
  updatePodContent,
  updateSproutContent,
  updateSproutMeta,
} from "../lib/botanical";
import { extractRefs, mergeMirrored } from "../lib/entity-refs";
import type { Text } from "../lib/data";

function usage(message: string): never {
  console.error(`${message}\n`);
  console.error("usage: npm run garden:plant -- <manifest.yml> [--dry-run] [--update]");
  process.exit(1);
}

/**
 * The content half of a write, composed the way `lib/articles-store.ts:128`
 * composes it — `mergeMirrored(undefined, extractRefs(content))`.
 *
 * NOT `buildContentPatch`: that is the EDITOR's door and is `en`-only by
 * design (it carries a stored `fr` back verbatim and cannot set one). A
 * manifest is bilingual at birth, so it composes the patch directly and takes
 * only the mirroring from the shared path.
 */
function contentPatch(content: Text) {
  return { content, relations: mergeMirrored(undefined, extractRefs(content)) };
}

async function applyPod(action: PlanAction): Promise<void> {
  const pod = action.entry as ManifestPod;
  if (action.action === "create") {
    await createPod({
      slug: pod.slug,
      name: typeof pod.name === "string" ? pod.name : (pod.name.en ?? pod.name.fr ?? pod.slug),
      plantSlug: pod.plant,
      description: typeof pod.description === "string" ? pod.description : "",
    });
  }
  if (pod.content) await updatePodContent(pod.slug, contentPatch(pod.content));
}

async function applyBean(action: PlanAction): Promise<void> {
  const bean = action.entry as ManifestBean;
  if (action.action === "create") {
    await createBean({
      slug: bean.slug,
      name: bean.name,
      description: bean.description,
      podSlug: action.parentSlug ?? null,
      plantSlug: null,
    });
    return;
  }
  await updateBeanMeta(bean.slug, { name: bean.name, description: bean.description });
}

async function applySprout(action: PlanAction): Promise<void> {
  const sprout = action.entry as ManifestSprout;
  if (action.action === "create") {
    await createSprout({
      slug: sprout.slug,
      name: sprout.name,
      type: sprout.type,
      date: sprout.date,
      description: sprout.description,
      state: "draft",
      parents: [`bean:${action.parentSlug}`],
      media: [],
      source: { kind: "manifest" },
      ...(sprout.content
        ? { content: sprout.content, relations: mergeMirrored(undefined, extractRefs(sprout.content)) }
        : {}),
    });
    return;
  }
  await updateSproutMeta(sprout.slug, { name: sprout.name, description: sprout.description });
  if (sprout.content) await updateSproutContent(sprout.slug, contentPatch(sprout.content));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) usage("a manifest path is required");
  const dryRun = args.includes("--dry-run");
  const update = args.includes("--update");

  let yamlText: string;
  try {
    yamlText = readFileSync(path, "utf8");
  } catch (err) {
    usage(`cannot read ${path}: ${(err as Error).message}`);
  }

  // Validate the WHOLE file before touching the database. A pod that exists
  // with three of its five beans missing is a worse state than an untouched
  // garden, and it is the state a per-entity validator produces on the first
  // bad sprout.
  const parsed = parseManifest(yamlText);
  if (!parsed.ok) usage(`invalid manifest: ${parsed.error}`);

  const garden = await loadRawGarden();
  const plan = planGarden(parsed.manifest, garden, { update });

  console.log(renderPlan(plan));

  if (dryRun) {
    console.log("\n--dry-run: nothing written");
    process.exit(0);
  }

  for (const action of plan) {
    if (action.action === "skip") continue;
    if (action.tier === "pod") await applyPod(action);
    else if (action.tier === "bean") await applyBean(action);
    else await applySprout(action);
    console.log(`${action.action} ${action.tier} ${action.slug}`);
  }

  console.log("\nEverything written is PRIVATE. Publish in the admin.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Confirm the shapes the applier relies on**

These are verified as of this plan; the step exists so a drift shows up here
rather than as a `tsc` error with no explanation:

- `SproutState` is `"draft" | "private" | "published"` (`lib/data.ts:7`), so
  `"draft"` is a real member and is **not** `"published"`.
- `BeanMetaPatch` is `{ name: Text; description: Text | null }`
  (`lib/bean-meta.ts:17`) — `null` means clear, so a manifest's description is
  passed straight through.
- `SproutMetaPatch` is `{ name: Text; description: Text }`
  (`lib/sprout-meta.ts:35`).
- `extractRefs(content)` and `mergeMirrored(existing, mirrored)` are exported
  from `lib/entity-refs.ts:132` and `:153`.

Run: `grep -n "export type SproutState" lib/data.ts`
Expected: `export type SproutState = "draft" | "private" | "published";`

- [ ] **Step 3: Note the one guard the applier does NOT get for free**

`updateBeanMeta` and `updateSproutMeta` throw `BlankBeanNameError` /
`BlankSproutNameError` on an empty name. The manifest validator already rejects
a blank `en`, so this cannot fire from a valid file — but the script's top-level
`.catch` prints and exits 1, which is the right behaviour if it ever does. No
extra handling.

- [ ] **Step 4: Add the npm script**

In `package.json`, add beside `"brand:build"`:

```json
    "garden:plant": "node --env-file=.env.local --import tsx scripts/plant-garden.ts",
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/plant-garden.ts package.json
git commit -m "Add npm run garden:plant"
```

---

### Task 6: End-to-end against a real database

**Files:**
- Create: `lib/plant-garden.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create `lib/plant-garden.test.ts`:

```ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./garden-manifest";
import { planGarden } from "./garden-plan";
import { loadRawGarden } from "./store";
import { getDb } from "./db";

const YAML = `
pod:
  slug: test-krabs
  name: { en: Krabs, fr: Krabs }
  plant: null
  description: { en: A small ledger., fr: Un petit registre. }
  content: { en: The narrative., fr: Le récit. }
beans:
  - slug: test-krabs-import
    name: { en: Import, fr: Import }
    description: { en: Bringing data in., fr: Faire entrer les données. }
    sprouts:
      - slug: test-krabs-import-intro
        type: note
        date: 2026-09-13
        name: { en: Intro, fr: Intro }
        description: { en: First note., fr: Première note. }
        content: { en: Body., fr: Corps. }
`;

async function wipe(): Promise<void> {
  const db = await getDb();
  await db.collection("pods").deleteMany({ slug: /^test-krabs/ });
  await db.collection("beans").deleteMany({ slug: /^test-krabs/ });
  await db.collection("sprouts").deleteMany({ slug: /^test-krabs/ });
}

before(wipe);
after(wipe);

test("planting creates the tree, private, with parents pointing upward", async () => {
  const parsed = parseManifest(YAML);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const { applyPlan } = await import("./plant-garden-apply");
  await applyPlan(planGarden(parsed.manifest, await loadRawGarden(), { update: false }));

  const garden = await loadRawGarden();
  const pod = garden.pods.find((p) => p.slug === "test-krabs");
  const bean = garden.beans.find((b) => b.slug === "test-krabs-import");
  const sprout = garden.sprouts.find((s) => s.slug === "test-krabs-import-intro");

  assert.ok(pod && bean && sprout);
  assert.deepEqual(pod.parents, []);
  assert.deepEqual(bean.parents, ["pod:test-krabs"]);
  assert.deepEqual(sprout.parents, ["bean:test-krabs-import"]);

  // Private at birth: nothing the manifest wrote is public.
  assert.equal(pod.visibility, "private");
  assert.equal(bean.visibility, "private");
  assert.notEqual(sprout.state, "published");

  // Bilingual content survived, and is NOT en-only.
  assert.deepEqual(pod.content, { en: "The narrative.", fr: "Le récit." });
});

test("a second run writes nothing", async () => {
  const parsed = parseManifest(YAML);
  if (!parsed.ok) throw new Error(parsed.error);
  const { applyPlan } = await import("./plant-garden-apply");

  const before = await loadRawGarden();
  await applyPlan(planGarden(parsed.manifest, before, { update: false }));
  const after = await loadRawGarden();

  assert.equal(
    after.pods.filter((p) => p.slug.startsWith("test-krabs")).length,
    before.pods.filter((p) => p.slug.startsWith("test-krabs")).length,
  );
  assert.deepEqual(
    after.pods.find((p) => p.slug === "test-krabs")?.content,
    before.pods.find((p) => p.slug === "test-krabs")?.content,
  );
});

test("--update rewrites content but never parents or visibility", async () => {
  const changed = YAML.replace("The narrative.", "A better narrative.");
  const parsed = parseManifest(changed);
  if (!parsed.ok) throw new Error(parsed.error);
  const { applyPlan } = await import("./plant-garden-apply");

  await applyPlan(planGarden(parsed.manifest, await loadRawGarden(), { update: true }));

  const pod = (await loadRawGarden()).pods.find((p) => p.slug === "test-krabs");
  assert.equal((pod?.content as { en: string }).en, "A better narrative.");
  assert.deepEqual(pod?.parents, []);
  assert.equal(pod?.visibility, "private");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `MONGODB_DB=beanstalk_scratch npx tsx --env-file=.env.local --test lib/plant-garden.test.ts`
Expected: FAIL — `Cannot find module './plant-garden-apply'`.

- [ ] **Step 3: Extract the applier so both the script and the test call one thing**

Create `lib/plant-garden-apply.ts` by **moving** `contentPatch`, `applyPod`, `applyBean`, `applySprout` out of `scripts/plant-garden.ts` verbatim, and adding:

```ts
/**
 * Applies a plan. Lives in `lib/` rather than in the script because a write
 * path that only a CLI can reach is a write path no test exercises — and this
 * one creates three tiers, two of which carry a privacy cascade.
 */
export async function applyPlan(plan: PlanAction[]): Promise<void> {
  for (const action of plan) {
    if (action.action === "skip") continue;
    if (action.tier === "pod") await applyPod(action);
    else if (action.tier === "bean") await applyBean(action);
    else await applySprout(action);
  }
}
```

Export `applyPlan` and keep `applyPod` / `applyBean` / `applySprout` module-private. In `scripts/plant-garden.ts`, delete those four functions and the now-unused imports, import `applyPlan` from `../lib/plant-garden-apply`, and replace the `for (const action of plan)` loop with:

```ts
  await applyPlan(plan);
  for (const action of plan) {
    if (action.action !== "skip") console.log(`${action.action} ${action.tier} ${action.slug}`);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `MONGODB_DB=beanstalk_scratch npx tsx --env-file=.env.local --test lib/plant-garden.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Wire it into `npm run test:db`**

In `package.json`, append ` lib/plant-garden.test.ts` to the end of the `test:db` file list.

- [ ] **Step 6: Run the full DB suite**

Run: `npm run test:db`
Expected: PASS, with the new file included and no cross-test interference.

- [ ] **Step 7: Commit**

```bash
git add lib/plant-garden-apply.ts lib/plant-garden.test.ts scripts/plant-garden.ts package.json
git commit -m "Exercise the planting write path against a real database"
```

---

### Task 7: The plugin skill

**Files:**
- Create: `plugins/garden-plant/.claude-plugin/plugin.json`
- Create: `plugins/garden-plant/skills/garden-plant/SKILL.md`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Write the plugin manifest**

Create `plugins/garden-plant/.claude-plugin/plugin.json`:

```json
{
  "name": "garden-plant",
  "description": "Describe a project as a pod, beans and sprouts in a garden.yml — Ariko plants it with one reviewed command.",
  "version": "0.1.0",
  "author": {
    "name": "Alexis Bohns"
  }
}
```

- [ ] **Step 2: Write the skill**

Create `plugins/garden-plant/skills/garden-plant/SKILL.md`:

````markdown
---
name: garden-plant
description: >
  Author a `garden.yml` describing this repo's project as a pod, its beans and
  their opening sprouts, for planting into the Ariko garden. Use when asked to
  add this project to Ariko, create a pod for it, or write its beans and
  narratives. You write the FILE and stop — you never connect to a database.
---

# Planting a project in the Ariko garden

Ariko is a portfolio on a botanical content model. A project of any size can be
described as a small tree of entities, written into a `garden.yml` at the root
of this repo, and planted by a single reviewed command **in the Ariko repo**.

## What you do, and where you stop

1. Read this repo well enough to describe it honestly.
2. Write `garden.yml` at the repo root.
3. Open a PR with it, and report in the PR body what the tree contains.

**You stop there.** You do not connect to MongoDB, you do not run
`garden:plant`, and you never ask for a connection string. The credential lives
in the Ariko repo and the write is a human's decision. An agent that plants
directly is the exact failure this file exists to prevent.

## The tiers

| Tier | Is | Has prose? |
| --- | --- | --- |
| **Plant** | A whole body of work with its own identity and logo | yes, `content` |
| **Pod** | A project, or a grouping within a plant | yes, `content` |
| **Bean** | One feature, chapter or theme inside a project | **NO** |
| **Sprout** | One dated entry: what you wrote about a bean on a day | yes, `content` |

**A bean has no `content` field.** This is the mistake to avoid — it is not a
limitation to route around. The bean IS the feature; what you write about it is
a sprout hanging from it, which is how the timeline, the digest and the publish
cascade all find the prose. A `content:` key on a bean is rejected by the
validator.

A small project needs **no plant**. Write `plant: null` and the pod stands on
its own.

## The file

```yaml
pod:
  slug: krabs                       # kebab-case, becomes /pod/krabs
  name: { en: Krabs, fr: Krabs }
  plant: null                       # or an existing plant's slug
  description: { en: "One line.", fr: "Une ligne." }
  content:
    en: |-
      The narrative, markdown. What this project is and why it exists.
    fr: |-
      Le récit, en markdown. Une adaptation, pas une traduction.
beans:
  - slug: krabs-import-rules-triage
    name: { en: "Import, rules and triage", fr: "Import, règles et tri" }
    description: { en: "One line.", fr: "Une ligne." }
    sprouts:
      - slug: krabs-import-rules-triage-intro
        type: note                  # free-form; no blanks, no surrounding space
        date: 2026-09-13            # YYYY-MM-DD, exactly
        name: { en: "Title", fr: "Titre" }
        description: { en: "One line.", fr: "Une ligne." }
        content:
          en: |-
            The real writing — what this feature does, drawn from the code.
          fr: |-
            L'écriture réelle, adaptée.
```

### Rules the validator enforces

- **Slugs are kebab-case** and unique across the whole file. They become URLs.
- **`date` must be `YYYY-MM-DD`.** The garden sorts dates as raw strings and
  never parses them, so any other format silently misfiles the sprout.
- **`type` must not be blank or carry surrounding whitespace.** Three places
  compare a type against a bare literal and none of them trims.
- **Every `{ en, fr }` needs a non-blank `en`.** `fr` is optional.
- **`content` is capped at 64 KiB** per language.

### Keys you may not write

`visibility`, `state`, `exhibited`, `order`, `relations`, `parents`, and
`content` on a bean. Each one is a hard error, not a field quietly ignored.

Publishing is a deliberate act in the Ariko admin. Everything you describe is
created **private**, and the maintainer publishes it there. A manifest that
appears to publish and does not would be worse than one that refuses.

## Tone

Same voice as the Lab Note: lead with what the thing does for a person, keep it
short, warm and a little playful, never corporate. No ticket numbers, no
internal class names, no engineering jargon in the prose.

The `fr` half is an **adaptation**, not a literal translation, and it uses the
informal *Tu*.

## What happens next

The maintainer, in the Ariko repo, runs:

```bash
npm run garden:plant -- ../<this-repo>/garden.yml --dry-run   # prints the tree
npm run garden:plant -- ../<this-repo>/garden.yml             # writes it, privately
```

Re-running is safe: existing slugs are skipped. `--update` opts into rewriting
descriptions and narratives from the file, and touches nothing else.
````

- [ ] **Step 3: List the plugin in the marketplace**

In `.claude-plugin/marketplace.json`, add a second entry to `plugins`:

```json
    {
      "name": "garden-plant",
      "source": "./plugins/garden-plant",
      "description": "Describe a project as a pod, beans and sprouts in a garden.yml — Ariko plants it with one reviewed command."
    }
```

- [ ] **Step 4: Verify the JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); JSON.parse(require('fs').readFileSync('plugins/garden-plant/.claude-plugin/plugin.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 5: Verify the skill's example manifest actually validates**

Run:

```bash
npx tsx -e "
const { readFileSync } = require('node:fs');
const md = readFileSync('plugins/garden-plant/skills/garden-plant/SKILL.md','utf8');
const yaml = md.split('\`\`\`yaml')[1].split('\`\`\`')[0];
const { parseManifest } = require('./lib/garden-manifest');
console.log(parseManifest(yaml));
"
```

Expected: `{ ok: true, manifest: … }`. If it reports an error, fix the SKILL.md example — a skill whose own example is rejected is worse than no example.

- [ ] **Step 6: Commit**

```bash
git add plugins/garden-plant .claude-plugin/marketplace.json
git commit -m "Ship the garden-plant skill beside lab-note"
```

---

### Task 8: The always-loaded summary

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the section**

In `CLAUDE.md`, immediately before the `## Lab Note requirement` section, insert:

```markdown
## Planting a project from another repo

A sibling repo describes itself as a `garden.yml` — one pod, its beans, and a
sprout under each — and **Ariko plants it**, never the other way round:

```bash
npm run garden:plant -- ../krabs/garden.yml --dry-run
npm run garden:plant -- ../krabs/garden.yml
```

`lib/garden-manifest.ts` validates the whole file before a single write (a pod
with three of five beans is worse than an untouched garden);
`lib/garden-plan.ts` diffs it against the garden and prints the tree;
`lib/plant-garden-apply.ts` writes through `createPod` / `createBean` /
`createSprout`, which is what inherits the unique slug index, the prefixed-ref
grammar and private-at-birth rather than restating them.

Three rules the tests pin, each of which passes `tsc` and `npm run build` while
quietly becoming false:

- **The manifest never publishes.** No `visibility`, no `state` — both are
  refused keys, not ignored ones. Publishing stays in the admin behind the enum
  rule. A CLI flag running `publishCascade` would flip the bean and pod above it
  with no confirmation.
- **A bean has no `content`.** Only `Pod.content` and `Plant.content` exist
  (`lib/data.ts:161`, `:129`). A bean's prose is a sprout under it. The
  validator refuses the key BY NAME, because it would otherwise parse, write
  nothing, and lose the prose in silence.
- **The script does not invalidate the cache, deliberately.** A CLI has no Next
  request store, so `revalidateGarden()` would take its tolerated branch and do
  nothing. It is also unnecessary: everything written is private, so
  `filterPublic` drops all of it.

Sibling agents get this as a skill — `plugins/garden-plant/`, installable with
`/plugin install garden-plant@ariko`, beside the Lab Note plugin. The skill's
first job is telling the other agent to write the file and **stop**: it never
holds `MONGODB_URI` and never runs the script.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the planting door in the rulebook"
```

---

### Task 9: Full verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Unit tests**

Run: `npm test`
Expected: PASS, including `lib/garden-manifest.test.ts` (15 tests) and `lib/garden-plan.test.ts` (4 tests).

- [ ] **Step 4: DB tests**

Run: `npm run test:db`
Expected: PASS, including `lib/plant-garden.test.ts` (3 tests).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success. In particular the new `lib/` modules must not pull `node:fs`
into a client bundle — `lib/garden-manifest.ts` imports `lib/data.ts`, which is
server-only, and nothing in `app/` imports it.

- [ ] **Step 6: Commit any fixes and open the PR**

```bash
git push -u origin garden-plant
gh pr create --title "Plant a project from its own repo" --body "$(cat <<'EOF'
A sibling repo describes itself as a `garden.yml`; Ariko plants it with one
reviewed command. Adds the validator, the planner, the applier, the CLI and
the `garden-plant` plugin skill.

Spec: `docs/superpowers/specs/2026-09-13-garden-plant-design.md`
Plan: `docs/superpowers/plans/2026-09-13-garden-plant.md`

No Lab Note: this ships no visitor-facing change.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" --label no-lab-note
```

---

## Notes for the implementer

- **`require` inside an ESM module.** Task 1 uses `require("js-yaml")` for
  brevity. If `npx tsc --noEmit` or the ESM loader objects, change it to a
  top-level `import { load } from "js-yaml";` and call `load(yamlText)` — the
  dependency and its `@types` are already installed.
- **`lib/entity-refs.ts`** supplies `extractRefs` and `mergeMirrored`. If the
  export names differ, follow `lib/articles-store.ts:11` — that file is the
  precedent this one copies.
- **Do not reach for `buildContentPatch`.** It is the editor's `en`-only door
  (`lib/content-edit.ts:38`) and cannot set an `fr` half. The manifest is
  bilingual at birth, so the patch is composed directly and only the relation
  mirroring is shared.
