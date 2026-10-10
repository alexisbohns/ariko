# Bean Narrative (journal model, slice one) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bean carries one evolving narrative (`content`), edited in the admin with the pod's prose editor, read on the public bean page, writable by `/api/articles` and the garden manifest, and back-filled by folding the 17 `type:"article"` sprouts into their beans.

**Architecture:** `Bean` gains `content?: Text` and `relations?: Relation[]` exactly as `Pod` has them; `filterPublic` scrubs bean relations like pod relations. The write path is one new `updateBeanContent` wrapper plus a `bean:` branch in the existing `editContainerContentAction`, so the `?lang=` rule arrives for free through `ContentCard`. The public bean page reads `bean.content` first and falls back to `articleFor` until slice two deletes the fallback. A pure `lib/journal-migration.ts` plans the article fold; `scripts/migrate-journal.ts` applies it, dry by default.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, MongoDB driver, `node:test` (`npm test` for unit, `npm run test:db` for DB-backed, serial, scratch DB).

**Spec:** `docs/superpowers/specs/2026-10-10-journal-model-design.md` §1.1, §3 (bean page, admin bean page, `/api/articles`, manifest `bean.content`), §4 step 2, §5 slice 1.

**Working rules for every task** (from CLAUDE.md and the repo's memory):
- Work in a git worktree, never build or clear `.next` in `/Users/alexis/code/ariko` (the dev server shares it). Run `npm test` and `npx tsc --noEmit` in the worktree. `npm run test:db` targets `beanstalk_scratch` by default and needs `.env.local` copied into the worktree.
- Tests are `node:test` + `node:assert/strict`. Unit files match `lib/**/*.test.ts(x)`; a DB-backed file must ALSO be appended to the `test:db` script in `package.json` or it never runs.
- Commit after each task with a one-line imperative subject and the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| file | change |
|---|---|
| `lib/data.ts` | `Bean.content?`, `Bean.relations?`; scrub bean relations in `filterPublic` |
| `lib/data.test.ts` (new or existing filterPublic test file) | bean relations scrubbed |
| `lib/botanical.ts` | `updateBeanContent` |
| `lib/content-store.test.ts` | bean content write touches content + relations only |
| `lib/garden-cache-source.test.ts` | classify `updateBeanContent` as a writer |
| `app/admin/actions.ts` | `bean:` branch in `editContainerContentAction` |
| `lib/content-actions-lang-source.test.ts` | no list change; add a bean-branch source test in a new `lib/bean-content-action-source.test.ts` |
| `app/admin/(chrome)/bean/[id]/page.tsx` | `lang` search param, `<ContentCard>` |
| `lib/edit-lang-source.test.ts` | bean page in `CONTENT_CARD_CALLERS` and the `editLang(`/`langHrefs={` check |
| `app/admin/_components/bean-table.tsx` + its callers | `hasNarrative` column |
| `lib/article.ts` | `narrativeFor(bean, sprouts)` |
| `app/(public)/(chrome)/bean/[id]/page.tsx` | render `narrativeFor` |
| `lib/related-beans.ts` | admit by `narrativeFor` |
| `lib/related-beans.test.ts` | a bean with only `content` is a candidate |
| `lib/articles.ts`, `lib/articles-store.ts`, tests | accept `bean:` container for `narrative` only |
| `lib/garden-manifest.ts`, `lib/plant-garden-apply.ts`, tests, `plugins/garden-plant/skills/garden-plant/SKILL.md` | accept `bean.content` |
| `lib/journal-migration.ts` + test, `scripts/migrate-journal.ts`, `package.json` | the article fold |
| `CLAUDE.md`, `README.md`, `docs/TAXONOMY.md` | the rule flips |

---

### Task 0: Worktree

- [ ] **Step 1: Create the worktree from the spec branch**

```bash
cd /Users/alexis/code/ariko
git worktree add /private/tmp/claude-503/-Users-alexis-code-ariko/b7b5f7e9-be42-4bc7-b4c0-6c175c7d2750/scratchpad/wt-bean-narrative -b journal/bean-narrative spec/journal-model
cp .env.local /private/tmp/claude-503/-Users-alexis-code-ariko/b7b5f7e9-be42-4bc7-b4c0-6c175c7d2750/scratchpad/wt-bean-narrative/.env.local
cd /private/tmp/claude-503/-Users-alexis-code-ariko/b7b5f7e9-be42-4bc7-b4c0-6c175c7d2750/scratchpad/wt-bean-narrative && npm ci --no-audit --no-fund
```

Every later task runs inside that worktree. Call it `$WT` below.

- [ ] **Step 2: Baseline**

Run: `cd $WT && npm test 2>&1 | tail -5`
Expected: all pass (note the count).

---

### Task 1: `Bean.content`, `Bean.relations`, scrubbed

**Files:**
- Modify: `lib/data.ts:174-205` (Bean type), `lib/data.ts:580-650` (filterPublic)
- Test: `lib/bean-relations-scrub.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// lib/bean-relations-scrub.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPublic, type RawGarden } from "./data";

// A bean's narrative mirrors refs into relations[] exactly as a pod's does
// (buildContentPatch → extractRefs). Pods are scrubbed in filterPublic; a bean
// that is not would publish a private slug inside a public document.
test("filterPublic scrubs a bean's relations to refs that survive", () => {
  const raw = {
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    pods: [],
    beans: [
      {
        slug: "open",
        name: "Open",
        parents: ["plant:p"],
        content: "see [[bean:hidden]] and [[bean:shown]]",
        relations: [
          { kind: "mentions", ref: "bean:hidden" },
          { kind: "mentions", ref: "bean:shown" },
          { kind: "mentions", ref: "sprout:ghost" },
        ],
      },
      { slug: "hidden", name: "Hidden", parents: ["plant:p"], visibility: "private" },
      { slug: "shown", name: "Shown", parents: ["plant:p"] },
    ],
    sprouts: [],
    screens: [],
    seeds: [],
    bees: [],
  } as unknown as RawGarden;

  const pub = filterPublic(raw);
  const open = pub.beans.find((b) => b.slug === "open");
  assert.ok(open);
  assert.deepEqual(open.relations, [{ kind: "mentions", ref: "bean:shown" }]);
  assert.equal(open.content, "see [[bean:hidden]] and [[bean:shown]]");
});
```

Check `filterPublic`'s real signature and the `RawGarden` shape at the top of `lib/data.ts` before running; adjust the cast, not the assertions. If an existing filterPublic test file already builds a fixture garden, add the test there instead and delete this file.

- [ ] **Step 2: Run it, expect failure**

Run: `cd $WT && node --import tsx --test lib/bean-relations-scrub.test.ts`
Expected: FAIL — `open.relations` still holds three entries (or a type error on `content`).

- [ ] **Step 3: Add the fields**

In `lib/data.ts`, inside `interface Bean` after `description?: Text;`:

```ts
  /**
   * The bean's narrative: what the feature is now and how it got there, one
   * body rewritten in place — never versioned, never appended (spec
   * 2026-10-10-journal-model §1.1). States of a feature are told here and
   * dated by its journal; a different version of a feature is a sibling bean.
   */
  content?: Text;
  /** Mirrored from `content` by buildContentPatch, scrubbed by filterPublic — the pod's rule. */
  relations?: Relation[];
```

- [ ] **Step 4: Scrub in filterPublic**

In `filterPublic`, the beans are filtered at ~L580 into `const beans`, before `refSurvives` exists. Rename that binding to `keptBeans` (update `beanKept` to read from it), and next to `const pods = keptPods.map(...)` add:

```ts
  // A bean's narrative mirrors refs into relations[] through the same
  // buildContentPatch a pod's does, so it gets the same scrub, below
  // refSurvives for the same reason.
  const beans = keptBeans.map((b) => scrubRelations(b, refSurvives));
```

Make sure the returned object still uses `beans`, and that nothing between the two points read the old `beans` binding (grep the function).

- [ ] **Step 5: Run the test and the suite**

Run: `cd $WT && node --import tsx --test lib/bean-relations-scrub.test.ts && npx tsc --noEmit && npm test 2>&1 | tail -3`
Expected: PASS, tsc clean, suite green.

- [ ] **Step 6: Commit**

```bash
git add lib/data.ts lib/bean-relations-scrub.test.ts
git commit -m "Give a bean a narrative: Bean.content and scrubbed Bean.relations" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `updateBeanContent`

**Files:**
- Modify: `lib/botanical.ts:442-458`
- Modify: `lib/garden-cache-source.test.ts:~102`
- Test: `lib/content-store.test.ts`

- [ ] **Step 1: Write the failing DB test**

Open `lib/content-store.test.ts`, read the existing test at L19 ("a content write touches content and relations and NOTHING else") and add a sibling right after it that does the same for a bean. Mirror its setup exactly (same `hasDb` skip, same cleanup pattern), using a bean document:

```ts
test("a bean content write touches content and relations and NOTHING else", { skip: !hasDb }, async (t) => {
  const db = await getDb();
  const slug = "test-content-store-bean";
  const cleanup = () => db.collection("beans").deleteMany({ slug });
  await cleanup();
  t.after(cleanup);
  await db.collection("beans").insertOne({
    slug,
    name: "B",
    parents: ["plant:test-content-store"],
    description: "d",
    visibility: "private",
    cover: { url: "https://example.test/c.png", provider: "cloudinary" },
    keyword: "k",
    tags: ["t"],
  });

  await updateBeanContent(slug, { content: { en: "after" }, relations: [{ kind: "mentions", ref: "bean:x" }] });

  const stored = await db.collection("beans").findOne({ slug }, { projection: { _id: 0 } });
  assert.deepEqual(stored?.content, { en: "after" });
  assert.deepEqual(stored?.relations, [{ kind: "mentions", ref: "bean:x" }]);
  assert.equal(stored?.visibility, "private");
  assert.equal(stored?.keyword, "k");
  assert.deepEqual(stored?.tags, ["t"]);
  assert.deepEqual(stored?.cover, { url: "https://example.test/c.png", provider: "cloudinary" });
});
```

Add `updateBeanContent` to the file's import from `./botanical`.

- [ ] **Step 2: Run, expect failure**

Run: `cd $WT && MONGODB_DB=beanstalk_scratch node --env-file=.env.local --import tsx --test lib/content-store.test.ts`
Expected: FAIL — `updateBeanContent` is not exported.

- [ ] **Step 3: Implement**

In `lib/botanical.ts` after `updatePodContent`:

```ts
export function updateBeanContent(slug: string, patch: ContentPatch): Promise<void> {
  return writeContent("beans", slug, patch);
}
```

- [ ] **Step 4: Classify it for the garden-cache test**

In `lib/garden-cache-source.test.ts`, the `GARDEN_WRITERS` list around L102 names `"updatePlantContent"`, `"updatePodContent"`. Add `"updateBeanContent"` beside them. Run `npm test` — the classification check at ~L478 fails without it.

- [ ] **Step 5: Run**

Run: `cd $WT && MONGODB_DB=beanstalk_scratch node --env-file=.env.local --import tsx --test lib/content-store.test.ts && npm test 2>&1 | tail -3`
Expected: PASS both.

- [ ] **Step 6: Commit**

```bash
git add lib/botanical.ts lib/content-store.test.ts lib/garden-cache-source.test.ts
git commit -m "updateBeanContent: the bean's content writer beside the pod's" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `editContainerContentAction` accepts `bean:`

**Files:**
- Modify: `app/admin/actions.ts:584-621`
- Test: `lib/bean-content-action-source.test.ts` (new)

The action already satisfies `lib/content-actions-lang-source.test.ts` (parseEditLangField, buildContentPatch with `field.lang`, final redirect through withEditLang). Keep that shape: ONE `async function` in the export, and the LAST `redirect(` wrapped in `withEditLang(`.

- [ ] **Step 1: Write the failing source test**

```ts
// lib/bean-content-action-source.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const path = "app/admin/actions.ts";
const source = readFileSync(join(process.cwd(), path), "utf8");
const start = source.indexOf("export async function editContainerContentAction");
const end = source.indexOf("\nexport ", start + 1);
const body = source.slice(start, end);

// A bean's narrative is edited through the SAME action a pod's is, so the
// ?lang= rule (content-actions-lang-source.test.ts) covers it without a second
// copy. Three things only this test watches:
test("editContainerContentAction accepts a bean: ref", () => {
  assert.match(body, /BEAN_PREFIX/);
  assert.match(body, /updateBeanContent\(/);
});

test("a projected bean's narrative is read-only, like its every other field", () => {
  // Every bean action in this file redirects on `existing.projected`; the
  // content branch must too, or the one machine-owned tier gains a hand edit.
  assert.match(body, /projected/);
});

test("a bean edit lands back on the bean page", () => {
  assert.match(body, /\/admin\/bean\/\$\{encodeURIComponent\(slug\)\}/);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd $WT && node --import tsx --test lib/bean-content-action-source.test.ts`
Expected: FAIL on all three.

- [ ] **Step 3: Implement the branch**

Replace the body of `editContainerContentAction` (L584-621) with:

```ts
export async function editContainerContentAction(formData: FormData): Promise<void> {
  const ref = String(formData.get("ref") ?? "");
  const markdown = String(formData.get("content") ?? "");
  const isPlant = ref.startsWith(PLANT_PREFIX);
  const isPod = ref.startsWith(POD_PREFIX);
  const isBean = ref.startsWith(BEAN_PREFIX);
  if (!isPlant && !isPod && !isBean) redirect("/admin");
  const slug = ref.slice(ref.indexOf(":") + 1);
  const raw = await loadRawGarden();
  const existing = isPlant
    ? raw.plants?.find((p) => p.slug === slug)
    : isPod
      ? raw.pods?.find((p) => p.slug === slug)
      : raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin");
  const back = isPlant
    ? narrativeHref(slug)
    : isPod
      ? `/admin/pod/${encodeURIComponent(slug)}`
      : `/admin/bean/${encodeURIComponent(slug)}`;
  // A projected bean is machine-owned end to end (lib/projected-beans.ts); every
  // other bean action in this file bounces on the flag, and so does this one.
  if (isBean && (existing as Bean).projected) redirect(back);
  const field = parseEditLangField(formData.get("lang"));
  if (!field.ok) redirect(`${back}?error=${encodeURIComponent(field.error)}`);
  const result = buildContentPatch(existing, markdown, field.lang);
  if (!result.ok) redirect(withEditLang(`${back}?error=${encodeURIComponent(result.error)}`, field.lang));
  if (result.dirty) {
    if (isPlant) await updatePlantContent(slug, result.patch);
    else if (isPod) await updatePodContent(slug, result.patch);
    else await updateBeanContent(slug, result.patch);
  }
  revalidateGarden();
  redirect(withEditLang(back, field.lang));
}
```

Keep the existing error-encoding lines exactly as the current file spells them if they differ from the above (read L584-621 first and preserve its `?error=` form). Import `BEAN_PREFIX` from `@/lib/data` (it is exported there, used by filterPublic) and `updateBeanContent` from `@/lib/botanical`; `Bean` is already imported as a type or add `type Bean`.

- [ ] **Step 4: Run**

Run: `cd $WT && node --import tsx --test lib/bean-content-action-source.test.ts lib/content-actions-lang-source.test.ts lib/garden-cache-source.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean. (`garden-cache-source` checks `editContainerContentAction` still calls `revalidateGarden()` once.)

- [ ] **Step 5: Commit**

```bash
git add app/admin/actions.ts lib/bean-content-action-source.test.ts
git commit -m "editContainerContentAction: a bean: ref writes the bean's narrative" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The admin bean page gets the prose editor

**Files:**
- Modify: `app/admin/(chrome)/bean/[id]/page.tsx`
- Modify: `lib/edit-lang-source.test.ts:108-119`

- [ ] **Step 1: Extend the source test first**

In `lib/edit-lang-source.test.ts`:
- Add `"app/admin/(chrome)/bean/[id]/page.tsx"` to `CONTENT_CARD_CALLERS` (L119).
- The block at L108-112 asserts the pod page contains `editLang(` and `langHrefs={`. Turn its single path into a loop over `CONTENT_CARD_CALLERS` so the bean page is held to the same two assertions.

Run: `cd $WT && node --import tsx --test lib/edit-lang-source.test.ts`
Expected: FAIL — the bean page has neither.

- [ ] **Step 2: Wire the page**

In `app/admin/(chrome)/bean/[id]/page.tsx`:

1. Widen the search params type: `searchParams: Promise<{ error?: string; form?: string; lang?: string }>`.
2. After `const query = await searchParams;` (or however the file reads it) add `const lang = editLang(query.lang);`.
3. Import `editLang, editLangHrefs` from `@/lib/edit-lang`, `ContentCard` from `@/app/admin/_components/content-card`, `editContainerContentAction` from `@/app/admin/actions`.
4. Between the page-level error Alert and the "Sprouts" section, render, for a non-projected bean only:

```tsx
      {readOnly ? null : (
        <ContentCard
          raw={raw}
          content={bean.content}
          selfRef={`bean:${bean.slug}`}
          action={editContainerContentAction}
          hidden={{ ref: `bean:${bean.slug}` }}
          lang={lang}
          langHrefs={editLangHrefs(`/admin/bean/${encodeURIComponent(bean.slug)}`, query)}
        />
      )}
```

`raw` is the `loadRawGarden()` result the page already holds for `bean`; `entityOptions(raw, selfRef)` inside ContentCard excludes the bean itself.

The bean's other actions (meta, visibility, tags, cover, keyword) redirect to the bare bean URL and so drop `?lang=`. That is accepted for this slice: the editor reopens on English, which is the documented default, and nothing mis-saves. Note it in the page's docblock in one sentence.

- [ ] **Step 3: Run**

Run: `cd $WT && node --import tsx --test lib/edit-lang-source.test.ts lib/bean-hero-a11y.test.ts lib/entity-rail-source.test.ts && npx tsc --noEmit && npm test 2>&1 | tail -3`
Expected: all PASS.

- [ ] **Step 4: Drive it once**

Start the worktree's dev server on a spare port against the scratch DB and open a bean: `cd $WT && MONGODB_DB=beanstalk_scratch PORT=3101 npm run dev` (if the scratch DB is empty, seed one plant and bean through the admin first). Confirm: the editor renders under the hero, `?lang=fr` opens the French half with "Start from English", a save lands back on `?lang=fr`. Stop the server. If the scratch DB cannot be reached, say so in the task report rather than skipping silently.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(chrome)/bean/[id]/page.tsx" lib/edit-lang-source.test.ts
git commit -m "The admin bean page edits the bean's narrative, in either half" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Bean tables say which beans have a narrative

**Files:**
- Modify: `app/admin/_components/bean-table.tsx`
- Modify: every builder of `BeanRow[]` (grep `sproutCount:` under `app/admin/`)

- [ ] **Step 1: Add the column**

In `bean-table.tsx`: import `NarrativeGlyph` beside `VisibilityGlyph`; add `hasNarrative: boolean;` to `BeanRow`; add `<TableHead>narrative</TableHead>` after `sprouts` and the cell `<TableCell>{row.hasNarrative ? <NarrativeGlyph /> : "—"}</TableCell>` in the same position, exactly as `pod-table.tsx:80` does.

- [ ] **Step 2: Fill it at every caller**

`grep -rn "sproutCount:" app/admin` lists each place a `BeanRow` is built. At each, add `hasNarrative: hasNarrative(bean.content),` importing `hasNarrative` from `@/lib/data`.

- [ ] **Step 3: Verify**

Run: `cd $WT && npx tsc --noEmit && npm test 2>&1 | tail -3`
Expected: tsc clean (a missed caller is a type error), suite green.

- [ ] **Step 4: Commit**

```bash
git add app/admin
git commit -m "Bean tables show which beans carry a narrative" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The public bean page reads the narrative

**Files:**
- Modify: `lib/article.ts`
- Modify: `app/(public)/(chrome)/bean/[id]/page.tsx:61,~90`
- Modify: `lib/related-beans.ts:99-105`
- Test: `lib/article.test.ts` (create if absent), `lib/related-beans.test.ts`

- [ ] **Step 1: Write the failing unit test for `narrativeFor`**

```ts
// lib/article.test.ts (append if the file exists)
import { test } from "node:test";
import assert from "node:assert/strict";
import { narrativeFor } from "./article";
import type { Bean, Sprout } from "./data";

const bean = (content?: Bean["content"]): Bean => ({ slug: "b", name: "B", parents: ["plant:p"], content });
const sprout = (content: string, date: string): Sprout =>
  ({ slug: `s-${date}`, name: "S", type: "article", date, description: "", parents: ["bean:b"], content }) as Sprout;

test("the bean's own content wins, undated", () => {
  const r = narrativeFor(bean({ en: "mine" }), [sprout("theirs", "2026-01-01")]);
  assert.deepEqual(r, { content: { en: "mine" }, date: undefined });
});

test("without bean content the newest sprout with prose is read, dated (slice-two fallback)", () => {
  const r = narrativeFor(bean(), [sprout("", "2026-02-01"), sprout("old", "2026-01-01")]);
  assert.deepEqual(r, { content: "old", date: "2026-01-01" });
});

test("nothing to read is null", () => {
  assert.equal(narrativeFor(bean({ en: "  " }), []), null);
});
```

Run: `cd $WT && node --import tsx --test lib/article.test.ts` → FAIL, `narrativeFor` not exported.

- [ ] **Step 2: Implement**

In `lib/article.ts`, keep `articleFor` and add:

```ts
export interface Narrative {
  content: Text;
  /** Set only when the prose came from a dated sprout; a bean's own narrative has no date. */
  date: string | undefined;
}

/**
 * What a bean page reads, and the ONE test `lib/related-beans.ts` admits a
 * candidate by. The bean's own `content` first (journal model §1.1); until slice
 * two folds the last article sprouts, the newest sprout with prose is the
 * fallback, so no bean goes blank between the two slices.
 */
export function narrativeFor(bean: Bean, sprouts: Sprout[]): Narrative | null {
  if (hasNarrative(bean.content)) return { content: bean.content as Text, date: undefined };
  const article = articleFor(sprouts);
  return article ? { content: article.content as Text, date: article.date } : null;
}
```

Import `hasNarrative`, `type Bean`, `type Text` from `./data`.

- [ ] **Step 3: Use it on the page**

In `app/(public)/(chrome)/bean/[id]/page.tsx` replace `const article = articleFor(data.sproutsForBean(bean.slug));` with `const narrative = narrativeFor(bean, data.sproutsForBean(bean.slug));` and the render with:

```tsx
        {narrative ? (
          <Prose reveal lang={lang} content={narrative.content} resolve={(ref) => resolveEntity(data, ref, lang)} />
        ) : null}
```

Update the import.

- [ ] **Step 4: `related-beans` admits by the same function**

Write the failing test in `lib/related-beans.test.ts` (read its fixture helpers first and reuse them): a sibling bean with `content: "prose"` and no sprouts appears in the rail; two such undated beans sort by name after any dated candidate.

Then in `lib/related-beans.ts` L99-105:

```ts
      const narrative = narrativeFor(candidate, dataset.sproutsForBean(candidate.slug));
      if (narrative) {
        out.push({ bean: candidate, date: narrative.date ?? "", name: resolveText(candidate.name) });
      }
```

Check `byNewestThenName` treats `""` as oldest (string compare descending puts `""` last). If `Candidate.date` is typed `string`, the `?? ""` keeps it so. Update the comment above to name `narrativeFor`.

- [ ] **Step 5: Run**

Run: `cd $WT && node --import tsx --test lib/article.test.ts lib/related-beans.test.ts && npx tsc --noEmit && npm test 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/article.ts lib/article.test.ts lib/related-beans.ts lib/related-beans.test.ts "app/(public)/(chrome)/bean/[id]/page.tsx"
git commit -m "The public bean page reads the bean's narrative first" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `/api/articles` writes a bean narrative

A `bean:` container accepts `narrative` and REFUSES `articles` (a bean holds no beans). The existing rules carry over: an unknown container is refused, a public container with non-blank content is refused, the write filter is `containerStillWritableFilter()`.

**Files:**
- Modify: `lib/articles.ts:94-104`, `lib/articles-store.ts:20-24`
- Modify: `lib/articles.test.ts:33`, `lib/articles-route.test.ts:113-115`, `lib/articles-store.test.ts`

- [ ] **Step 1: Flip the validator tests**

In `lib/articles.test.ts`, remove `"bean:karma"` from the bad-containers list and add:

```ts
test("a bean: container takes a narrative", () => {
  assert.deepEqual(validateArticlesPayload({ container: "bean:karma", narrative: "x" }), { ok: true });
});

test("a bean: container refuses articles — a bean holds no beans", () => {
  const r = validateArticlesPayload({ container: "bean:karma", articles: [] });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /bean: container carries a narrative only/);
});
```

In `lib/articles-route.test.ts` L113-115, change the rejected-container case to post `{ container: "bean:karma", articles: [...] }` and expect the same message; the bare `bean:` with narrative is now accepted.

Run: `cd $WT && node --import tsx --test lib/articles.test.ts` → FAIL.

- [ ] **Step 2: Validator**

In `lib/articles.ts` L94-104, add a `BEAN_PREFIX` branch to `containerRest` and change the message to `` `container must be a plant:, pod: or bean: ref, got ${container || "nothing"}` ``. After the narrative/articles presence check add:

```ts
  if (typeof container === "string" && container.startsWith(BEAN_PREFIX) && articles !== undefined)
    return { ok: false, error: "a bean: container carries a narrative only — post articles under its pod" };
```

- [ ] **Step 3: Store**

In `lib/articles-store.ts` `resolveContainer` returns `"plants" | "pods" | "beans"`:

```ts
function resolveContainer(ref: string): { collection: "plants" | "pods" | "beans"; slug: string } {
  if (ref.startsWith(PLANT_PREFIX)) return { collection: "plants", slug: ref.slice(PLANT_PREFIX.length) };
  if (ref.startsWith(POD_PREFIX)) return { collection: "pods", slug: ref.slice(POD_PREFIX.length) };
  return { collection: "beans", slug: ref.slice(BEAN_PREFIX.length) };
}
```

Widen the `db.collection<Plant | Pod>(collection)` reads to `<Plant | Pod | Bean>`. Add one bean refusal beside the public-with-content one: a projected bean (`(container as Bean).projected`) is refused with `${payload.container} (projected)`.

- [ ] **Step 4: DB test**

In `lib/articles-store.test.ts`, mirroring an existing narrative test: insert a private bean `test-articles-bean`, `writeArticles({ container: "bean:test-articles-bean", narrative: { en: "hello" } })`, assert the stored bean has `content.en === "hello"` and `relations` is an array; then set it `visibility: "public"` and assert a second write is refused. Clean up in `t.after`.

- [ ] **Step 5: Run**

Run: `cd $WT && node --import tsx --test lib/articles.test.ts && MONGODB_DB=beanstalk_scratch node --env-file=.env.local --import tsx --test lib/articles-store.test.ts lib/articles-route.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/articles.ts lib/articles-store.ts lib/articles.test.ts lib/articles-store.test.ts lib/articles-route.test.ts
git commit -m "/api/articles: a bean: container takes a narrative" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The garden manifest accepts `bean.content`

**Files:**
- Modify: `lib/garden-manifest.ts:126-133, 341-351`, `lib/plant-garden-apply.ts:117-135`
- Modify: `lib/garden-manifest.test.ts:~371`, `lib/plant-garden.test.ts`
- Modify: `plugins/garden-plant/skills/garden-plant/SKILL.md:49-54, 227`

- [ ] **Step 1: Flip the manifest test**

Replace the test at `lib/garden-manifest.test.ts:~371` ("rejects content on a bean") with:

```ts
test("a bean takes content, bilingual, size-checked like a pod's", () => {
  const r = parseManifest(/* the file's usual minimal fixture, with */ { beans: [{ slug: "b", name: "B", description: "d", content: { en: "now", fr: "maintenant" } }] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.manifest.pods[0].beans[0].content, { en: "now", fr: "maintenant" });
});
```

Use the file's own fixture builder and entry-point name (`parseManifest`/`validateManifest`; read the top of the test file). Run → FAIL.

- [ ] **Step 2: Validator**

In `lib/garden-manifest.ts`: add `content?: Text;` to `ManifestBean`. Delete the refusal block at L341-351 and replace it with the pod's own content parsing (L265-271) applied to the bean: `readText`, `checkContentSize`, `bean.content = ...`.

- [ ] **Step 3: Applier**

In `lib/plant-garden-apply.ts` bean branch, after the create/update split and before `continue`, mirror the pod pattern:

```ts
      // A bean's narrative, like a pod's, is a second write on create and on
      // --update: the manifest is the author's current text for both.
      if (bean.content !== undefined) {
        const existing =
          action.action === "create" ? undefined : garden.beans.find((b) => b.slug === bean.slug)?.relations;
        await updateBeanContent(bean.slug, contentPatch(bean.content, existing));
      }
```

Import `updateBeanContent` from `./botanical`.

- [ ] **Step 4: DB test**

In `lib/plant-garden.test.ts`, add a test in the file's pattern: a manifest whose bean has `content: { en: "x" }`, apply, assert the stored bean's `content.en === "x"`; apply again with `--update` semantics and `content: { en: "y" }` and assert `y`. Reuse `cleanup()`.

- [ ] **Step 5: Skill text**

In `plugins/garden-plant/skills/garden-plant/SKILL.md` L49-54 and L227, the text says a bean has no content and prose goes in a sprout. Rewrite both to: a bean carries `content`, its narrative — what the feature is now and how it got there, rewritten in place; a dated piece of work is a sprout. Keep the refused-keys list unchanged.

- [ ] **Step 6: Run**

Run: `cd $WT && node --import tsx --test lib/garden-manifest.test.ts && MONGODB_DB=beanstalk_scratch node --env-file=.env.local --import tsx --test lib/plant-garden.test.ts && npx tsc --noEmit && npm test 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/garden-manifest.ts lib/plant-garden-apply.ts lib/garden-manifest.test.ts lib/plant-garden.test.ts plugins/garden-plant
git commit -m "garden-plant: a bean carries its narrative in the manifest" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The article fold — pure rules

**Files:**
- Create: `lib/journal-migration.ts`, `lib/journal-migration.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/journal-migration.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { planArticleFold } from "./journal-migration";
import type { Bean, Sprout } from "./data";

const bean = (slug: string, extra: Partial<Bean> = {}): Bean => ({ slug, name: slug, parents: ["plant:p"], ...extra });
const article = (slug: string, bean: string, extra: Partial<Sprout> = {}): Sprout =>
  ({ slug, name: slug, type: "article", date: "2026-01-01", description: "", parents: [`bean:${bean}`], content: { en: "body" }, ...extra }) as Sprout;

test("an article sprout folds into its bean and is deleted", () => {
  const plan = planArticleFold([bean("b")], [article("b-0", "b", { relations: [{ kind: "mentions", ref: "bean:z" }] })]);
  assert.deepEqual(plan.refusals, []);
  assert.deepEqual(plan.folds, [
    { beanSlug: "b", sproutSlug: "b-0", content: { en: "body" }, relations: [{ kind: "mentions", ref: "bean:z" }] },
  ]);
});

test("a bean that already has content is refused, not overwritten", () => {
  const plan = planArticleFold([bean("b", { content: "mine" })], [article("b-0", "b")]);
  assert.equal(plan.folds.length, 0);
  assert.match(plan.refusals[0], /b-0.*already has content/);
});

test("two articles under one bean are refused — the fold cannot pick", () => {
  const plan = planArticleFold([bean("b")], [article("b-0", "b"), article("b-1", "b")]);
  assert.equal(plan.folds.length, 0);
  assert.match(plan.refusals[0], /two article sprouts/);
});

test("an article carrying media is refused — the derived cover would change", () => {
  const plan = planArticleFold([bean("b")], [article("b-0", "b", { media: [{ url: "x", provider: "cloudinary" }] } as Partial<Sprout>)]);
  assert.equal(plan.folds.length, 0);
  assert.match(plan.refusals[0], /media/);
});

test("an article whose bean is missing, or with no content, is refused", () => {
  const plan = planArticleFold([bean("b")], [article("x-0", "x"), article("b-0", "b", { content: "  " })]);
  assert.equal(plan.folds.length, 0);
  assert.equal(plan.refusals.length, 2);
});

test("non-article sprouts are untouched", () => {
  const plan = planArticleFold([bean("b")], [article("n", "b", { type: "note" })]);
  assert.deepEqual(plan, { folds: [], refusals: [] });
});
```

Run: `cd $WT && node --import tsx --test lib/journal-migration.test.ts` → FAIL.

- [ ] **Step 2: Implement**

```ts
// lib/journal-migration.ts
import { BEAN_PREFIX, hasNarrative, parentsWithPrefix, type Bean, type Relation, type Sprout, type Text } from "./data";

/**
 * The article fold (spec 2026-10-10-journal-model §4 step 2), as a PURE plan.
 *
 * Seventeen `type:"article"` sprouts are each the sole child of a bean created
 * for them by /api/articles — a bean's narrative wearing a sprout costume. Each
 * folds into its bean's `content` and is deleted. The script applies this plan;
 * this module only decides it, so every refusal is a unit test and the script
 * carries no rule of its own.
 *
 * Refusals are per sprout and never partial: a fold that cannot be made whole
 * is listed and skipped, and the script refuses to write while any remain.
 */
export const ARTICLE_TYPE = "article";

export interface ArticleFold {
  beanSlug: string;
  sproutSlug: string;
  content: Text;
  relations: Relation[] | undefined;
}

export interface FoldPlan {
  folds: ArticleFold[];
  refusals: string[];
}

export function planArticleFold(beans: Bean[], sprouts: Sprout[]): FoldPlan {
  const byBean = new Map<string, Sprout[]>();
  for (const s of sprouts) {
    if (s.type !== ARTICLE_TYPE) continue;
    const beanSlug = parentsWithPrefix(s.parents, BEAN_PREFIX)[0];
    const key = beanSlug ?? `(no bean) ${s.slug}`;
    byBean.set(key, [...(byBean.get(key) ?? []), s]);
  }
  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));
  const folds: ArticleFold[] = [];
  const refusals: string[] = [];
  for (const [beanSlug, group] of byBean) {
    if (group.length > 1) {
      refusals.push(`${beanSlug}: two article sprouts (${group.map((s) => s.slug).join(", ")}) — the fold cannot pick`);
      continue;
    }
    const s = group[0];
    const bean = beanBySlug.get(beanSlug);
    if (!bean) { refusals.push(`${s.slug}: bean ${beanSlug} not found`); continue; }
    if (!hasNarrative(s.content)) { refusals.push(`${s.slug}: no content to fold`); continue; }
    if (hasNarrative(bean.content)) { refusals.push(`${s.slug}: bean ${beanSlug} already has content`); continue; }
    if ((s.media ?? []).length > 0) { refusals.push(`${s.slug}: carries media — the bean's derived cover would change`); continue; }
    folds.push({ beanSlug, sproutSlug: s.slug, content: s.content as Text, relations: s.relations });
  }
  return { folds, refusals };
}
```

Check `parentsWithPrefix` and `BEAN_PREFIX` are exported from `lib/data.ts` (they are used there at L348 and L436); export them if not.

- [ ] **Step 3: Run**

Run: `cd $WT && node --import tsx --test lib/journal-migration.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/journal-migration.ts lib/journal-migration.test.ts
git commit -m "Plan the article fold as a pure rule" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: The migration script

