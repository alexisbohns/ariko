# Bean Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/admin/bean/[id]` the head, rail and sprouts table its sibling entity pages already have, and make name, description, visibility, keyword and tags writable from that head.

**Architecture:** A new client island `BeanHero` renders `components/plant-header.tsx` with no mark, a name-sheet whose body is a server-rendered prop, and three fact popovers posting one field each to one-field server actions. The cover keeps its existing form, moved onto `EntityRail`. The `Versions` card stack becomes the existing `SproutTable`.

**Tech Stack:** Next.js 15 App Router (server components + server actions), React 19, TypeScript, Base UI + shadcn primitives, MongoDB, `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-13-bean-edition-design.md`

**Branch:** `bean-edition` (already checked out, spec already committed).

**Commands you will use:**

- One test file: `npx tsx --test lib/bean-tags.test.ts` — if that fails on this repo, check `package.json`'s `test` script and match whatever it does.
- Everything: `npm test`
- Types: `npx tsc --noEmit`
- Lint: `npm run lint`
- DB-backed: `npm run test:db`

**House rules you must not break** (all four pass `tsc`, `npm test` and `npm run build` when violated):

1. A client island must never import a VALUE from `@/lib/data` — that file opens with `node:fs` and the build fails four modules downstream. Types only, via `import type`.
2. An icon handed from a server page to a client component must come from `app/admin/_components/rail-icons.ts`, never from `lucide-react` directly.
3. Every write action calls `revalidateGarden()` before its redirect.
4. Server actions read `loadRawGarden()`, never `loadCachedGarden()`.

---

## File Structure

**Create:**

- `lib/bean-tags.ts` — pure tag-list shape. Parses the comma field, produces the stored array.
- `lib/bean-tags.test.ts`
- `lib/bean-meta.ts` — pure `BeanMetaPatch` builder + `BlankBeanNameError`.
- `lib/bean-meta.test.ts`
- `app/admin/_components/bean-meta-form.tsx` — server component, the name/description form.
- `app/admin/_components/bean-hero.tsx` — the client island.
- `lib/bean-hero-a11y.test.ts`

**Modify:**

- `lib/plant-visibility.ts` — widen `visibilityOf` to `Pick<Bean | Plant, "visibility">`.
- `lib/plant-visibility.test.ts` — one added assertion.
- `lib/botanical.ts` — `beanMetaUpdate`, `updateBeanMeta`, `updateBeanVisibility`, `updateBeanTags`; amend `updateBeanCover`'s docblock.
- The file that tests `plantMetaUpdate` (find it with `grep -rln "plantMetaUpdate" lib/*.test.ts`) — `beanMetaUpdate` tests.
- `app/admin/actions.ts` — `editBeanMetaAction`, `setBeanVisibilityAction`, `editBeanTagsAction`.
- `app/admin/_components/sprout-table.tsx` — `showBean` prop.
- `app/admin/_components/rail-icons.ts` — export the cover icon.
- `app/admin/(chrome)/bean/[id]/page.tsx` — the rewrite.
- `lib/entity-rail-source.test.ts` — bean page into `RAIL_PAGES`.
- `CLAUDE.md` — two rule amendments.

**Delete:**

- `app/admin/_components/bean-keyword-form.tsx` — its only caller is the page, and the keyword moves into the head's own popover.

---

### Task 1: `lib/bean-tags.ts` — the tag-list shape

**Files:**

- Create: `lib/bean-tags.ts`
- Test: `lib/bean-tags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/bean-tags.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBeanTags } from "./bean-tags";

test("splits on commas and trims every part", () => {
  assert.deepEqual(parseBeanTags("ariko, design ,  code"), ["ariko", "design", "code"]);
});

test("drops blanks, including from trailing and doubled commas", () => {
  assert.deepEqual(parseBeanTags("ariko,,design,"), ["ariko", "design"]);
  assert.deepEqual(parseBeanTags("   "), []);
  assert.deepEqual(parseBeanTags(""), []);
});

test("dedupes, preserving the order each tag was first seen in", () => {
  assert.deepEqual(parseBeanTags("b, a, b, c, a"), ["b", "a", "c"]);
});

test("dedupes CASE-SENSITIVELY, because nothing in the garden folds case on read", () => {
  // lib/sprouts.ts's tag filter compares with === and does not lowercase, so
  // Ariko and ariko are two distinct filter keys. Folding them here would
  // silently delete one of a pair the rest of the system still distinguishes.
  assert.deepEqual(parseBeanTags("Ariko, ariko"), ["Ariko", "ariko"]);
});

test("a parsed tag is always its own trimmed self, which is what the === comparisons need", () => {
  for (const tag of parseBeanTags(" a , b ")) assert.equal(tag.trim(), tag);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx tsx --test lib/bean-tags.test.ts`
Expected: FAIL — `Cannot find module './bean-tags'`.

- [ ] **Step 3: Write the implementation**

Create `lib/bean-tags.ts`:

```ts
/**
 * A bean's tags as a SHAPE — the sibling of `lib/sprout-type.ts`, which does the
 * same job for the other free-form field a head can write.
 *
 * **Client-safe, and it imports nothing at all**, for `lib/sprout-type.ts`'s
 * reason: the tags editor lives in the bean's head, which is a client island,
 * and a value import from `lib/data.ts` (which opens with `node:fs`) fails
 * `npm run build` four modules downstream.
 *
 * THIS FILE IS WHERE THE TAG ARGUMENT LIVES. `editBeanTagsAction` applies it and
 * `updateBeanTags` is protected by it; neither restates it.
 *
 * There is no vocabulary — nothing validates a tag against a list, because a tag
 * is authored free. What there IS, is a shape: `lib/sprouts.ts`'s tag filter
 * compares tags with `===` and does not trim, so a stored `" ariko"` draws
 * identically to `"ariko"` in every badge that renders it and matches NOTHING.
 * The tag would exist, look right, and filter to an empty list. That is the same
 * class of silent bad output `isSproutType` rejects whitespace to avoid.
 *
 * Dedupe is CASE-SENSITIVE on purpose. Nothing in the garden lowercases a tag on
 * read, so `Ariko` and `ariko` are two live filter keys today; folding them here
 * would silently drop one of a pair the rest of the system distinguishes, and a
 * write path is the wrong place to invent a normalisation the read paths do not
 * share.
 */
export function parseBeanTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (tag === "" || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx tsx --test lib/bean-tags.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/bean-tags.ts lib/bean-tags.test.ts
git commit -m "Give a bean's tags a shape

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `lib/bean-meta.ts` — name and description

**Files:**

- Create: `lib/bean-meta.ts`
- Test: `lib/bean-meta.test.ts`
- Read first: `lib/plant-meta.ts` (this is its sibling, minus `status`)

- [ ] **Step 1: Write the failing test**

Create `lib/bean-meta.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBeanMetaPatch, BlankBeanNameError } from "./bean-meta";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test("composes both languages into the stored Text", () => {
  const patch = buildBeanMetaPatch(
    form({
      name: "Timeline",
      nameFr: "Chronologie",
      description: "a feed",
      descriptionFr: "un fil",
    }),
  );
  assert.deepEqual(patch.name, { en: "Timeline", fr: "Chronologie" });
  assert.deepEqual(patch.description, { en: "a feed", fr: "un fil" });
});

test("an en-only or fr-only name is valid (B1), and stays one-sided", () => {
  assert.equal(buildBeanMetaPatch(form({ name: "Timeline" })).name, "Timeline");
  assert.deepEqual(buildBeanMetaPatch(form({ nameFr: "Chronologie" })).name, { fr: "Chronologie" });
});

test("a blank description means CLEAR, and crosses the wire as null", () => {
  // Not an omission: the field belongs to a record that already exists, so
  // omitting the key would silently leave the old description in place and the
  // author would see their deletion ignored.
  assert.equal(buildBeanMetaPatch(form({ name: "Timeline", description: "  " })).description, null);
  assert.equal(buildBeanMetaPatch(form({ name: "Timeline" })).description, null);
});

