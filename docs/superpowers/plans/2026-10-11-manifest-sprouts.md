# Manifest Sprouts With `about` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slice four of the journal model (spec `docs/superpowers/specs/2026-10-10-journal-model-design.md` §3 Doors "Garden manifest", §5 item 4, §6 last two bullets): a garden manifest's sprouts move out of beans into a **top-level `sprouts:` list**, each with its own `about: [slugs]` resolved against the same file; a sprout nested under a bean (the old shape) is refused by name with a message naming the new one; the plan, the applier, the assets collector, the plugin skill and the docs follow.

**Architecture:** `lib/garden-manifest.ts` is the only place the shape is decided: `ManifestSprout` gains `about: string[]` holding PREFIXED refs (`pod:<slug>` / `bean:<slug>`) resolved from the bare slugs the author wrote, against the pod and beans of the same file; `ManifestBean` loses `sprouts`; `GardenManifest` gains `sprouts`. Everything downstream (`planGarden`, `applyPlan`, `collectAssets`, `assetsNeeded`) reads `manifest.sprouts` and `entry.about` instead of walking `bean.sprouts` and `parentSlug`. The applier writes `about` verbatim — it is already the storage grammar — so `resolveSproutPlant` derives the plant exactly as it does for an admin-authored entry. The `--update` path never rewrites `about` (re-homing is the admin's). The CLI (`scripts/plant-garden.ts`) changes nothing: it calls the four functions.

**Tech Stack:** TypeScript, `js-yaml` (`load`), `node:test` + `node:assert/strict`; one DB test (`lib/plant-garden.test.ts`) that the controller runs with `npm run test:db`.

---

## Before you start

Worktree `scratchpad/wt-manifest-sprouts`, branch `journal/manifest-sprouts`, off `main` (`bd5bd90`). `node_modules` is a symlink, `.env.local` points at PRODUCTION: implementers never run `npm run test:db`, `next dev`, `next build`; `npm test` is unit-only and safe. Never touch `/Users/alexis/code/ariko`.

One test file: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test <file>`.

Read first: `lib/garden-manifest.ts` (whole file, 486 lines — `buildSprout`, `buildBean`, `buildManifest`, `findDuplicateSlug`), `lib/garden-plan.ts` (156 lines), `lib/plant-garden-apply.ts` lines 150–194 (the sprout branch), `lib/garden-assets.ts` (`collectAssets`, `assetsNeeded`), and their tests. The stored `Sprout` (lib/data.ts) has `about?: string[]` of `pod:`/`bean:` refs and its plant is derived (`resolveSproutPlant`); `POD_PREFIX`/`BEAN_PREFIX` are exported from lib/data.ts.

The manifest's new shape, which every task below serves:

```yaml
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: ledger
    name: { en: Ledger }
    description: { en: The ledger bean. }
sprouts:
  - slug: first-entry
    kind: log
    date: 2026-09-13
    about: [ledger]            # bare slugs from THIS file: the pod's, or a bean's
    name: { en: First entry }
    description: { en: The first entry. }
  - slug: the-pod-itself
    kind: essay
    date: 2026-09-20
    about: [krabs]             # about the pod
    name: { en: Why a ledger }
    description: { en: An essay about the project. }
```

---

### Task 1: The manifest parses top-level `sprouts` with `about`, and refuses the nested shape

**Files:**
- Modify: `lib/garden-manifest.ts`
- Modify: `lib/garden-manifest.test.ts`

- [ ] **Step 1: Refit the fixtures and add the failing tests**

Every fixture in `lib/garden-manifest.test.ts` that nests `sprouts:` under a bean moves them to a top-level `sprouts:` list with `about: [<that bean's slug>]`, keeping slugs, kinds, dates and names so every existing assertion keeps its meaning. Assertions that read `result.manifest.beans[0].sprouts[0]` read `result.manifest.sprouts[0]` instead. Test names that say "in different beans" become "in the sprouts list". The test "a nested error names its full path" keeps its purpose (a deep error path) using `sprouts[1].name` as the missing field: expect the error to match `/sprouts\[1\]\.name/`.

Then add:

```ts
test("a sprout's about resolves bare slugs against this file: a bean's, or the pod's", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: ledger
    name: { en: Ledger }
    description: { en: The ledger bean. }
sprouts:
  - slug: about-the-bean
    kind: log
    date: 2026-09-13
    about: [ledger]
    name: { en: About the bean }
    description: { en: x }
  - slug: about-the-pod
    kind: essay
    date: 2026-09-14
    about: [krabs]
    name: { en: About the pod }
    description: { en: x }
  - slug: about-both
    kind: decision
    date: 2026-09-15
    about: [krabs, ledger]
    name: { en: About both }
    description: { en: x }
`);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.sprouts.map((s) => s.about), [["bean:ledger"], ["pod:krabs"], ["pod:krabs", "bean:ledger"]]);
  assert.equal(result.manifest.beans[0].slug, "ledger");
});