**Files:**
- Create: `scripts/migrate-journal.ts`
- Modify: `package.json` (scripts)

Model: `scripts/migrate-pbbls-legacy.ts` (dry by default, `--apply`, unknown args refused, JSON backup under `data/retired/`, all reads before any write).

- [ ] **Step 1: Write the script**

```ts
// scripts/migrate-journal.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "../lib/db";
import { planArticleFold, ARTICLE_TYPE } from "../lib/journal-migration";
import type { Bean, Sprout } from "../lib/data";

/**
 * Slice one of the journal model (spec 2026-10-10 §4 step 2): fold every
 * `type:"article"` sprout into its bean's `content` and delete the sprout.
 *
 * Dry by default; `--apply` writes. Every rule lives in lib/journal-migration.ts.
 * The script refuses to write while ANY fold is refused, because a half-folded
 * garden (some beans with content, some articles still sprouts) renders two
 * ways at once. No revalidateGarden(): a CLI has no request store (the
 * garden-plant rule), and the next admin write invalidates.
 */
const KNOWN = new Set(["--apply", "--dry-run"]);
const UNKNOWN = process.argv.slice(2).filter((a) => !KNOWN.has(a));
const DRY = !process.argv.includes("--apply");
const p = () => (DRY ? "[dry] " : "");
const BACKUP = join(process.cwd(), "data", "retired", "2026-10-10-article-sprouts.json");

async function main() {
  if (UNKNOWN.length > 0) throw new Error(`unrecognised argument(s): ${UNKNOWN.join(" ")} — refusing to run`);
  const db = await getDb();
  console.log(`${DRY ? "DRY RUN" : "*** LIVE RUN — WILL DELETE SPROUTS ***"}  db=${db.databaseName}  host=${new URL(process.env.MONGODB_URI!).host}`);

  const beans = await db.collection<Bean>("beans").find({}, { projection: { _id: 0 } }).toArray();
  const articles = await db.collection<Sprout>("sprouts").find({ type: ARTICLE_TYPE }, { projection: { _id: 0 } }).toArray();
  const plan = planArticleFold(beans, articles);

  for (const f of plan.folds) console.log(`${p()}fold  ${f.sproutSlug} -> bean ${f.beanSlug}`);
  for (const r of plan.refusals) console.log(`REFUSED ${r}`);
  console.log(`${plan.folds.length} fold(s), ${plan.refusals.length} refusal(s), ${articles.length} article sprout(s) read`);

  if (plan.refusals.length > 0) {
    console.log("refusing to write while any fold is refused");
    process.exitCode = 2;
    return;
  }
  if (DRY || plan.folds.length === 0) return;

  mkdirSync(join(process.cwd(), "data", "retired"), { recursive: true });
  writeFileSync(BACKUP, JSON.stringify({ sprouts: articles }, null, 2));
  console.log(`backup written: ${BACKUP}`);

  for (const f of plan.folds) {
    const r = await db.collection<Bean>("beans").updateOne(
      { slug: f.beanSlug, content: { $exists: false } },
      { $set: { content: f.content, ...(f.relations ? { relations: f.relations } : {}) } },
    );
    if (r.matchedCount !== 1) throw new Error(`bean ${f.beanSlug} changed under us — stopping before the delete`);
    await db.collection<Sprout>("sprouts").deleteOne({ slug: f.sproutSlug, type: ARTICLE_TYPE });
    console.log(`folded ${f.sproutSlug}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => closeDb());