test("a blank name throws rather than falling back", () => {
  assert.throws(() => buildBeanMetaPatch(form({ name: "  ", nameFr: "" })), BlankBeanNameError);
  assert.throws(() => buildBeanMetaPatch(form({})), BlankBeanNameError);
});

test("whitespace around either part is trimmed off before composing", () => {
  assert.equal(buildBeanMetaPatch(form({ name: "  Timeline  " })).name, "Timeline");
});
```

Before writing the implementation, open `lib/plant-meta.test.ts` and read what `composeText` actually returns for a one-sided pair. If it returns a bare string for en-only and an object for fr-only, the assertions above are right; if it always returns an object, fix the two assertions in the second test to match `composeText`'s real behaviour. Do not change `composeText`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx tsx --test lib/bean-meta.test.ts`
Expected: FAIL — `Cannot find module './bean-meta'`.

- [ ] **Step 3: Write the implementation**

Create `lib/bean-meta.ts`:

```ts
import { composeText, type Text } from "./data";

/**
 * A bean's identity fields — and nothing else.
 *
 * `lib/plant-meta.ts`'s sibling, minus its third field. `slug` is absent for the
 * reason that file gives: it is what every `parents[]` ref points at, so
 * renaming it from a metadata form would orphan every sprout beneath the bean
 * with no cascade to catch it. A slug change stays a manual, deliberate act.
 *
 * There is no hidden-field trap to inherit either. `buildPlantMetaPatch` has to
 * carry `status` because it reads an absent one as `active`, so a form dropping
 * the input silently reactivates an inactive plant; a bean has no status, and
 * its `visibility` travels through its own one-field action rather than riding
 * this patch — a name edit must not be able to publish anything.
 */
export interface BeanMetaPatch {
  name: Text;
  /** `null` MEANS clear, exactly as `PlantMetaPatch.description` does. */
  description: Text | null;
}

export class BlankBeanNameError extends Error {
  constructor() {
    super("a bean needs a name in at least one language");
    this.name = "BlankBeanNameError";
  }
}

/**
 * Pure. Maps the bean's meta form to the stored fields.
 *
 * A blank name THROWS rather than falling back, `buildPlantMetaPatch`'s stance:
 * a nameless bean is a public claim the site would render as though it had been
 * authored. The action turns the throw into an `?error=` redirect.
 */
export function buildBeanMetaPatch(form: FormData): BeanMetaPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const name = composeText(get("name"), get("nameFr"));
  if (name === "") throw new BlankBeanNameError();

  const description = composeText(get("description"), get("descriptionFr"));

  return { name, description: description === "" ? null : description };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx tsx --test lib/bean-meta.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/bean-meta.ts lib/bean-meta.test.ts
git commit -m "Build a bean's meta patch

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Widen `visibilityOf` to the bean

**Files:**

- Modify: `lib/plant-visibility.ts`
- Test: `lib/plant-visibility.test.ts`

- [ ] **Step 1: Add the assertion**

Append to `lib/plant-visibility.test.ts`:

```ts
test("a bean reads the same 'absent means public' rule a plant does", () => {
  // One rule, one file. A lib/bean-visibility.ts holding a second copy of
  // "absent means public" is a copy that drifts from filterPublic's !== private.
  const bean: { slug: string; visibility?: "public" | "private" } = { slug: "a-bean" };
  assert.equal(visibilityOf(bean), "public");
  assert.equal(visibilityOf({ slug: "a-bean", visibility: "private" }), "private");
});
```

- [ ] **Step 2: Run the type check**

Run: `npx tsc --noEmit`
Expected: it may FAIL on assignability, or it may PASS — `{ slug, visibility? }` is structurally compatible with `Pick<Plant, "visibility">`. Either outcome is fine. The widening below is a documentation change as much as a type change, and the test is a regression pin. Proceed to Step 3 regardless.

- [ ] **Step 3: Widen the signature**

In `lib/plant-visibility.ts`, change the import:

```ts
import type { Bean, Plant, Visibility } from "./data";
```

and the function, docblock included:

```ts
/**
 * The one place absence becomes a value, exactly as `statusOf` is for status.
 * `visibility` is optional on both `Plant` and `Bean` and "absent means public"
 * (lib/data.ts), the same rule `filterPublic` reads with `!== "private"`.
 *
 * Widened to the bean when the bean's head grew a visibility control. A
 * `lib/bean-visibility.ts` twin would have been a second copy of one rule, and a
 * copy of a default is a copy that drifts. `PLANT_VISIBILITIES` keeps its name:
 * the vocabulary is the same two members either way, and renaming the constant
 * would move every plant call site for no gain.
 */
export function visibilityOf(entity: Pick<Bean | Plant, "visibility">): Visibility {
  return entity.visibility ?? "public";
}
```

- [ ] **Step 4: Run the checks**

Run: `npx tsx --test lib/plant-visibility.test.ts && npx tsc --noEmit`
Expected: tests PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/plant-visibility.ts lib/plant-visibility.test.ts
git commit -m "Let a bean read the visibility default too

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The three store writers

**Files:**

- Modify: `lib/botanical.ts`
- Test: find the file testing `plantMetaUpdate` with `grep -rln "plantMetaUpdate" lib/*.test.ts` and add to it.

- [ ] **Step 1: Write the failing test for the pure update-doc builder**

Add to that file:

```ts
test("beanMetaUpdate sets the name and unsets a cleared description", async () => {
  const { beanMetaUpdate } = await import("./botanical");
  assert.deepEqual(beanMetaUpdate({ name: "Timeline", description: null }), {
    $set: { name: "Timeline" },
    $unset: { description: "" },
  });
});

test("beanMetaUpdate sets both fields when a description is present", async () => {
  const { beanMetaUpdate } = await import("./botanical");
  assert.deepEqual(beanMetaUpdate({ name: "Timeline", description: "a feed" }), {
    $set: { name: "Timeline", description: "a feed" },
  });
});

test("beanMetaUpdate never emits a duplicate $set key", async () => {
  // The bug plantMetaUpdate exists because of: composing this document inline
  // with a spread produced two $set keys and silently dropped fields.
  const { beanMetaUpdate } = await import("./botanical");
  const doc = beanMetaUpdate({ name: "Timeline", description: "a feed" });
  assert.equal(Object.keys(doc).filter((k) => k === "$set").length, 1);
  assert.ok(!("$unset" in doc), "a present description must not also be unset");
});
```

Match that file's existing import style — if it imports `plantMetaUpdate` at the top rather than dynamically, do the same for `beanMetaUpdate` and drop the `await import`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx tsx --test <that test file>`
Expected: FAIL — `beanMetaUpdate is not a function`.

- [ ] **Step 3: Add the builder and the three writers**

In `lib/botanical.ts`, add the import:

```ts
import type { BeanMetaPatch } from "./bean-meta";
```

Then add, next to `updateBeanKeyword`:

```ts
/**
 * Pure. A bean's meta patch to the update document.
 *
 * Extracted rather than composed inline for `plantMetaUpdate`'s reason, which is
 * a bug that actually shipped: a spread over a conditional produced TWO `$set`
 * keys, the second silently winning, and two of three fields never reached the
 * database. A second two-field writer must not re-earn that.
 *
 * A null description is an `$unset`, not a stored `""`: the meta sheet must be
 * able to REMOVE a description, and an empty string renders as a dangling line
 * wherever the bean is listed.
 */
export function beanMetaUpdate(patch: BeanMetaPatch): Record<string, unknown> {
  return patch.description === null
    ? { $set: { name: patch.name }, $unset: { description: "" } }
    : { $set: { name: patch.name, description: patch.description } };
}

