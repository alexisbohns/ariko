# Seeds Grow Into Beans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slice three of the journal model (spec `docs/superpowers/specs/2026-10-10-journal-model-design.md` §1.3, §3 Admin "Seed overlay", §5 item 3): a seed in the inbox can grow into a **bean** — title → name, body → content, suggested plant/pod → parents — through a "Grow into a bean" form on the triage page posting to a new `promoteSeedToBeanAction` that writes through `createBean`, and `promotedTo` records the ref.

**Architecture:** One pure builder + validator in `lib/promote.ts` (`buildBeanFromSeed`, `validateBeanFromSeed`), the way `buildSproutInput` / `validateSproutInput` already serve the sprout path, so the form→document mapping is unit-tested and the server action is thin. `createBean` learns to store `content` and its mirrored `relations` at birth (it writes nothing for a blank one). Parent validation reuses `resolveAnchor` from `lib/sprout-anchor.ts`: a pod ref must exist and roll up to the picked plant; with no pod, the plant must exist. `markSeedPromoted` takes a prefixed ref (`sprout:…` / `bean:…`) from now on. The triage page gains a second `<form>` — its own card, its own field names, server-rendered, no island — beside the existing Promote form.

**Tech Stack:** Next.js 15 server actions, React 19 server components, `components/ui/native-controls.tsx` (`NativeSelect`), `node:test` + `node:assert/strict`. `npm run test:db` for the one DB test (the controller runs it; implementers never connect to a database).

---

## Before you start

Worktree `scratchpad/wt-seed-bean`, branch `journal/seed-bean`, off `main` (`d4df691`). `node_modules` is a symlink. Never touch `/Users/alexis/code/ariko`. `.env.local` points at PRODUCTION: never run `npm run test:db`, `next dev` or `next build` from an implementer; `npm test` is unit-only and safe.

One test file: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test <file>`.

Vocabulary: `Seed` (lib/data.ts ~line 330): `{ id, title: Text, body?: LocalizedText, content?: LocalizedText, media, source, suggested?: { plantSlug?, podSlug?, beanSlug?, type?, tags? }, status, promotedTo: string[] }`. `Bean` (lib/data.ts ~178): `{ slug, name, parents, description?, content?, relations?, visibility?, … }`. `Text = string | { en?, fr? }`; `composeText(en, fr)`, `resolveText(text)`, `textPart(text, lang)`, `hasNarrative(text)` in lib/data.ts. `lib/entity-refs.ts`: `extractRefs(content)`, `mergeMirrored(existing, mirrored)`. `lib/sprout-anchor.ts`: `resolveAnchor(refs, plantSlug | null, raw)` → `{ ok: true, anchor } | { ok: false, error }`; given `["pod:x"]` it refuses an unknown pod, a pod with no plant, or a pod whose plant disagrees with `plantSlug`. `lib/botanical.ts`: `NewBean { slug, name, description, podSlug, plantSlug }`, `createBean(input)`, `SlugExistsError`. `lib/seeds.ts`: `markSeedPromoted(id, versionSlug)` (`$addToSet` into `promotedTo`). The existing promote path: `app/admin/actions.ts` `promoteSeedAction` (~line 164) and the page `app/admin/(chrome)/triage/[id]/page.tsx`.

---

### Task 1: `buildBeanFromSeed` and `validateBeanFromSeed`

**Files:**
- Modify: `lib/promote.ts`
- Modify: `lib/promote.test.ts`

- [ ] **Step 1: Failing tests** — append to `lib/promote.test.ts` (merge imports into the existing `./promote` import line; eslint forbids duplicates):

```ts
import { buildBeanFromSeed, validateBeanFromSeed } from "./promote";