```

Add to `package.json` scripts: `"migrate:journal": "node --env-file=.env.local --import tsx scripts/migrate-journal.ts"`.

- [ ] **Step 2: Rehearse against the scratch DB**

Seed the scratch DB with one bean and one article sprout (a short `mongosh` or a 10-line tsx snippet in the scratchpad, not committed), then:

Run: `cd $WT && MONGODB_DB=beanstalk_scratch npm run migrate:journal` → prints the fold, writes nothing.
Run: `cd $WT && MONGODB_DB=beanstalk_scratch npm run migrate:journal -- --apply` → folds; verify with a find that the bean has content and the sprout is gone. Run `--apply` again → `0 fold(s)`, idempotent.

- [ ] **Step 3: Dry-run against production, read-only**

Run: `cd $WT && npm run migrate:journal` (no `--apply`; `.env.local` points at production). Paste the full output in the task report. Expected: 17 folds, 0 refusals. **Do not pass `--apply`. The live run is Alexis's, after a `mongodump`, from the merged branch.**

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-journal.ts package.json
git commit -m "migrate:journal — fold article sprouts into their beans, dry by default" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Do not commit `data/retired/2026-10-10-article-sprouts.json`; it is written by the live run.

---

### Task 11: Docs

**Files:**
- Modify: `CLAUDE.md` ("A bean has no `content`" bullet under *Planting a project*), `README.md` (content model), `docs/TAXONOMY.md` (Bean)

- [ ] **Step 1: CLAUDE.md**

Replace the bullet beginning **A bean has no `content`.** with:

```markdown
- **A bean's `content` is its narrative, and a sprout is not a version of it.**
  Since the journal model (`specs/2026-10-10-journal-model-design.md`) a bean
  carries one body — what the feature is now and how it got there — rewritten
  in place, never versioned or appended. `editContainerContentAction` takes a
  `bean:` ref, `/api/articles` takes a `bean:` container for `narrative` only,
  and the manifest's `content:` on a bean is a second write exactly as a pod's.
  `narrativeFor` (`lib/article.ts`) is the one function the public bean page
  and the related-beans rail read by; its sprout fallback goes with slice two.