test("a sprout nested under a bean — the old shape — is refused BY NAME, naming the new one", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: x }
beans:
  - slug: ledger
    name: { en: Ledger }
    description: { en: x }
    sprouts:
      - slug: first-entry
        kind: log
        date: 2026-09-13
        name: { en: First entry }
        description: { en: x }
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /beans\[0\]\.sprouts is not a key any more/);
  assert.match(result.error, /top-level `sprouts:` list/);
  assert.match(result.error, /about: \[ledger\]/);
});

test("about is required, a list of strings, non-empty", () => {
  const base = (about: string) => `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: x }
beans:
  - slug: ledger
    name: { en: Ledger }
    description: { en: x }
sprouts:
  - slug: s
    kind: log
    date: 2026-09-13
${about}
    name: { en: S }
    description: { en: x }
`;
  const missing = parseManifest(base(""));
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /sprouts\[0\]\.about is required — a list of the slugs \(from this file\) the entry is about/);
  const notList = parseManifest(base("    about: ledger"));
  assert.equal(notList.ok, false);
  if (!notList.ok) assert.match(notList.error, /sprouts\[0\]\.about must be a list of slugs/);
  const empty = parseManifest(base("    about: []"));
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /sprouts\[0\]\.about must name at least one/);
  const notString = parseManifest(base("    about: [1]"));
  assert.equal(notString.ok, false);
  if (!notString.ok) assert.match(notString.error, /sprouts\[0\]\.about\[0\] must be a slug \(got 1\)/);
});

test("about refuses a slug this file does not define, a prefixed ref, and a repeat", () => {
  const base = (about: string) => `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: x }
beans:
  - slug: ledger
    name: { en: Ledger }
    description: { en: x }
sprouts:
  - slug: s
    kind: log
    date: 2026-09-13
    about: ${about}
    name: { en: S }
    description: { en: x }
`;
  const unknown = parseManifest(base("[elsewhere]"));
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.match(unknown.error, /sprouts\[0\]\.about\[0\] "elsewhere" names nothing in this file — the pod is "krabs" and the beans are ledger/);
  const prefixed = parseManifest(base("[\"bean:ledger\"]"));
  assert.equal(prefixed.ok, false);
  if (!prefixed.ok) assert.match(prefixed.error, /sprouts\[0\]\.about\[0\] "bean:ledger" is a bare slug here — write ledger/);
  const twice = parseManifest(base("[ledger, ledger]"));
  assert.equal(twice.ok, false);
  if (!twice.ok) assert.match(twice.error, /sprouts\[0\]\.about\[1\] repeats "ledger"/);
});

test("a top-level sprout cannot name itself or another sprout in about", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: x }
beans: []
sprouts:
  - slug: s
    kind: log
    date: 2026-09-13
    about: [t]
    name: { en: S }
    description: { en: x }
  - slug: t
    kind: log
    date: 2026-09-13
    about: [krabs]
    name: { en: T }
    description: { en: x }
`);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /sprouts\[0\]\.about\[0\] "t" names nothing in this file/);
});

test("sprouts: must be a list, and may be omitted", () => {
  const head = `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: x }
beans: []
`;
  const omitted = parseManifest(head);
  assert.equal(omitted.ok, true);
  if (omitted.ok) assert.deepEqual(omitted.manifest.sprouts, []);
  const notList = parseManifest(`${head}sprouts: nope\n`);
  assert.equal(notList.ok, false);
  if (!notList.ok) assert.match(notList.error, /sprouts must be a list/);
});
```

(The pod-slug collision case — a sprout `about: [krabs]` where `krabs` is both the pod and a bean — cannot arise: `findDuplicateSlug` refuses one slug for two entities first.)