/**
 * A bean's name and description — and nothing else.
 *
 * A SIBLING of `updatePlantMeta`. The fields are named explicitly rather than
 * spread, so a later, widened caller cannot reach `visibility`, `cover`,
 * `keyword`, `tags` or `parents` from a form that has no business touching them.
 * `slug` is not among them either — it is what every sprout's `parents[]` points
 * at.
 */
export async function updateBeanMeta(slug: string, patch: BeanMetaPatch): Promise<void> {
  const db = await getDb();
  await db
    .collection<Bean>("beans")
    .updateOne({ slug }, beanMetaUpdate(patch) as UpdateFilter<Bean>);
}

/**
 * Writes a bean's visibility — and nothing else.
 *
 * NO CASCADE, in either direction, and that is `updatePlantVisibility`'s
 * argument one tier down. Downward privacy is a READ-time projection —
 * `filterPublic` drops a private bean's sprouts with it — so going private needs
 * no write beneath. And going public must not silently republish sprouts that
 * were held back on their own terms: a sprout's `state` is the thing that
 * cascades UPWARD, and this flip must not be able to run that machinery
 * backwards.
 */
export async function updateBeanVisibility(slug: string, visibility: Visibility): Promise<void> {
  const db = await getDb();
  await db.collection<Bean>("beans").updateOne({ slug }, { $set: { visibility } });
}

/**
 * Writes a bean's tags — and nothing else. An empty list CLEARS.
 *
 * The FOURTH copy of the one-field `$set`/`$unset` shape (`updatePlantLogo`,
 * `updateBeanCover`, `updateBeanKeyword`), and `updateBeanCover`'s docblock said
 * a fourth should trigger an extraction. It stays a copy, and that docblock now
 * records why: the same paragraph already argues that a helper generic over both
 * document type and field key lands back at an `as UpdateFilter<T>` cast, and
 * that cast silences `$set`'s value-type checking. `plantMetaUpdate`'s
 * extraction was worth its cast because it fixed a bug that had shipped;
 * extracting THIS one would introduce the class of bug five literal lines
 * currently make impossible.
 *
 * `$unset` rather than a stored `[]`, so an absent tag list has ONE
 * representation and every reader only has to handle `tags === undefined`.
 */
export async function updateBeanTags(slug: string, tags: string[]): Promise<void> {
  const db = await getDb();
  await db
    .collection<Bean>("beans")
    .updateOne({ slug }, tags.length === 0 ? { $unset: { tags: "" } } : { $set: { tags } });
}
```

Then amend `updateBeanCover`'s docblock: replace the sentence beginning "If a FOURTH copy of this shape appears, the move is `lib/plant-meta.ts`'s" with:

```
 * A fourth copy DID appear — `updateBeanTags`, in the bean-edition slice — and
 * it stayed a copy. The extraction this paragraph used to prescribe is the one
 * the paragraph above argues against for exactly this shape: generic over
 * document type and field key means a cast, and the cast silences the value-type
 * checking that is the whole reason these five lines are written out. The rule
 * that survives is the narrower one: extract when a builder can be typed
 * WITHOUT a cast, as `plantMetaUpdate` and `beanMetaUpdate` are.
```

- [ ] **Step 4: Run the checks**

Run: `npx tsx --test <that test file> && npx tsc --noEmit`
Expected: PASS, no type errors. If `tsc` complains about `{ $set: { tags } }`, do NOT add a cast — check that `Bean.tags` is `string[] | undefined` and that the literal matches it. The absent cast is the point: with one, `{ $set: { tags: "oops" } }` would compile.

- [ ] **Step 5: Commit**

```bash
git add lib/botanical.ts lib/*.test.ts
git commit -m "Write a bean's meta, visibility and tags

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The three server actions

**Files:**

- Modify: `app/admin/actions.ts`
- Read first: `editPlantMetaAction` (the error-redirect shape), `editBeanKeywordAction` (the projected re-check), `flipPlantField` (the enum shape).

- [ ] **Step 1: Add the imports**

At the top of `app/admin/actions.ts`, extend the existing import groups. Several of these names are likely already imported — merge rather than duplicate:

```ts
import { buildBeanMetaPatch, BlankBeanNameError, type BeanMetaPatch } from "@/lib/bean-meta";
import { parseBeanTags } from "@/lib/bean-tags";
import { isVisibility } from "@/lib/plant-visibility";
import { updateBeanMeta, updateBeanTags, updateBeanVisibility } from "@/lib/botanical";
```

- [ ] **Step 2: Add the three actions**

Add after `editBeanKeywordAction`:

```ts
/**
 * The bean's name and description — and nothing else.
 *
 * `editPlantMetaAction`'s shape exactly, minus the status it has to carry.
 * Existence is checked FIRST so the error redirect below can only ever target a
 * real page and can only interpolate a known-good stored slug.
 */
export async function editBeanMetaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/sprouts");

  const back = `/admin/bean/${encodeURIComponent(slug)}`;
  // A projected bean is source-owned and read-only. The page renders no trigger
  // for it, but a rendered gate is not a server-side guarantee — the same reason
  // editBeanCoverAction re-checks, and the same reason buildBeanCoverPatch checks
  // `cover__ready`.
  if (existing.projected) redirect(back);

  let patch: BeanMetaPatch;
  try {
    patch = buildBeanMetaPatch(formData);
  } catch (err) {
    if (!(err instanceof BlankBeanNameError)) throw err;
    redirect(`${back}?form=meta&error=${encodeURIComponent(`could not save: ${err.message}`)}`);
  }

  await updateBeanMeta(slug, patch);

  revalidateGarden();
  redirect(back);
}

/**
 * The bean's visibility — and nothing else.
 *
 * A named member of a vocabulary, RE-VALIDATED here rather than trusted, which
 * is what makes a stale page harmless: it can only ever post a value
 * `lib/plant-visibility.ts` already has. The head draws the members as radios
 * behind a Save, so nothing flips on the click that opens it.
 *
 * Not routed through `flipPlantField` above: that helper redirects to
 * `/admin/plant/...` and looks the slug up in `raw.plants`. A bean is a different
 * collection and a different address, and a helper generic over both would need
 * four parameters to say so.
 */
export async function setBeanVisibilityAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/sprouts");

  const back = `/admin/bean/${encodeURIComponent(slug)}`;
  if (existing.projected) redirect(back);

  const value = String(formData.get("visibility") ?? "").trim();
  if (!isVisibility(value)) {
    redirect(
      `${back}?form=visibility&error=${encodeURIComponent(
        `unknown visibility: ${value || "(blank)"}`,
      )}`,
    );
  }

  await updateBeanVisibility(slug, value);

  revalidateGarden();
  redirect(back);
}

/**
 * The bean's tags — and nothing else.
 *
 * The comma field is parsed by `lib/bean-tags.ts` rather than here: the trim is
 * load-bearing (the garden's tag filters compare with `===` and do not trim, so a
 * stored " ariko" matches nothing while drawing identically) and a rule told in
 * two files is two files that drift.
 *
 * An empty field is a CLEAR, not a rejection. A bean with no tags is an ordinary
 * bean, which is why nothing here throws and there is no error redirect.
 */