```

- [ ] **Step 2: README.md and docs/TAXONOMY.md**

Find the Bean definitions (grep `Bean` in both) and add one sentence each: a bean carries `content`, its evolving narrative; a different version of a feature is a sibling bean. Remove any sentence saying a bean has no content.

- [ ] **Step 3: Full verification, then commit**

Run: `cd $WT && npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -3 && npm run test:db 2>&1 | tail -3`
Expected: all green. If `npm run lint` is not a script, run `npx eslint .`.

```bash
git add CLAUDE.md README.md docs/TAXONOMY.md
git commit -m "Docs: a bean carries its narrative" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Pull request

- [ ] **Step 1: Push and open the PR against `main`**

```bash
cd $WT && git push -u origin journal/bean-narrative
gh pr create --base main --title "A bean carries its narrative (journal model, slice one)" --body-file /dev/stdin <<'EOF'
Slice one of docs/superpowers/specs/2026-10-10-journal-model-design.md.

- `Bean.content` / `Bean.relations`, scrubbed in `filterPublic` like a pod's
- `updateBeanContent`; `editContainerContentAction` takes `bean:`; the admin bean page gets the prose editor under the `?lang=` rule
- public bean page reads `narrativeFor` (bean content first, newest article sprout as a fallback until slice two)
- `/api/articles` takes a `bean:` container for `narrative`; the garden manifest accepts `bean.content`
- `npm run migrate:journal`: folds the 17 article sprouts into their beans, dry by default — **to be run by hand after a mongodump, once merged**

## Lab Note
```yaml
en:
  title: Features now tell their own story
  summary: Each feature page opens on a single living narrative — what it is today and how it got there — instead of the newest note that happened to have text.
fr:
  title: Chaque fonctionnalité raconte son histoire
  summary: La page d'une fonctionnalité s'ouvre désormais sur un récit vivant — ce qu'elle est aujourd'hui et comment elle en est arrivée là — plutôt que sur la dernière note qui avait du texte.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 2: Report**

Tell Alexis: the PR URL, the production dry-run output from Task 10 step 3, and the two manual steps that remain: `mongodump`, then `npm run migrate:journal -- --apply` from `main` after merge.