- [ ] **Step 2: Run, expect failures** — `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-manifest.test.ts`. The refitted fixtures fail (`sprouts` under a bean still parses; top-level `sprouts` is ignored and `result.manifest.sprouts` is undefined), and the new tests fail.

- [ ] **Step 3: Change the types**

```ts
export interface ManifestSprout {
  slug: string;
  /** A member of `SPROUT_KINDS` — never the free string `type` used to be. */
  kind: SproutKind;
  date: string;
  /**
   * What the entry is ABOUT, as PREFIXED refs (`pod:<slug>` / `bean:<slug>`),
   * resolved by the parser from the bare slugs the author wrote against the
   * pod and beans of the same file. The storage grammar (`Sprout.about`), so
   * the applier writes it verbatim and `resolveSproutPlant` derives the plant.
   */
  about: string[];
  name: Text;
  description: Text;
  content?: Text;
  /** Images rendered in the sprout's body, in order. */
  media?: ManifestImage[];
}

export interface ManifestBean {
  slug: string;
  name: Text;
  description: Text;
  /** The bean's narrative — what it is now and how it got there — same rules as a pod's. */
  content?: Text;
  /** The one image on the bean's card and page head. */
  cover?: ManifestImage;
}

export interface GardenManifest {
  pod: ManifestPod;
  beans: ManifestBean[];
  /** The journal: every entry in the file, each ABOUT the pod and/or beans above it. */
  sprouts: ManifestSprout[];
}
```

- [ ] **Step 4: `buildSprout` takes the file's slugs and resolves `about`**

Change the signature to `buildSprout(raw, where, slugs: FileSlugs)` with

```ts
/** The names a sprout's `about` may use: the file's own pod and beans. */
interface FileSlugs {
  pod: string;
  beans: Set<string>;
}
```

and, after the `kind`/`digest` checks and before the date, add:

```ts
  // `about` is REQUIRED: a sprout is a journal entry about something, and an
  // entry about nothing would derive no plant and be dropped by `filterPublic`
  // with nothing failing. The author writes BARE slugs from this file — the
  // pod's, or a bean's — and the parser prefixes them, so the shorthand stays
  // short and the storage grammar stays the one `Sprout.about` has. A prefixed
  // value is refused rather than accepted: two spellings for one thing is how
  // a manifest written against the storage shape drifts from this one. A slug
  // the file does not define is refused here, not at planting — against the
  // SAME file, which is the one thing the author can see.
  if (raw.about === undefined) {
    return {
      ok: false,
      error: `${where}.about is required — a list of the slugs (from this file) the entry is about: the pod "${slugs.pod}"${slugs.beans.size ? ` or a bean (${[...slugs.beans].join(", ")})` : ""}`,
    };
  }
  if (!Array.isArray(raw.about)) return { ok: false, error: `${where}.about must be a list of slugs` };
  if (raw.about.length === 0) return { ok: false, error: `${where}.about must name at least one slug from this file` };
  const about: string[] = [];
  const seenAbout = new Set<string>();
  for (let k = 0; k < raw.about.length; k += 1) {
    const value = raw.about[k];
    const awhere = `${where}.about[${k}]`;
    if (typeof value !== "string") return { ok: false, error: `${awhere} must be a slug (got ${JSON.stringify(value)})` };
    if (value.includes(":")) {
      return { ok: false, error: `${awhere} "${value}" is a bare slug here — write ${value.slice(value.indexOf(":") + 1)}; the parser prefixes it` };
    }
    if (seenAbout.has(value)) return { ok: false, error: `${awhere} repeats "${value}"` };
    seenAbout.add(value);
    if (value === slugs.pod) about.push(`${POD_PREFIX}${value}`);
    else if (slugs.beans.has(value)) about.push(`${BEAN_PREFIX}${value}`);
    else {
      const beans = slugs.beans.size ? [...slugs.beans].join(", ") : "(none)";
      return { ok: false, error: `${awhere} "${value}" names nothing in this file — the pod is "${slugs.pod}" and the beans are ${beans}` };
    }
  }
```

Put `about` into the `ManifestSprout` literal (`slug, kind, date, about, name, description`). Import `BEAN_PREFIX, POD_PREFIX` from `./data` (type-only imports from `./data` already exist there — check whether `lib/garden-manifest.ts` may import a VALUE from `lib/data.ts`; it already imports `isTimelineDate` from `./sprout-date` and vocabulary from `./sprout-kind`; `lib/data.ts` opens with `node:fs`, which is fine for a module the CLI and admin use — confirm nothing in `lib/server-safe-source.test.ts` lists `lib/garden-manifest.ts`; it does not).