export async function editBeanTagsAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/sprouts");

  const back = `/admin/bean/${encodeURIComponent(slug)}`;
  if (existing.projected) redirect(back);

  await updateBeanTags(slug, parseBeanTags(String(formData.get("tags") ?? "")));

  revalidateGarden();
  redirect(back);
}
```

- [ ] **Step 3: Run the cache test, which pins these per-function**

Run: `npx tsx --test lib/garden-cache-source.test.ts && npx tsc --noEmit`
Expected: PASS. That file checks `actions.ts` function by function — a whole-file check would pass on one call out of twenty-five — so a missing `revalidateGarden()` or a `loadCachedGarden` import fails here and nowhere else. If it reports the three new names, the fix is in the action, never in the test.

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts
git commit -m "Accept a bean's meta, visibility and tags

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `BeanMetaForm`, the server-rendered sheet body

**Files:**

- Create: `app/admin/_components/bean-meta-form.tsx`
- Read first: `app/admin/_components/plant-meta-form.tsx` — copy its structure, drop its hidden `status`.

- [ ] **Step 1: Write the component**

```tsx
import { textPart, type Bean } from "@/lib/data";
import { editBeanMetaAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The bean's identity: what it is called and what it is in one line.
 *
 * `plant-meta-form.tsx`'s sibling, and a SERVER component like it — the head that
 * opens it is an island, but the island is the shell, never the write path. That
 * is what keeps `bean-hero.tsx` free of every field name on the bean.
 *
 * No hidden `status` input, unlike the plant's: a bean has no status, and its
 * `visibility` travels through its own one-field action rather than riding this
 * form. A name edit must not be able to publish anything.
 *
 * `slug` is deliberately not a field. It is what every sprout's `parents[]`
 * points at, so renaming it here would orphan everything beneath the bean with
 * no cascade to catch it.
 */
export function BeanMetaForm({ bean }: { bean: Bean }) {
  return (
    <form action={editBeanMetaAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={bean.slug} />

      {/* Prefills use the STRICT textPart — resolveText's fallback would copy the
          fr half into the en box and save it back as en. No `required` on the en
          input: an fr-only name is valid (B1), and the pair is validated as a
          whole server-side by buildBeanMetaPatch. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" defaultValue={textPart(bean.name, "en")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameFr">Name (fr)</Label>
          <Input id="nameFr" type="text" name="nameFr" defaultValue={textPart(bean.name, "fr")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            type="text"
            name="description"
            placeholder="one line, never markdown"
            defaultValue={textPart(bean.description, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionFr">Description (fr)</Label>
          <Input
            id="descriptionFr"
            type="text"
            name="descriptionFr"
            defaultValue={textPart(bean.description, "fr")}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <Button type="submit">Save meta</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `textPart(bean.description, "fr")` complains because `description` is optional, check how `plant-meta-form.tsx` handles the same optionality and match it exactly rather than inventing a third spelling.

- [ ] **Step 3: Commit**

```bash
git add app/admin/_components/bean-meta-form.tsx
git commit -m "Render a bean's meta form

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `BeanHero`, the head

**Files:**

- Create: `app/admin/_components/bean-hero.tsx`
- Read first: `app/admin/_components/sprout-hero.tsx` in full. This is that file's shape, beat for beat — its `Surface` state machine, its `close()`, its two effects and its `FactPopover` are reproduced in behaviour below.

**The constraint that will bite you:** this is a `"use client"` file, so it must NOT import a value from `@/lib/data` — that module opens with `node:fs` and the build fails. Every field arrives as an already-resolved prop (`name`, `description`, `keywordEn`, `keywordFr`, `tags`), computed by the page with `textPart`. `Visibility` may be imported as a TYPE only.

- [ ] **Step 1: Check the icon names exist in this lucide version**

Run: `grep -o "MessageSquareQuote\|Tags\b" node_modules/lucide-react/dist/lucide-react.d.ts | sort -u`
Expected: both printed. If either is missing, substitute a name that IS present (`Quote` for the first, `Tag` for the second) and use it consistently everywhere below.

- [ ] **Step 2: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Globe, Lock, MessageSquareQuote, Tags } from "lucide-react";
import type { Visibility } from "@/lib/data";
import { visibilityLabel } from "@/lib/glyphs";
import { PLANT_VISIBILITIES } from "@/lib/plant-visibility";
import { setBeanVisibilityAction, editBeanKeywordAction, editBeanTagsAction } from "../actions";
import { OverlaySheet } from "./overlay-sheet";
import { PlantHeader } from "@/components/plant-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A bean's head: the name, the one-line description, and the three things a bean
 * IS beyond its prose — a visibility, a cover word, a tag list — as three icons
 * under it.
 *
 * `sprout-hero.tsx`'s shape, on the entity one tier up, and deliberately beat for
 * beat: an author moving between a bean and its sprouts should find the same
 * gestures. The layout is the SAME FILE (`components/plant-header.tsx`).
 *
 * **MARKLESS, and that is a decision rather than an omission.** A bean HAS a
 * cover — but a cover is portrait phone art or a landscape screenshot, and a
 * squircle crop of it is a picture of neither. `plant-header.tsx`'s prop comment
 * draws the line: absent is a statement about the entity, never a mark that
 * failed to load. The cover keeps a full-width panel on the rail, where its real
 * aspect survives.
 *
 * The shell is the exception, never the write path. `metaForm` is server-rendered
 * by the page and handed down, so this file never composes a payload for it; the
 * three it renders itself are real `<form>`s posting one field each.
 *
 * `readOnly` is the projected-bean gate's rendered half. A projected bean is
 * rebuilt from its feed, so every trigger here would offer an edit the next sync
 * discards — and `lib/pollen-store.ts`'s `deleteFeedData` takes the whole
 * document on a full rebuild. The three actions re-check it server-side, because
 * a rendered gate is not a guarantee.
 */

export interface BeanHeroProps {
  slug: string;
  /** Already resolved by the page. This file imports no value from @/lib/data. */
  name: string;
  description: string;
  visibility: Visibility;
  /** The stored keyword, both halves, via STRICT textPart on the page. */
  keywordEn: string;
  keywordFr: string;
  tags: string[];
  /**
   * Whether the stored cover is phone-shaped. Derived by the page from
   * `lib/bean-cover.ts` — the island learns the rule's RESULT, never the rule.
   * The keyword is drawn ONLY on the phone treatment, so a word typed under a
   * landscape screenshot is a silent no-op and the popover says so.
   */
  keywordDrawn: boolean;
  /** Source-owned and rebuildable: every trigger becomes a plain fact. */
  readOnly?: boolean;
  /** A rejected save's message, and which surface it came from. */
  error?: string;
  errorForm?: Surface;
  /**
   * The server-rendered meta form. A prop rather than an import: it is a server
   * component reaching a server action, and passing it down is what keeps this
   * file free of every field name on the bean.
   */
  metaForm: ReactNode;
  /**
   * A fingerprint of everything this head can write, computed by the page from
   * the STORED bean. A successful save redirects to this same route — a soft
   * navigation, so this component keeps its place in the tree and nothing resets
   * itself. The re-render carrying a different fingerprint is the only honest
   * signal that the write landed, so it is what closes the surface. A save that
   * changed nothing leaves it open, which is the truth.
   */
  saved: string;
}

/** The surfaces this head can open, one at a time — tracked in one place rather
 *  than in four independently uncontrolled primitives. */
export type Surface = "meta" | "visibility" | "keyword" | "tags";

export function BeanHero({
  slug,
  name,
  description,
  visibility,
  keywordEn,
  keywordFr,
  tags,
  keywordDrawn,
  readOnly = false,
  error,
  errorForm,
  metaForm,
  saved,
}: BeanHeroProps) {
  const [open, setOpen] = useState<Surface | null>(null);
  const [seenSaved, setSeenSaved] = useState(saved);

  // Controlled, so the primitive cannot infer where focus came from: the sheet is
  // opened from the title and reopened by a rejected save.
  const titleRef = useRef<HTMLButtonElement>(null);

  // A rejected save redirects here with ?form=...&error=... and the field it
  // rejected is behind a closed surface, so the banner would have nowhere to
  // live. Reopen onto it rather than land the author on a page that says nothing
  // went wrong.
  useEffect(() => {
    if (error && errorForm) setOpen(errorForm);
  }, [error, errorForm]);

  // The save signal above.
  useEffect(() => {
    if (saved !== seenSaved) {
      setSeenSaved(saved);
      setOpen(null);
    }
  }, [saved, seenSaved]);

  // A rejected save leaves ?form= and ?error= in the URL and they outlive the
  // surface: close, reload, and the banner comes back about an edit that no
  // longer exists in any field. Dropped with replaceState rather than a router
  // push — this is tidying the URL, not a navigation, and a navigation here would
  // re-render the page under the closing surface.
  const close = (): void => {
    setOpen(null);
    if (typeof window === "undefined" || !window.location.search) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error") && !url.searchParams.has("form")) return;
    url.searchParams.delete("error");
    url.searchParams.delete("form");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  const surface = (next: Surface | null) => (next ? setOpen(next) : close());

  // Every trigger's accessible name states its STORED value, on the control
  // rather than on a visible span (the hover label is CSS). It is the only place
  // a reader learns what these fields currently ARE. lib/bean-hero-a11y.test.ts
  // pins it — replace one with a bare word and the page looks identical and stops
  // saying what it is.
  const labels = {
    visibility: `Visibility: ${visibilityLabel(visibility)}`,
    keyword: `Keyword: ${keywordEn || keywordFr || "none"}`,
    tags: `Tags: ${tags.join(", ") || "none"}`,
  };

  return (
    <TooltipProvider>
      <PlantHeader
        /* No mark. See the docblock, and components/plant-header.tsx's prop
           comment: absent is a statement about the entity. */
        title={
          readOnly ? (
            name
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    ref={titleRef}
                    type="button"
                    onClick={() => setOpen("meta")}
                    className="rounded-lg px-2 py-0.5 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {name}
                  </button>
                }
              />
              <TooltipContent side="bottom">Edit name and description</TooltipContent>
            </Tooltip>
          )
        }
        description={description}
        facts={
          readOnly ? (
            /* A projected bean states its facts as WORDS. An icon is a control,
               and there is nothing here to control. */
            <div className="flex flex-wrap items-center justify-center gap-3 font-heading text-xs text-muted-foreground">
              <span>{labels.visibility}</span>
              <span>{labels.keyword}</span>
              <span>{labels.tags}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {/* Visibility. An ENUM, so it gets the full guard: radios plus a
                  Save disabled until the pick differs from what is stored. A
                  one-click flip is a mis-click away from publishing a bean, and
                  the undo is another mis-click on the same pixel. */}
              <FactPopover
                open={open === "visibility"}
                onOpenChange={(next) => surface(next ? "visibility" : null)}
                error={errorForm === "visibility" ? error : undefined}
                label={labels.visibility}
                icon={visibility === "public" ? Globe : Lock}
                tone={visibility === "private" ? "text-foreground" : undefined}
              >
                <VisibilityForm slug={slug} current={visibility} />
              </FactPopover>

              {/* Keyword and tags. NOT enums — there is no vocabulary to draw as
                  radios — so each is one field and a plain Save. What the author
                  typed is on screen, which is the confirmation the radios
                  otherwise have to manufacture. */}
              <FactPopover
                open={open === "keyword"}
                onOpenChange={(next) => surface(next ? "keyword" : null)}
                label={labels.keyword}
                icon={MessageSquareQuote}
              >
                <KeywordForm slug={slug} en={keywordEn} fr={keywordFr} drawn={keywordDrawn} />
              </FactPopover>

              <FactPopover
                open={open === "tags"}
                onOpenChange={(next) => surface(next ? "tags" : null)}
                label={labels.tags}
                icon={Tags}
              >
                <TagsForm slug={slug} tags={tags} />
              </FactPopover>
            </div>
          )
        }
      />

      <OverlaySheet
        open={open === "meta"}
        onOpenChange={(next) => surface(next ? "meta" : null)}
        label="Edit bean meta"
        finalFocus={titleRef}
      >
        <div className="flex w-full max-w-xl flex-col gap-6">
          <p className="text-center font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
            {name}
          </p>
          {error && errorForm === "meta" ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {metaForm}
        </div>
      </OverlaySheet>
    </TooltipProvider>
  );
}

/**
 * One fact: an icon that opens its editor, and nothing else.
 *
 * `sprout-hero.tsx`'s `FactPopover`, and the same two properties. The icon is a
 * trigger and NOT a submit: the form lives inside the popover, which Base UI
 * unmounts on close, so an abandoned edit is discarded with nothing to reset by
 * hand. An abandoned edit is not a pending write.
 *
 * `aria-label` states the STORED value, on the control rather than on a visible
 * span, because the hover label is CSS.
 */
function FactPopover({
  open,
  onOpenChange,
  label,
  icon: Icon,
  tone,
  error,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: string;
  /**
   * A rejected save's message, when this is the surface it came from. It has to
   * render HERE, beside the field: the page suppresses its own banner exactly
   * when `?form=` names a surface, so without this the message is shown nowhere
   * at all and the author learns only that their click did nothing.
   */
  error?: string;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button type="button" size="icon" variant="ghost" aria-label={label}>
                  <Icon className={`size-4 ${tone ?? "text-muted-foreground"}`} />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="center" className="w-72 text-left">
        {error ? (
          <Alert variant="destructive" role="alert" className="mb-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The visibility vocabulary, drawn as native radios.
 *
 * The words come from `lib/glyphs.ts` and the members from
 * `lib/plant-visibility.ts`, so a visibility reads the same on the admin tables
 * and on this head. The hints are the only new prose, and they exist because what
 * each member DOES is invisible from this page.
 *
 * Not the Base UI RadioGroup: that one submits through a script-populated hidden
 * input, and a real radio is what keeps this form a form.
 */
function VisibilityForm({ slug, current }: { slug: string; current: Visibility }) {
  const [picked, setPicked] = useState<Visibility>(current);

  return (
    <form action={setBeanVisibilityAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />

      <div className="flex flex-col gap-2">
        {PLANT_VISIBILITIES.map((option) => {
          const Icon = option === "public" ? Globe : Lock;
          const id = `bean-visibility-${option}`;
          return (
            <ChoiceLabel key={option} htmlFor={id} className="items-start gap-2.5">
              <NativeRadio
                id={id}
                name="visibility"
                value={option}
                checked={picked === option}
                onChange={() => setPicked(option)}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {visibilityLabel(option)}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {VISIBILITY_HINTS[option]}
                </span>
              </span>
            </ChoiceLabel>
          );
        })}
      </div>

      <div className="flex justify-end">
        {/* Disabled until the pick differs from what is stored. Without it the
            Save is a formality — two clicks that mean what one click meant — and
            the confirmation this popover exists to add is gone. */}
        <Button type="submit" size="sm" disabled={picked === current}>
          Save
        </Button>
      </div>
    </form>
  );
}

const VISIBILITY_HINTS: Record<Visibility, string> = {
  public: "On the public site, with its own page — and its published sprouts with it.",
  private: "Off the public site, and its sprouts leave with it. Nothing above or below is changed.",
};

/**
 * The cover's word, both languages.
 *
 * Bilingual because the words are not language-neutral (Accuracy is Justesse),
 * and because everything else a bean can say already is.
 *
 * No disabled-until-changed guard, unlike `VisibilityForm`. That guard makes a
 * second click a confirmation of a choice the author might not have meant; here
 * the author has typed, and what they typed is on screen.
 */
function KeywordForm({
  slug,
  en,
  fr,
  drawn,
}: {
  slug: string;
  en: string;
  fr: string;
  drawn: boolean;
}) {
  return (
    <form action={editBeanKeywordAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="bean-keyword">Keyword</Label>
        <Input id="bean-keyword" type="text" name="keyword" defaultValue={en} />
        <Label htmlFor="bean-keyword-fr">Keyword (fr)</Label>
        <Input id="bean-keyword-fr" type="text" name="keywordFr" defaultValue={fr} />
        <p className="text-xs leading-snug text-muted-foreground">
          {drawn
            ? "The one word the cover wears. Blank clears it."
            : "This cover isn't phone-shaped, so the word won't be drawn — it shows only on a portrait cover. Saved either way."}
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}

/**
 * The tag list, as one comma-separated field.
 *
 * The parse is `lib/bean-tags.ts`'s, server-side, not this input's: the trim is
 * load-bearing (the garden's tag filters compare with `===` and do not trim) and
 * a rule told in two places is two places that drift. What this field owes the
 * author is only the round trip — what they see is what is stored, joined the
 * same way it will be split.
 */
function TagsForm({ slug, tags }: { slug: string; tags: string[] }) {
  return (
    <form action={editBeanTagsAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="bean-tags">Tags</Label>
        <Input id="bean-tags" type="text" name="tags" defaultValue={tags.join(", ")} />
        <p className="text-xs leading-snug text-muted-foreground">
          Comma-separated. Blank clears them. Case matters: Ariko and ariko are two tags.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. If `tsc` complains about a value import from `@/lib/data`, you have broken house rule 1 — the fix is to make it a prop, never to silence the error.

- [ ] **Step 4: Commit**

```bash
git add app/admin/_components/bean-hero.tsx
git commit -m "Give a bean a head

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Pin the head's accessible names

**Files:**

- Create: `lib/bean-hero-a11y.test.ts`
- Read first: `lib/sprout-hero-a11y.test.ts` — this is that file for the bean, including its docblock's explanation of why the source-reading tests read SOURCE (Base UI portals both the popover and the sheet, so an open one contributes zero bytes to `renderToStaticMarkup`).

- [ ] **Step 1: Write the test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";

/**
 * The bean head's four editors are icon triggers — a title, a globe, a quote, a
 * tag. An icon is not a label, so the only place a reader (a screen reader, or
 * anyone hovering) learns what `visibility`, `keyword` and `tags` currently ARE
 * is each trigger's accessible name.
 *
 * That is what this file pins, and it is easy to lose by accident: the accessible
 * name is set on the control, not on a visible span (the hover label is CSS), so
 * nothing on screen changes if someone replaces `Visibility: Public` with a bare
 * `Visibility`. The page would look identical and would stop saying what it is.
 *
 * `lib/plant-hero-a11y.test.ts` and `lib/sprout-hero-a11y.test.ts` are the same
 * file for the other two entities; this is the third, which is the point of the
 * head being shared.
 */

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

async function hero(overrides: Record<string, unknown> = {}): Promise<string> {
  const { BeanHero } = await import("@/app/admin/_components/bean-hero");
  return render(
    React.createElement(BeanHero, {
      slug: "a-bean",
      name: "A bean",
      description: "one line about it",
      visibility: "public",
      keywordEn: "Timeline",
      keywordFr: "Chronologie",
      tags: ["ariko", "design"],
      keywordDrawn: true,
      metaForm: React.createElement("div", null, "META FORM"),
      saved: "x",
      ...overrides,
    } as any),
  );
}

test("the visibility trigger names the stored visibility", async () => {
  assert.match(await hero({ visibility: "public" }), /aria-label="Visibility: Public"/);
  assert.match(await hero({ visibility: "private" }), /aria-label="Visibility: Private"/);
});

test("the keyword and tags triggers name their stored values", async () => {
  const html = await hero();
  assert.match(html, /aria-label="Keyword: Timeline"/);
  assert.match(html, /aria-label="Tags: ariko, design"/);
});

test("an empty keyword or tag list says so rather than naming nothing", async () => {
  // "Keyword:" with nothing after it reads as a broken label. "none" is the
  // stored value stated, which is what a fact is for.
  const html = await hero({ keywordEn: "", keywordFr: "", tags: [] });
  assert.match(html, /aria-label="Keyword: none"/);
  assert.match(html, /aria-label="Tags: none"/);
});

test("a projected bean renders no trigger at all, but still states its facts", async () => {
  // Source-owned and rebuilt from its feed: every edit offered here is an edit
  // the next sync discards. The three actions re-check this server-side, because
  // a rendered gate is not a guarantee — this pins the rendered half.
  const html = await hero({ readOnly: true });
  assert.ok(!/aria-label="(Visibility|Keyword|Tags):/.test(html), "no field trigger");
  assert.ok(html.includes("Visibility: Public"), "but it still STATES its visibility");
  assert.ok(html.includes("Tags: ariko, design"), "and its tags");
});

test("the name and the description are genuinely server-rendered", async () => {
  // Not a script-off claim — the admin is a JavaScript application. It is a check
  // that BeanHero never grows a "renders nothing until it mounts" guard around
  // content that has nowhere else to live: the name is the page's only h1.
  const html = await hero();
  assert.ok(html.includes("A bean"), "the name must be in the markup");
  assert.ok(html.includes("one line about it"), "the description must be in the markup");
  assert.match(html, /<h1/, "the name must be inside the page's h1");
});

const HERO = "app/admin/_components/bean-hero.tsx";

test("the meta form is rendered from the prop, never composed here", () => {
  // The corollary of the arrangement: the sheet's contents are server-rendered by
  // the page and handed down, so the island knows no field name on the bean.
  // Breaking it is silent — importing BeanMetaForm, or buildBeanMetaPatch to
  // compose a payload here, passes tsc, npm test and npm run build, and the sheet
  // keeps working. What is gone is WHERE the payload is built.
  const text = readFileSync(join(process.cwd(), HERO), "utf8");

  for (const spec of [
    "./bean-meta-form",
    "@/app/admin/_components/bean-meta-form",
    "@/lib/bean-meta",
  ]) {
    assert.ok(
      !text.includes(`from "${spec}"`) && !text.includes(`from '${spec}'`),
      `${HERO} must not import from "${spec}" — the meta form is a prop`,
    );
  }

  // `@/lib/data` reaches this file for the Visibility TYPE and nothing else. A
  // value import from there is both a field-name door and a build failure waiting
  // to happen: lib/data.ts opens with node:fs.
  for (const line of text.split("\n").filter((l) => /from ["']@\/lib\/data["']/.test(l))) {
    assert.match(
      line.trim(),
      /^import type /,
      `${HERO} may import from "@/lib/data" only as a type: ${line.trim()}`,
    );
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx tsx --test lib/bean-hero-a11y.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 3: Commit**

```bash
git add lib/bean-hero-a11y.test.ts
git commit -m "Pin what the bean's head says it is

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `SproutTable` learns `showBean`

**Files:**

- Modify: `app/admin/_components/sprout-table.tsx`

- [ ] **Step 1: Add the prop**

Change the signature:

```tsx
export function SproutTable({
  entries,
  limit,
  showPlant = true,
  showBean = true,
}: {
  entries: TimelineEntry[];
  limit?: number;
  showPlant?: boolean;
  /**
   * Drops the bean column, exactly as `showPlant` drops the plant one and for the
   * identical reason: a column whose value is constant on the page drawing it is
   * a column that says nothing. The bean's own page passes false for both.
   */
  showBean?: boolean;
}) {
```

In the header, replace the bean `TableHead` with:

```tsx
          {showBean ? <TableHead>bean</TableHead> : null}
```

In the body, replace the bean `TableCell` with:

```tsx
            {showBean ? (
              <TableCell className="text-muted-foreground">{e.bean?.slug ?? "—"}</TableCell>
            ) : null}
```

And update the file's docblock sentence about `showPlant` to name both flags:

```
 * `limit`, `showPlant` and `showBean` mean what they mean in `PodTable`: `limit`
 * draws the first n and leaves any "n more" line to the caller, which is the only
 * side that knows the full count; the two flags drop a column the page around the
 * table already answers.
```

- [ ] **Step 2: Run the table's source test and the type check**

Run: `npx tsx --test lib/admin-table-source.test.ts && npx tsc --noEmit`
Expected: PASS. That test pins that this file has no `"use client"`; its `resolveText` value import means a stray directive would fail the build outright, which is the guard the four type-only tables lack.

- [ ] **Step 3: Commit**

```bash
git add app/admin/_components/sprout-table.tsx
git commit -m "Let a sprout table drop the bean column

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: The page

**Files:**

- Modify: `app/admin/_components/rail-icons.ts`
- Modify: `lib/entity-rail-source.test.ts`
- Modify: `app/admin/(chrome)/bean/[id]/page.tsx` (full rewrite)
- Delete: `app/admin/_components/bean-keyword-form.tsx`
- Read first: `app/admin/(chrome)/sprout/[slug]/page.tsx` — the page this one becomes a sibling of.

- [ ] **Step 1: Export the cover icon across the client boundary**

In `app/admin/_components/rail-icons.ts`, change the export line to:

```ts
export { FileCode2, Image, Images, Trash2 } from "lucide-react";
```

Do NOT import `Image` from `lucide-react` in the page — that is the whole reason this file exists. `RailItem.icon` is a `ComponentType` crossing from a server component to a client one, so a bare lucide import puts an unserializable function in the flight payload and the page 500s on every request, while `tsc`, `eslint`, `npm test` and `npm run build` all pass.

- [ ] **Step 2: Add the bean page to `RAIL_PAGES`, and watch it fail**

In `lib/entity-rail-source.test.ts`:

```ts
const RAIL_PAGES = [
  "app/admin/(chrome)/sprout/[slug]/page.tsx",
  "app/admin/(chrome)/bean/[id]/page.tsx",
];
```

Run: `npx tsx --test lib/entity-rail-source.test.ts`
Expected: FAIL — the bean page does not yet use the rail. This is the test leading the page, which is the order that matters here: this file is the ONLY thing in the repo that reports the bare-icon mistake.

- [ ] **Step 3: Check one thing before writing the page**

`beanDetail` resolves `bean.name` to a plain string at build time, so `textPart(bean.name, "fr")` would return `""` for a bean whose name is bilingual — and the meta form's fr box would render empty, so a save would wipe the fr half.

Run: `sed -n '1,40p' lib/bean-detail.ts` and confirm.

If it does resolve the name (it does today), pass the RAW bean to `BeanHero` and `BeanMetaForm`: `const stored = raw.beans?.find((b) => b.slug === id);` and use `stored` for every field, keeping `view` only for `sprouts` and the parents. `notFound()` if `stored` is missing. Do NOT change `beanDetail` — `lib/bean-detail.test.ts` pins that resolution, and the page's error card depends on it too.

The page below is written for that correction, using `stored` throughout.

- [ ] **Step 4: Rewrite the page**

Replace `app/admin/(chrome)/bean/[id]/page.tsx` entirely:

```tsx
import { notFound } from "next/navigation";
import { resolveText, textPart } from "@/lib/data";
import { getFullDataset, loadRawGarden } from "@/lib/store";
import { beanDetail, type BeanDetailView } from "@/lib/bean-detail";
import { beanCoverFor } from "@/lib/bean-cover";
import { visibilityOf } from "@/lib/plant-visibility";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BeanCoverForm } from "@/app/admin/_components/bean-cover-form";
import { BeanHero, type Surface } from "@/app/admin/_components/bean-hero";
import { BeanMetaForm } from "@/app/admin/_components/bean-meta-form";
import { SproutTable } from "@/app/admin/_components/sprout-table";
import { EntityRail, type RailItem } from "@/app/admin/_components/entity-rail";
// Not from lucide-react. `RailItem.icon` crosses into a client component and this
// file is a server one, so the icons have to arrive as client references — see
// _components/rail-icons.ts, which is the whole of that boundary.
import { Image } from "@/app/admin/_components/rail-icons";
import Link from "next/link";
import { resolveLineage, ADMIN_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";

export const dynamic = "force-dynamic";

/**
 * One bean, as a place you come to in order to EDIT it.
 *
 * The sibling of `sprout/[slug]/page.tsx`, and the last entity page to stop being
 * a property dump. What left, and why:
 *
 *  - The **five-row dump** (`bean`, `visibility`, `plant`, `pod`, `tags`). Two of
 *    its rows are now facts you can edit from the head; the other two are the
 *    lineage chrome above, which has said them since the parenting slice.
 *  - The **two cover cards**. The cover is on the rail, where its real aspect
 *    survives; the keyword is a fact in the head, beside the other two.
 *  - The **Versions cards**. "Version" is a word the garden's vocabulary does not
 *    have — they are sprouts, and they are drawn by the same `SproutTable` every
 *    other sprout listing in the admin uses. The per-sprout scalar dump went with
 *    them: it was a debugging surface, and the sprout's own page is one click away
 *    in the first column.
 *
 * The head and the meta form read the STORED bean, not `beanDetail`'s view model:
 * that one resolves `name` to a display string (B1), which is right for the error
 * card above and wrong for a form — an fr name would prefill the en box and save
 * back as en, which is the trap every meta form in this repo documents.
 */
export default async function AdminBeanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; form?: string }>;
}) {
  const { id } = await params;
  const { error, form } = await searchParams;

  let view: BeanDetailView | null = null;
  let failed = false;
  try {
    view = beanDetail(await getFullDataset(), id);
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <article>
        <h1 className="mb-4 font-heading text-2xl font-medium tracking-tight">Bean</h1>
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the bean.</AlertDescription>
        </Alert>
      </article>
    );
  }

  if (!view) notFound();

  const { plant: plantSlug, sprouts } = view;

  // The LIVE garden, per CLAUDE.md's garden rule: the admin reads live, and the
  // chrome is the surface most likely to be looked at right after a rename. "en"
  // rather than a negotiated language — the admin zone is authored in one.
  const raw = await loadRawGarden();

  // The stored bean, unresolved. See the docblock: every write surface reads this
  // one, and only the error card above reads the view model.
  const bean = raw.beans?.find((b) => b.slug === id);
  if (!bean) notFound();

  const lineage = resolveLineage(bean.parents, raw, { lang: "en", hrefs: ADMIN_HREFS });

  // `beanDetail` gives Sprout[]; SproutTable takes TimelineEntry[], because an
  // entry already carries the sprout with its bean and its plant resolved and a
  // row type here would be that entry re-typed. Both parents are already in hand,
  // so the entries are composed rather than re-queried.
  const plant = plantSlug ? (raw.plants?.find((p) => p.slug === plantSlug) ?? null) : null;
  const entries = sprouts.map((sprout) => ({ sprout, bean, plant }));

  /* The keyword is drawn ONLY on the phone treatment, and only an explicit
     PORTRAIT cover reaches it. A landscape screenshot with a keyword typed under
     it is a silent no-op, so the keyword popover says so rather than letting the
     author guess.

     Asked of beanCoverFor rather than re-derived here — portrait-ness is
     lib/bean-cover.ts's rule and stays there, and the island receives only the
     RESULT. The empty sprouts array is safe because an explicit cover
     short-circuits the derivation, and the Boolean(bean.cover) guard is what
     makes that true. */
  const keywordDrawn = Boolean(bean.cover) && beanCoverFor(bean, [])?.kind === "phone";

  // Which surface a rejected save came from — narrowed here rather than trusted.
  // Both halves require the ERROR as well as the name: `?form=` alone is a bare
  // URL anyone can type or a stale link someone kept, and honouring it would open
  // a surface with nothing to explain why. An unknown `?form=` claims no surface,
  // and its message falls through to the page-level banner below.
  const heroForm: Surface | undefined =
    error && (form === "meta" || form === "visibility") ? form : undefined;

  /* A projected bean is source-owned: lib/data.ts's own declaration of the field
     says "read-only in the admin, source-owned, rebuildable", and
     lib/pollen-store.ts's deleteFeedData deletes the whole document on a full
     rebuild — an authored cover, keyword or tag list with it. The head states its
     facts as words instead of triggers, and the rail loses its one panel. Each of
     the four actions re-checks this server-side, because a rendered gate is not a
     guarantee. */
  const readOnly = Boolean(bean.projected);

  const railItems: RailItem[] = readOnly
    ? []
    : [
        {
          id: "cover",
          label: "Cover",
          heading: "Cover",
          icon: Image,
          panel: <BeanCoverForm bean={bean} />,
        },
      ];

  return (
    <>
      <LineageChrome lineage={lineage} as={Link} />
      {/* EntityRail wraps the WHOLE body: the panel is fixed and the page moves
          out from under it, so what moves has to be everything. The parenting
          chrome above floats, so it sits outside. */}
      <EntityRail label="Bean panels" items={railItems}>
        <article className="flex flex-col gap-8">
          <BeanHero
            slug={bean.slug}
            /* Resolved HERE: bean-hero.tsx is a client island and a value import
               from @/lib/data would fail the build (node:fs). */
            name={resolveText(bean.name)}
            description={resolveText(bean.description ?? "").trim()}
            visibility={visibilityOf(bean)}
            /* STRICT textPart on both halves — resolveText's fallback would copy
               the fr keyword into the en box and save it back as en. */
            keywordEn={textPart(bean.keyword, "en")}
            keywordFr={textPart(bean.keyword, "fr")}
            tags={bean.tags ?? []}
            keywordDrawn={keywordDrawn}
            readOnly={readOnly}
            {...(heroForm ? { error, errorForm: heroForm } : {})}
            metaForm={<BeanMetaForm bean={bean} />}
            /* Everything the head can write, as stored. STRICT textPart on both
               halves of each pair, so an fr-only edit still moves the fingerprint
               — resolveText would fall back and hide it. */
            saved={JSON.stringify([
              textPart(bean.name, "en"),
              textPart(bean.name, "fr"),
              textPart(bean.description, "en"),
              textPart(bean.description, "fr"),
              visibilityOf(bean),
              textPart(bean.keyword, "en"),
              textPart(bean.keyword, "fr"),
              (bean.tags ?? []).join(" "),
            ])}
          />

          {bean.projected ? (
            <Alert role="note">
              <AlertDescription>
                Projected from {bean.projected.source} (feed {bean.projected.feedId}) — read-only,
                rebuilt from the feed.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Only an error no surface will show: the head reopens onto a rejected
              meta or visibility save and renders the message inside, so repeating
              it here would say it twice. */}
          {error && !heroForm ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg tracking-tight">
              Sprouts <span className="text-muted-foreground">({sprouts.length})</span>
            </h2>
            {sprouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sprouts yet.</p>
            ) : (
              /* Neither column says anything here: the plant is in the lineage
                 chrome above and the bean is the page. */
              <SproutTable entries={entries} showPlant={false} showBean={false} />
            )}
          </section>
        </article>
      </EntityRail>
    </>
  );
}
```

If `textPart(bean.keyword, "en")` complains that `keyword` is optional, match whatever the repo's other `textPart` call sites do with optional fields — check `sprout/[slug]/page.tsx`'s `textPart(sprout.content, "en")` and `plant-meta-form.tsx`'s `textPart(plant.description, "en")` first.

- [ ] **Step 5: Delete the orphaned form**

```bash
git rm app/admin/_components/bean-keyword-form.tsx
grep -rn "BeanKeywordForm" app lib components
```

Expected: no matches after the delete. If there are, remove them.

- [ ] **Step 6: Run everything**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all green, including `lib/entity-rail-source.test.ts` which failed in Step 2.

- [ ] **Step 7: Look at it in the browser**

Start the dev server and open `/admin/bean/<a real bean slug>`. Verify by hand, because none of this is covered by a test:

1. The title opens the sheet; a blank-name save returns with the message INSIDE the sheet, not on the page.
2. The globe opens radios; Save is disabled until the pick changes; it flips, and the popover closes on the way back.
3. Keyword and tags round-trip, and clearing each one works.
4. The cover panel opens from the rail and the page slides rather than reflows — check at a viewport wider than 1216px, which is where the offset is gated.
5. The sprouts table has four columns and every name links to its sprout.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Rework the bean page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: The rulebook

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Amend the enum rule**

In the bullet beginning "**No enum writes on the click that opens it.**", change "Three fields work this way now" to "Four fields work this way now", add "a bean's `visibility`" to the list of fields, and add this after the sprout's sentence:

```
  A bean's `visibility` is the fourth, and it is the one that does NOT cascade in
  either direction: downward privacy is a read-time projection, and going public
  must not republish sprouts held back on their own terms. `lib/bean-tags.ts`
  joins `lib/sprout-date.ts` and `lib/sprout-type.ts` as a SHAPE module for a
  field with no vocabulary — the garden's tag filters compare with `===` and do
  not trim, so a stored `" ariko"` draws identically to `"ariko"` and matches
  nothing at all.
```

- [ ] **Step 2: Amend the icon-trigger rule**

In the bullet beginning "**An icon trigger names its stored value.**", change "The plant header's five editors and the sprout header's four are icons" to "The plant header's five editors, the sprout header's four and the bean header's four are icons", add `keyword` and `tags` to the list of fields, and add `lib/bean-hero-a11y.test.ts` to the two tests named at the end.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Record the bean's four editors

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: The PR

- [ ] **Step 1: Final full check**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all green. `npm run build` matters here — it is what catches a value import from `@/lib/data` reaching a client island, which `tsc` and `npm test` both pass.

- [ ] **Step 2: DB-backed tests**

Run: `npm run test:db`
Expected: green. This is what exercises `updateBeanMeta`, `updateBeanVisibility` and `updateBeanTags` against a real collection.

- [ ] **Step 3: Open the PR with a Lab Note**

This is user-facing, so CLAUDE.md's gate requires a Lab Note section. Write this body to a file and pass it with `--body-file`:

````markdown
The bean page was the last entity page still shaped like the POC: a heading, a
property dump, two bolted-on cover cards, and a stack of cards headed "Versions" —
a word the garden's vocabulary does not have.

It now has the head, the rail and the table its siblings have. Name, description,
visibility, keyword and tags are all editable from the head; the cover moved to
the rail, where its real aspect survives; the versions are sprouts, in the same
table every other sprout listing draws.

The head is deliberately markless — a bean has a cover, but a cover is portrait
phone art or a landscape screenshot, and a squircle crop of it is a picture of
neither.

Spec: `docs/superpowers/specs/2026-09-13-bean-edition-design.md`

## Lab Note

```yaml
en:
  title: Beans are editable now
  summary: A bean's page finally works like everything else — rename it, write its
    description, set its cover and its word, tag it, and see its sprouts in a
    proper table instead of a stack of cards.
fr:
  title: Les beans sont enfin modifiables
  summary: La page d'un bean fonctionne enfin comme les autres — tu peux le
    renommer, écrire sa description, choisir sa couverture et son mot, le taguer,
    et voir ses sprouts dans un vrai tableau.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
````

```bash
git push -u origin bean-edition
gh pr create --title "Make a bean editable" --body-file <that file>
```

---

## Self-review notes

**Spec coverage:** markless head (T7, T10) · cover on the rail (T10) · keyword as a fact (T7) · visibility with the enum guard (T5, T7) · tags with a shape module (T1, T5, T7) · name and description (T2, T5, T6) · `visibilityOf` widened (T3) · no bean-visibility cascade (T4 docblock) · projected read-only in both halves (T5 actions, T7 `readOnly`, T8 test) · `Versions` to `Sprouts` as `SproutTable` with `showBean` (T9, T10) · `RAIL_PAGES` (T10) · the fourth-copy docblock amendment (T4) · all three new test files (T1, T2, T8) · CLAUDE.md (T11).

**Two things deliberately left for the implementer to verify rather than asserted here**, each called out at the step that depends on it with the fix spelled out: what `composeText` returns for a one-sided pair (T2 Step 1), and `beanDetail`'s resolved `name` emptying the meta form's fr box (T10 Step 3 — the page is already written for the correction).