const seedWithBody = (): Seed => ({
  id: "s1",
  title: { en: "Karma wallet", fr: "Portefeuille karma" },
  body: { en: "note en", fr: "note fr" },
  content: { en: "# Karma\n\nSee @bean:pbbls-market.", fr: "# Karma fr" },
  media: [],
  source: { kind: "manual", capturedAt: "2026-10-11T00:00:00.000Z" },
  status: "inbox",
  promotedTo: [],
  createdAt: "2026-10-11T00:00:00.000Z",
  updatedAt: "2026-10-11T00:00:00.000Z",
});

function growForm(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

test("buildBeanFromSeed: slug, composed bilingual name and description, the seed's content and its mirrored refs", () => {
  const out = buildBeanFromSeed(
    growForm({ beanSlug: "pbbls-karma", beanName: "Karma", beanNameFr: "Karma fr", beanDescription: "d", beanDescriptionFr: "" }),
    seedWithBody(),
  );
  assert.equal(out.slug, "pbbls-karma");
  assert.deepEqual(out.name, { en: "Karma", fr: "Karma fr" });
  assert.equal(resolveText(out.description), "d");
  assert.deepEqual(out.content, { en: "# Karma\n\nSee @bean:pbbls-market.", fr: "# Karma fr" });
  assert.ok(out.relations && out.relations.length > 0, "the body's entity refs are mirrored at birth");
});

test("buildBeanFromSeed: WYSIWYG — blank name boxes stay blank, nothing is resurrected from the title", () => {
  const out = buildBeanFromSeed(growForm({ beanSlug: "x", beanName: "", beanNameFr: "" }), seedWithBody());
  assert.equal(resolveText(out.name), "");
});

test("buildBeanFromSeed: a seed with no content yields no content and no relations", () => {
  const seed = { ...seedWithBody(), content: undefined };
  const out = buildBeanFromSeed(growForm({ beanSlug: "x", beanName: "N" }), seed);
  assert.equal(out.content, undefined);
  assert.equal(out.relations, undefined);
});

test("validateBeanFromSeed: slug and a name in at least one language are required", () => {
  const ok = buildBeanFromSeed(growForm({ beanSlug: "x", beanNameFr: "Nom" }), seedWithBody());
  assert.deepEqual(validateBeanFromSeed(ok), { ok: true });
  const noSlug = buildBeanFromSeed(growForm({ beanName: "N" }), seedWithBody());
  assert.deepEqual(validateBeanFromSeed(noSlug), { ok: false, error: "bean slug is required" });
  const noName = buildBeanFromSeed(growForm({ beanSlug: "x" }), seedWithBody());
  assert.deepEqual(validateBeanFromSeed(noName), { ok: false, error: "bean name is required" });
});
```

Check the file's existing helpers: if a `Seed` fixture or a `form()` helper already exists at the top, reuse it instead of adding `seedWithBody`/`growForm` (read the first 25 lines). `resolveText` and `Seed` must be imported from `./data` if not already.

- [ ] **Step 2: Run, expect failure** — `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/promote.test.ts` → missing exports.

- [ ] **Step 3: Implement** — append to `lib/promote.ts`:

```ts
// The fields written to a bean grown from a seed (journal model §1.3): a seed
// that is an idea becomes the feature it describes. Structurally the createBean
// input minus the parents, which the action resolves against the live garden.
export interface BeanFromSeed {
  slug: string;
  name: Text;
  description: Text;
  content?: Text; // the seed's body, verbatim — it IS the narrative's first draft
  relations?: Relation[]; // mirrored from that body's entity refs — derived, never authored
}

// Pure. Maps the "Grow into a bean" form + the source seed into a BeanFromSeed.
// Name and description compose from paired en/fr boxes, WYSIWYG exactly as
// `buildSproutInput` does (the page prefills them from the seed's title and
// note; what the boxes submit is what is stored, and a cleared name fails
// validation rather than being resurrected). The seed's `content` is carried
// verbatim and its refs mirrored here, on the write path, for the same reason
// `buildSproutInput` mirrors: the edges are testable rather than buried in an
// action.
export function buildBeanFromSeed(form: FormData, seed: Seed): BeanFromSeed {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const mirrored = mergeMirrored(undefined, extractRefs(seed.content));
  return {
    slug: get("beanSlug"),
    name: composeText(get("beanName"), get("beanNameFr")),
    description: composeText(get("beanDescription"), get("beanDescriptionFr")),
    ...(seed.content ? { content: seed.content } : {}),
    ...(mirrored.length > 0 ? { relations: mirrored } : {}),
  };
}

// Pure guard. "name required" means at least one language, as for a sprout.
export function validateBeanFromSeed(b: BeanFromSeed): { ok: true } | { ok: false; error: string } {
  if (!b.slug) return { ok: false, error: "bean slug is required" };
  if (!resolveText(b.name)) return { ok: false, error: "bean name is required" };
  return { ok: true };
}
```

- [ ] **Step 4: Run** the file → all pass. `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git add lib/promote.ts lib/promote.test.ts && git commit -m "promote: buildBeanFromSeed and validateBeanFromSeed, the pure half of growing a seed into a bean"`

---

### Task 2: `createBean` stores `content` and `relations` at birth

**Files:**
- Modify: `lib/botanical.ts` (`NewBean`, `createBean`, ~lines 108–136)
- Create: `lib/bean-document.test.ts`
- Modify: `lib/botanical.test.ts` (one DB test, run by the controller only)

- [ ] **Step 1: Extract the pure document** — in `lib/botanical.ts`, extend `NewBean`:

```ts
export interface NewBean {
  slug: string;
  name: Text;
  description: Text;
  podSlug: string | null;
  plantSlug: string | null; // used ONLY when podSlug is null — the pod carries the plant otherwise
  content?: Text; // a narrative at birth (a seed grown into a bean); omitted when blank
  relations?: Relation[]; // its mirrored refs; omitted when empty
}
```

and split `createBean`'s document composition into an exported pure function the DB write calls:

```ts
// Pure: the document createBean inserts. Exported so the shape is testable
// without a database — `lib/bean-document.test.ts`. Private at birth; a blank
// description, a blank content and an empty relations list are OMITTED rather
// than stored as "" / [] (an empty field renders as a dangling line, and
// `hasNarrative` reads an absent content as "nothing written", which is true).
export function beanDocument(input: NewBean): Bean {
  const described = resolveText(input.description).trim();
  const narrated = input.content !== undefined && hasNarrative(input.content);
  return {
    slug: input.slug,
    name: input.name,
    parents: input.podSlug ? [`pod:${input.podSlug}`] : input.plantSlug ? [`plant:${input.plantSlug}`] : [],
    ...(described ? { description: input.description } : {}),
    ...(narrated ? { content: input.content } : {}),
    ...(input.relations && input.relations.length > 0 ? { relations: input.relations } : {}),
    visibility: "private",
  };
}

export async function createBean(input: NewBean): Promise<Bean> {
  const db = await getDb();
  const doc = beanDocument(input);
  try {
    await db.collection<Bean>("beans").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("bean", input.slug);
    throw err;
  }
  return doc;
}
```

Import `hasNarrative` and `type Relation` from `./data` if not already imported. Keep the existing comment about the blank description (fold it into the new docblock).

- [ ] **Step 2: Unit test the document** — `lib/bean-document.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { beanDocument } from "./botanical";

const base = { slug: "b", name: "B", description: "", podSlug: null, plantSlug: "p" };

test("beanDocument: private at birth, rooted under the pod when given, else the plant", () => {
  assert.deepEqual(beanDocument({ ...base, podSlug: "pod" }).parents, ["pod:pod"]);
  assert.deepEqual(beanDocument(base).parents, ["plant:p"]);
  assert.equal(beanDocument(base).visibility, "private");
});

test("beanDocument: blank description, blank content and empty relations are omitted, not stored", () => {
  const doc = beanDocument({ ...base, content: { en: "  ", fr: "" }, relations: [] });
  assert.equal("description" in doc, false);
  assert.equal("content" in doc, false);
  assert.equal("relations" in doc, false);
});

test("beanDocument: a narrative and its relations are stored verbatim", () => {
  const relations = [{ kind: "mentions", ref: "bean:x" }];
  const doc = beanDocument({ ...base, description: "d", content: { en: "# Hi" }, relations });
  assert.equal(doc.description, "d");
  assert.deepEqual(doc.content, { en: "# Hi" });
  assert.deepEqual(doc.relations, relations);
});
```

Check `Relation`'s shape in lib/data.ts (`{ kind: string; ref: string }` or similar) and adjust the literal to satisfy tsc.

Run it → pass. (Importing `./botanical` loads `./db`, which imports the mongodb driver but opens no connection until `getDb()` is called — `lib/botanical.test.ts` already imports it the same way.)

- [ ] **Step 3: One DB test, NOT run by the implementer** — in `lib/botanical.test.ts`, next to the existing `createBean` test (find it with `grep -n "createBean" lib/botanical.test.ts`; copy its `{ skip: !hasDb }` option, its cleanup and its slug prefix convention):

```ts
test("createBean stores a narrative and its relations at birth", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const bean = await createBean({
    slug: "__test__grown",
    name: "Grown",
    description: "",
    podSlug: null,
    plantSlug: "__test__plant",
    content: { en: "# Grown\n\nBody." },
    relations: [{ kind: "mentions", ref: "bean:__test__other" }],
  });
  assert.deepEqual(bean.content, { en: "# Grown\n\nBody." });
  const db = await getDb();
  const stored = await db.collection("beans").findOne({ slug: "__test__grown" });
  assert.deepEqual(stored?.content, { en: "# Grown\n\nBody." });
  assert.equal(stored?.relations?.length, 1);
  assert.equal(stored?.visibility, "private");
});
```

Adapt `cleanup`, `getDb` import and the relation literal to what the file already uses. Do not run it. `npx tsc --noEmit` must pass.

- [ ] **Step 4: Commit** — `git add lib/botanical.ts lib/bean-document.test.ts lib/botanical.test.ts && git commit -m "createBean: a narrative and its relations at birth, through a pure beanDocument"`

---

### Task 3: `markSeedPromoted` records a prefixed ref

**Files:**
- Modify: `lib/seeds.ts` (~line 118–127), `lib/data.ts` (`Seed.promotedTo` comment, ~line 339), `lib/seeds.test.ts` (~line 122), `app/admin/actions.ts` (the one call in `promoteSeedAction`, ~line 276)

- [ ] **Step 1:** In `lib/seeds.ts`, rename the parameter and rewrite the comment:

```ts
// Triage: a seed became something. Status flips to "promoted" and the REF of
// what it became — `sprout:<slug>` or `bean:<slug>` (journal model §1.3) — is
// appended; $addToSet keeps it idempotent across re-promotes of the same ref.
// Seeds promoted before 2026-10-11 hold bare sprout slugs here; no reader
// resolves the list, so they are left as written.
export async function markSeedPromoted(id: string, ref: string): Promise<void> {
```

(and `promotedTo: ref` in the `$addToSet`). In `lib/data.ts` change the `promotedTo` comment to `// prefixed refs of what it became ("sprout:…" | "bean:…"); bare sprout slugs before 2026-10-11`. In `app/admin/actions.ts` `promoteSeedAction`, change `await markSeedPromoted(seedId, input.slug);` to `await markSeedPromoted(seedId, \`${SPROUT_PREFIX}${input.slug}\`);` and add `SPROUT_PREFIX` to the `@/lib/data` import (check it is exported: `grep -n "export const SPROUT_PREFIX" lib/data.ts`). In `lib/seeds.test.ts` the DB test "markSeedPromoted sets status and appends the sprout slug": rename to "…appends the ref", pass `"sprout:ver-1"`, `"sprout:ver-1"`, `"bean:b-1"` and expect `["bean:b-1", "sprout:ver-1"]`. Do not run it.

- [ ] **Step 2:** `npx tsc --noEmit && npm test 2>&1 | tail -3` clean.

- [ ] **Step 3: Commit** — `git add lib/seeds.ts lib/data.ts lib/seeds.test.ts app/admin/actions.ts && git commit -m "promotedTo records a prefixed ref: sprout: today, bean: next"`

---

### Task 4: `promoteSeedToBeanAction`

**Files:**
- Modify: `app/admin/actions.ts` (add after `promoteSeedAction`)

- [ ] **Step 1: Write the action**

```ts
// A seed grows into a BEAN (journal model §1.3): title → name, body → content,
// the picked plant/pod → parents. The pure half is `buildBeanFromSeed`; this
// resolves the parents against the live garden and writes once. A pod pick goes
// through `resolveAnchor` exactly as a sprout's `about` does — an unknown pod,
// a pod with no plant, or a pod under a different plant than the one picked is
// refused by name BEFORE the write. With no pod, the plant must exist. The bean
// is private at birth (createBean), so nothing public changes and no cascade
// runs; the author lands on the bean's editor to keep writing.
export async function promoteSeedToBeanAction(formData: FormData): Promise<void> {
  await requireSession();
  const seedId = String(formData.get("seedId") ?? "");
  const seed = await getSeed(seedId);
  if (!seed) redirect("/admin/inbox");
  const back = (error: string) => `/admin/triage/${seedId}?error=${encodeURIComponent(error)}`;

  const bean = buildBeanFromSeed(formData, seed);
  const valid = validateBeanFromSeed(bean);
  if (!valid.ok) redirect(back(valid.error));

  const plantSlug = String(formData.get("plantSlug") ?? "").trim() || null;
  const podSlug = String(formData.get("podSlug") ?? "").trim() || null;
  const raw = await loadRawGarden();
  if (podSlug) {
    const check = resolveAnchor([`${POD_PREFIX}${podSlug}`], plantSlug, raw);
    if (!check.ok) redirect(back(check.error));
  } else if (!plantSlug) {
    redirect(back("pick a plant, or a pod, to root the bean under"));
  } else if (!(raw.plants ?? []).some((p) => p.slug === plantSlug)) {
    redirect(back(`unknown plant ${plantSlug}`));
  }

  let slugError: string | null = null;
  try {
    await createBean({ ...bean, podSlug, plantSlug: podSlug ? null : plantSlug });
    await markSeedPromoted(seedId, `${BEAN_PREFIX}${bean.slug}`);
  } catch (err) {
    if (err instanceof SlugExistsError) slugError = err.message;
    else throw err;
  }
  revalidateGarden();
  if (slugError) redirect(back(slugError));
  redirect(`/admin/bean/${encodeURIComponent(bean.slug)}`);
}
```

Add `buildBeanFromSeed`, `validateBeanFromSeed` to the `@/lib/promote` import; `BEAN_PREFIX`, `POD_PREFIX` are already imported from `@/lib/data` in this file (check; add if not). `requireSession`, `redirect`, `loadRawGarden`, `resolveAnchor`, `createBean`, `SlugExistsError`, `markSeedPromoted`, `revalidateGarden` are already imported.

- [ ] **Step 2: Gates** — `npx tsc --noEmit && npx eslint app/admin/actions.ts && TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-cache-source.test.ts` (the per-function check must see `revalidateGarden()` in the new action — it does).

- [ ] **Step 3: Commit** — `git add app/admin/actions.ts && git commit -m "promoteSeedToBeanAction: a seed grows into a private bean, parents resolved before the write"`

---

### Task 5: The "Grow into a bean" form on the triage page

**Files:**
- Modify: `app/admin/(chrome)/triage/[id]/page.tsx`
- Create: `lib/triage-grow-source.test.ts`

- [ ] **Step 1: Source test first** — `lib/triage-grow-source.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The "Grow into a bean" form and `buildBeanFromSeed` agree on field names by
 * convention only: a renamed input posts nothing, the builder reads "", and
 * the action redirects with "bean name is required" for a form that looks
 * filled in. tsc cannot see across a FormData boundary, so this reads both
 * files and pins every name the builder reads to an input the page renders,
 * and the form to the action it must post to.
 */
const page = readFileSync(join(process.cwd(), "app/admin/(chrome)/triage/[id]/page.tsx"), "utf8");
const promote = readFileSync(join(process.cwd(), "lib/promote.ts"), "utf8");

const FIELDS = ["beanSlug", "beanName", "beanNameFr", "beanDescription", "beanDescriptionFr"];

test("the grow form posts to promoteSeedToBeanAction", () => {
  assert.match(page, /<form action=\{promoteSeedToBeanAction\}/);
});

test("every field buildBeanFromSeed reads is an input on the triage page, and vice versa", () => {
  const growSection = page.slice(page.indexOf("promoteSeedToBeanAction}"));
  for (const name of FIELDS) {
    assert.match(promote, new RegExp(`get\\("${name}"\\)`), `${name} is read by the builder`);
    assert.match(growSection, new RegExp(`name="${name}"`), `${name} is an input in the grow form`);
  }
});

test("the grow form picks its parents with plantSlug and podSlug, the names the action reads", () => {
  const growSection = page.slice(page.indexOf("promoteSeedToBeanAction}"));
  assert.match(growSection, /name="plantSlug"/);
  assert.match(growSection, /name="podSlug"/);
});
```

Run it → fails (no such form yet).

- [ ] **Step 2: The form** — in the page, import `promoteSeedToBeanAction` beside the two existing actions. Between the Promote `</form>` and the Discard `<form>`, add:

```tsx
        {/* The second thing a seed can become (journal model §1.3): a BEAN — the
            feature the idea describes. Its own form, not a second button on the
            one above: the sprout form's `required` fields would block this
            submit, and the two posts share nothing but the seed. Field ids are
            prefixed `grow` so the page's labels stay unique; the NAMES are the
            ones `buildBeanFromSeed` reads (pinned by lib/triage-grow-source.test.ts).
            The seed's title prefills the name per language and its note the
            description; its body becomes the bean's narrative, verbatim, which
            the hint says so the author knows where the prose went. */}
        <form action={promoteSeedToBeanAction} className="flex flex-col gap-6">
          <input type="hidden" name="seedId" value={seed.id} />

          <Fieldset legend="Grow into a bean">
            <p className="text-sm text-muted-foreground">
              The seed becomes a private bean: this title its name, this note its description,
              and its body the first draft of its narrative. Root it under a pod, or a plant.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="growPlantSlug">Plant</Label>
                <NativeSelect id="growPlantSlug" name="plantSlug" defaultValue={seed.suggested?.plantSlug ?? ""}>
                  <option value="">— none —</option>
                  {plants.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.slug}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="growPodSlug">Pod</Label>
                <NativeSelect id="growPodSlug" name="podSlug" defaultValue={seed.suggested?.podSlug ?? ""}>
                  <option value="">— none —</option>
                  {pods.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.slug}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="growBeanSlug">Slug</Label>
              <Input id="growBeanSlug" type="text" name="beanSlug" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="growBeanName">Name</Label>
                <Input id="growBeanName" type="text" name="beanName" defaultValue={textPart(seed.title, "en")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="growBeanNameFr">Name (fr)</Label>
                <Input id="growBeanNameFr" type="text" name="beanNameFr" defaultValue={textPart(seed.title, "fr")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="growBeanDescription">Description</Label>
                <Input id="growBeanDescription" type="text" name="beanDescription" defaultValue={textPart(seed.body, "en")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="growBeanDescriptionFr">Description (fr)</Label>
                <Input id="growBeanDescriptionFr" type="text" name="beanDescriptionFr" defaultValue={textPart(seed.body, "fr")} />
              </div>
            </div>
          </Fieldset>

          <div>
            <Button type="submit" variant="secondary">Grow into a bean</Button>
          </div>
        </form>
```

Check the existing pod `<option>` loop's variable name and copy its exact shape. Check `textPart` accepts `seed.body` (a `LocalizedText | undefined`): if its parameter is `Text | undefined`, fine.

- [ ] **Step 3: Gates** — the source test passes; `npx tsc --noEmit && npx eslint "app/admin/(chrome)/triage" lib/triage-grow-source.test.ts && npm test 2>&1 | tail -3`.

- [ ] **Step 4: Commit** — `git add "app/admin/(chrome)/triage/[id]/page.tsx" lib/triage-grow-source.test.ts && git commit -m "Triage: a seed can grow into a bean — its own form beside Promote, field names pinned"`

---

### Task 6: Docs

**Files:**
- Modify: `README.md` (§`/admin/triage/[id]`, ~line 339), `docs/superpowers/specs/2026-10-10-journal-model-design.md` (§5), `CLAUDE.md` only if it describes triage (grep `triage`)

- [ ] **Step 1:** In README's `/admin/triage/[id]` section, add a paragraph: the page has two forms. **Promote** writes a sprout (and optionally a new pod/bean under it) as before. **Grow into a bean** (journal model §1.3) writes a private bean through `createBean`: the seed's title becomes its name, its note its description, its body its narrative's first draft with entity refs mirrored, rooted under the picked pod (checked through `resolveAnchor` to roll up to the picked plant) or plant; the author lands on `/admin/bean/[id]` to keep writing. `promotedTo` records `bean:<slug>` (and, from this slice, `sprout:<slug>` for the other door). Match the voice of the surrounding section.

- [ ] **Step 2:** In the spec §5 list item 3 ("Seeds grow into beans"), append: " — shipped by `plans/2026-10-11-seed-to-bean.md`."

- [ ] **Step 3:** `grep -n "triage\|promotedTo" CLAUDE.md docs/TAXONOMY.md` — update any sentence the change made false (e.g. "a seed becomes a sprout" as the only outcome, or `promotedTo` as "sprout slugs").

- [ ] **Step 4: Commit** — `git add README.md docs/superpowers/specs/2026-10-10-journal-model-design.md CLAUDE.md docs/TAXONOMY.md && git commit -m "Docs: a seed grows into a bean"` (only the files that changed).

---

### Task 7: Gates and PR (controller)

- [ ] `npx tsc --noEmit && npx eslint . && npm test` clean.
- [ ] `npm run test:db` (controller only, scratch database forced by the script): the two touched DB tests (`createBean stores a narrative…`, `markSeedPromoted … appends the ref`) pass.
- [ ] PR to `main`, base `d4df691`. Admin-only change → **no Lab Note**, label `no-lab-note`.

---

## Self-review

- §1.3: "a seed may grow into a bean (title → name, body → content, suggested plant/pod → parents) … `promotedTo` records either ref" — Tasks 1 (title/body), 4 (parents from the picked plant/pod, prefilled from `suggested`), 3 (ref).
- §3 Admin "Seed overlay: a 'Grow into a bean' action beside 'Promote', posting to a new `promoteSeedToBeanAction` that writes through `createBean`" — Tasks 4, 5. The spec says "action beside Promote"; this plan makes it a second form directly below the Promote form's button, because a second submit button in the sprout form would be blocked by that form's `required` fields and would post sprout fields a bean never reads. Same place on the page, honest shape.
- CLAUDE.md "a manifest cannot publish / private at birth" — the bean is private at birth and no cascade runs.
- Type consistency: `BeanFromSeed { slug, name, description, content?, relations? }` (Task 1) spreads into `NewBean` (Task 2) with `podSlug`/`plantSlug` added in Task 4. `markSeedPromoted(id, ref)` (Task 3) called with `BEAN_PREFIX` in Task 4 and `SPROUT_PREFIX` in Task 3. Field names `beanSlug`, `beanName`, `beanNameFr`, `beanDescription`, `beanDescriptionFr`, `plantSlug`, `podSlug` in Tasks 1, 4, 5.