- [ ] **Step 5: `buildBean` refuses the nested key by name and stops reading sprouts**

Replace the `sproutsRaw` block in `buildBean` with:

```ts
  // The pre-slice-four shape, refused BY NAME before anything else is read:
  // a manifest nesting its sprouts under beans would otherwise parse with the
  // sprouts silently ignored — the author believes the journal landed and the
  // garden has none of it. Same `in` test as `type` on a sprout: a `sprouts:`
  // with an empty list is still the old key, typed by an author who meant it.
  if ("sprouts" in raw) {
    return {
      ok: false,
      error: `${where}.sprouts is not a key any more — sprouts are a top-level \`sprouts:\` list beside \`beans:\`, each with \`about: [${str(raw.slug) || "<bean-slug>"}]\` naming the pod or the beans it is about`,
    };
  }
```

and build the bean without `sprouts`.

- [ ] **Step 6: `buildManifest` reads the top-level list after the beans**

After the beans loop and BEFORE `findDuplicateSlug`:

```ts
  const sproutsRaw = root.sprouts ?? [];
  if (!Array.isArray(sproutsRaw)) return { ok: false, error: "sprouts must be a list" };
  const slugs: FileSlugs = { pod: podResult.pod.slug, beans: new Set(beans.map((b) => b.slug)) };
  const sprouts: ManifestSprout[] = [];
  for (let i = 0; i < sproutsRaw.length; i += 1) {
    const s = sproutsRaw[i];
    const where = `sprouts[${i}]`;
    if (!isMapping(s)) return { ok: false, error: `${where} must be a mapping` };
    const result = buildSprout(s, where, slugs);
    if (!result.ok) return { ok: false, error: result.error };
    sprouts.push(result.sprout);
  }

  const dupError = findDuplicateSlug(podResult.pod, beans, sprouts);
  if (dupError) return { ok: false, error: dupError };

  return { ok: true, manifest: { pod: podResult.pod, beans, sprouts } };
```

`findDuplicateSlug(pod, beans, sprouts)` claims the pod, each bean, then each sprout at `sprouts[j]`. Its docblock's "Pod, beans and sprouts share ONE slug namespace" stays true; add one sentence: the namespace is also what makes `about` unambiguous — a bare slug names exactly one thing.

Note on ordering: `about` is resolved against the beans parsed so far, which is all of them, because the sprouts list is parsed after the beans. A sprout cannot name another sprout (the test above pins it): `about` is pod/bean only, as in storage.

- [ ] **Step 7: Run the test file** → all pass. `npx tsc --noEmit` will now FAIL in `lib/garden-plan.ts`, `lib/plant-garden-apply.ts`, `lib/garden-assets.ts` and their tests — expected; Tasks 2–3 fix them. Do not commit a red tsc: fold Task 2 into this commit if you prefer one green commit, or commit now with the message below and make Task 2's commit immediately after (the branch is squash-merged). Prefer the single green commit: finish Task 2 first, then commit both together as "Manifest: sprouts are a top-level list with about; the nested shape is refused by name".

---

### Task 2: The plan, the applier and the assets collector read `manifest.sprouts`

**Files:**
- Modify: `lib/garden-plan.ts`, `lib/garden-plan.test.ts`
- Modify: `lib/plant-garden-apply.ts`
- Modify: `lib/garden-assets.ts`, `lib/garden-assets.test.ts`
- Modify: `lib/plant-garden.test.ts` (fixture only; DB test the controller runs)

- [ ] **Step 1: `PlanAction` for a sprout carries no `parentSlug`**

```ts
export type PlanAction =
  | { action: Verb; tier: "pod"; slug: string; entry: ManifestPod; narrativeKept?: true }
  | { action: Verb; tier: "bean"; slug: string; entry: ManifestBean; parentSlug: string; narrativeKept?: true }
  | { action: Verb; tier: "sprout"; slug: string; entry: ManifestSprout };
```

Update the docblock: `parentSlug` is REQUIRED on a bean and ABSENT on the pod AND on a sprout — a sprout is not contained, it is ABOUT (`entry.about`), and the applier writes that list verbatim. Rewrite the ORDER note at the top of the file: `planGarden` emits the pod, then every bean, then every sprout, in manifest order — a sprout's `about` names beans, so every bean it names has been created before it is written (the same reason a bean follows its pod).

In `planGarden`, delete the inner `for (const sprout of bean.sprouts)` loop and add after the beans loop:

```ts
  for (const sprout of manifest.sprouts) {
    actions.push({
      action: verbFor(sproutSlugs.has(sprout.slug), opts.update),
      tier: "sprout",
      slug: sprout.slug,
      entry: sprout,
    });
  }
```

`renderPlan`: keep the indent map, but a sprout line now also says what it is about, so a human approving the plan sees the anchor: `${INDENT[a.tier]}${a.action.padEnd(6)} ${a.tier} ${a.slug}${a.tier === "sprout" ? ` about ${a.entry.about.join(", ")}` : ""}${narrativeKept…}`.

- [ ] **Step 2: Refit `lib/garden-plan.test.ts`**

Move the fixtures' nested sprouts to top-level lists with `about: [bean-a]` / `about: [bean-b]`. The test "ordering interleaves per bean: bean A, sprout A, bean B, sprout B" becomes "ordering: pod, every bean, then every sprout, in manifest order" expecting `["pod krabs", "bean bean-a", "bean bean-b", "sprout sprout-a", "sprout sprout-b"]` (adapt to how the test spells its expectation). The test "parentSlug is set correctly: absent on pod, pod's slug on bean, bean's slug on sprout" becomes "parentSlug: absent on pod and sprout, the pod's slug on a bean; a sprout carries about instead" asserting `"parentSlug" in sproutAction === false` and `sproutAction.entry.about` deep-equals `["bean:bean-a"]`. Add to the `renderPlan` test: the sprout line matches `/sprout sprout-a about bean:bean-a/`.

- [ ] **Step 3: The applier writes `about` verbatim**

In `lib/plant-garden-apply.ts`'s sprout `create` branch replace `about: [\`bean:${action.parentSlug}\`],` with `about: sprout.about,`. Update the module docblock paragraph that says "written once, at creation, from the manifest's own nesting … (`about: ["bean:…"]`)" to: written once, at creation, from the manifest's own `about:` list — the parser resolved the author's bare slugs to `pod:`/`bean:` refs against the same file, so this is the storage grammar verbatim and `resolveSproutPlant` derives the plant through whichever it names. `--update` never rewrites `about`: what an entry is about is editorial, and re-anchoring is the admin's About panel. Check that nothing else in the file reads `parentSlug` off a sprout action (`grep -n parentSlug lib/plant-garden-apply.ts`).

- [ ] **Step 4: Assets**

`collectAssets`: replace the nested loop with a second loop over `manifest.sprouts`:

```ts
  for (const bean of manifest.beans) {
    if (bean.cover && !seen.has(bean.cover.file)) seen.set(bean.cover.file, bean.cover);
  }
  for (const sprout of manifest.sprouts) {
    for (const image of sprout.media ?? []) {
      if (!seen.has(image.file)) seen.set(image.file, image);
    }
  }
```

`assetsNeeded` reads `action.entry.media` on sprout actions — unchanged. Refit the YAML fixture in `lib/garden-assets.test.ts` (nested → top-level with `about: [ledger]` or whatever the bean is called there); the `Sprout` literals there already carry `about: ["bean:ledger"]`.

- [ ] **Step 5: The DB fixture** — in `lib/plant-garden.test.ts` move `test-krabs-import-intro` to a top-level `sprouts:` list with `about: [test-krabs-import]`. The existing assertion `assert.deepEqual(sprout.about, ["bean:test-krabs-import"])` stays as is and now proves the parser's resolution end to end. Do not run this file.

- [ ] **Step 6: Gates** — `npx tsc --noEmit && npx eslint lib scripts && npm test 2>&1 | tail -3` all clean. `grep -rn "\.sprouts" lib scripts --include='*.ts' | grep -v "manifest.sprouts\|garden.sprouts\|raw.sprouts\|\.test\." ` must show no remaining `bean.sprouts` read.

- [ ] **Step 7: Commit** (Tasks 1 + 2 together):

```bash
git add lib/garden-manifest.ts lib/garden-manifest.test.ts lib/garden-plan.ts lib/garden-plan.test.ts lib/plant-garden-apply.ts lib/garden-assets.ts lib/garden-assets.test.ts lib/plant-garden.test.ts
git commit -m "Manifest: sprouts are a top-level list with about; the nested shape is refused by name"
```

---

### Task 3: The plugin skill speaks the new shape

**Files:**
- Modify: `plugins/garden-plant/skills/garden-plant/SKILL.md`
- Modify: `plugins/garden-plant/.claude-plugin/plugin.json` (version `0.3.0` → `0.4.0`; find the file with `grep -rn '"version"' plugins/garden-plant`)

- [ ] **Step 1: Rewrite every sentence and example that nests sprouts under beans.** Specifically, in `SKILL.md`:

  - Frontmatter `description`: "a pod, its beans, and the sprouts hanging from them" → "a pod, its beans, and the journal entries about them".
  - "A project lives there as a **pod** with **beans** hanging off it and **sprouts** hanging off those." → "A project lives there as a **pod** with **beans** hanging off it and a journal of **sprouts**, each about the pod or one of its beans."
  - The four-tiers table's Sprout row: "One dated entry in a project's journal — about the pod, or about one or more of its beans: a log, a milestone, a release."
  - "A manifest writes **one pod, its beans, and their sprouts**." → "…**one pod, its beans, and the sprouts about them**."
  - The paragraph "A sprout nested under a bean is **about** that bean…" → "A sprout is **about** what its `about:` names — the pod, or one or more beans, by their bare slugs from this same file. It is a journal entry, not a child. Its plant is **derived**: through what it is about, to the plant the pod points at. You never write a sprout's plant, and the manifest refuses `parents` on it."
  - The worked example: move both sprouts out of their beans into a top-level `sprouts:` list after `beans:`, each with `about: [ledger-import]` / `about: [krabs-stack]`, and add a third entry about the pod itself (`about: [krabs]`, `kind: essay`, dated, with a short bilingual name and description — write them in the skill's tone, informal "Tu" in French).
  - Notes on the shape: "`sprouts` may be omitted on a bean." → "`sprouts` is a top-level list and may be omitted; every entry needs `about: [...]` — one or more bare slugs from this file, the pod's or a bean's. An entry about the pod alone is how you write about the project rather than a feature."
  - The screenshots example: the `media:` sprout moves to a top-level `sprouts:` entry with `about: [ledger-import]`.
  - "What the validator checks": add a bullet — **`about` names things in this file.** Each value is a bare slug — the pod's or a bean's — and the parser prefixes it. A slug the file does not define, a prefixed value (`bean:ledger`), a repeat, or an empty list is refused by name. A sprout cannot be about another sprout.
  - "Keys the manifest refuses" table: the `parents` row's clause "it is *about* the bean it is nested under" → "it is *about* what its `about:` names"; add a row `sprouts` on a bean | Not a key any more — sprouts are a top-level list, each with its own `about:` naming the pod or the beans it is about. |
  - "Re-running is safe … and not which bean a sprout is about." → "…and not what a sprout is about."
  - "Open a PR … the pod, how many beans, how many sprouts" — unchanged.

- [ ] **Step 2: Bump the plugin version** to `0.4.0` in `plugin.json`.

- [ ] **Step 3: Sweep** — `grep -n "nested\|hanging from them\|hanging off those\|under a bean" plugins/garden-plant/skills/garden-plant/SKILL.md` must show nothing that describes the old shape as current.

- [ ] **Step 4: Commit** — `git add plugins/garden-plant && git commit -m "garden-plant 0.4.0: sprouts are a top-level list, each about the pod or its beans"`

---

### Task 4: Docs

**Files:**
- Modify: `CLAUDE.md` (§"Planting a project from another repo", the bullet "A nested sprout is ABOUT its bean, never under it" ~line 565)
- Modify: `README.md` (`grep -n "garden:plant\|garden-manifest\|Planting" README.md`)
- Modify: `docs/superpowers/specs/2026-10-10-journal-model-design.md` (§3 Doors "Garden manifest" bullet; §5 item 4; §6 last two bullets)
- Modify: `docs/TAXONOMY.md` if it describes the manifest shape (`grep -n "manifest\|garden.yml" docs/TAXONOMY.md`)

- [ ] **Step 1: CLAUDE.md** — rewrite the bullet to the present: **A manifest sprout is ABOUT what its `about:` names, never under anything.** Sprouts are a top-level `sprouts:` list; each `about:` is one or more bare slugs from the same file — the pod's or a bean's — which `lib/garden-manifest.ts` resolves to `pod:`/`bean:` refs against that file and refuses by name when they name nothing, are already prefixed, or repeat. The applier writes the list verbatim and no `parents`, so `resolveSproutPlant` derives the plant through whatever the entry is about. The old shape — `sprouts:` nested under a bean — is refused BY NAME with the new one spelled in the message, because a manifest that nested would otherwise parse with its journal silently dropped. Keep the paragraph's existing warning about `parents: ["bean:…"]` type-checking and deriving no plant. Also in the "Four rules the tests pin" intro sentence, if it counts rules ("Four rules…" vs the number of bullets), leave the count alone unless you add a bullet.

- [ ] **Step 2: README.md** — in the planting section, if it shows or describes the manifest shape or "sprouts under beans", update to the top-level list with `about`. If it only points at the skill, add one sentence: since slice four a manifest's sprouts are a top-level list, each `about:` the pod or its beans by bare slug.

- [ ] **Step 3: The spec** — §3 Doors "Garden manifest" bullet: replace "Moving `sprouts` out of beans … is **slice four**; until then nesting is the shorthand for one ref." with "Since slice four (`plans/2026-10-11-manifest-sprouts.md`) `sprouts` is a top-level list, each with its own `about: [slugs]` resolved against the same file; the nested shape is refused by name." §5 item 4: append " Shipped by `plans/2026-10-11-manifest-sprouts.md`." §6: the bullet "A manifest sprout nested under a bean is written `about` that bean, never under it; the top-level `sprouts` list with its own `about` is slice four." → "A manifest sprout is written with the `about` the parser resolved, never `parents`." and the "Slice four:" bullet loses its prefix.

- [ ] **Step 4: Sweep** — `grep -rn "nested sprout\|nests a sprout\|sprouts hanging\|under a bean" CLAUDE.md README.md docs/TAXONOMY.md plugins` shows nothing describing the old shape as current (the specs and plans are history and keep theirs).

- [ ] **Step 5: Commit** — `git add CLAUDE.md README.md docs/TAXONOMY.md docs/superpowers/specs/2026-10-10-journal-model-design.md && git commit -m "Docs: a manifest's sprouts are a top-level list, each about the pod or its beans"` (only the files that changed).

---

### Task 5: Gates and PR (controller)

- [ ] `npx tsc --noEmit && npx eslint . && npm test` clean.
- [ ] `npm run test:db` (controller only): `lib/plant-garden.test.ts` passes with the refitted fixture.
- [ ] A dry run of the CLI against a manifest in the new shape and one in the old shape, both written to the scratchpad, with `MONGODB_DB=beanstalk_scratch npm run garden:plant -- <file> --dry-run`: the new one prints a plan whose sprout line reads `about bean:…`; the old one is refused by name. (The CLI reads the garden to plan; the scratch database is forced so it is read-only against production in every case.)
- [ ] PR to `main`. Not visitor-facing → no Lab Note, label `no-lab-note`.

---

## Self-review

- Spec §3 Doors: "Moving `sprouts` out of beans to a top-level list on the pod (or plant), each with its own `about: [slugs]` resolved against the same file" — Task 1 (the list is on the file, whose one container is the pod; a manifest never creates a plant, so "or plant" does not arise). "Refused keys stay refused" — `checkForbiddenKeys` untouched.
- §6 "the garden manifest refuses a sprout nested under a bean (the old shape) with a message naming the new one" — Task 1 Step 5 and its test.
- §5 item 4 "Manifest sprouts with `about`, `plugins/garden-plant/` skill text, `/api/synthesis` kind, Lab Note docs" — the synthesis door already writes `kind: "digest"` (Part A, `lib/synthesis-store.ts`), and the Lab Note's `type` → `kind` prefill is documented in README §triage; nothing further to ship for those two, which Task 4 Step 3 may note in the spec's §5 item 4 in one clause.
- Type consistency: `ManifestSprout.about: string[]` (Task 1) read by `renderPlan`, the applier and the tests (Task 2); `GardenManifest.sprouts` (Task 1) read by `planGarden` and `collectAssets` (Task 2); `PlanAction` sprout variant without `parentSlug` (Task 2) — `assetsNeeded` and the CLI touch neither field.
