# Slice 2 — Describe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `Bean` a `description`, render every tier's description where its name already renders, emit it in the graph, and stop naming projected beans after their slug.

**Architecture:** One optional model field, one pure `decorate` helper in the graph serializer, one pure `buildNewBean` for the triage path, and four read surfaces. No migration: the field is optional and every existing document stays valid.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, MongoDB, tests via `node --import tsx --test`.

**Spec:** [`docs/superpowers/specs/2026-08-22-content-describe-design.md`](../specs/2026-08-22-content-describe-design.md)

---

## File structure

| File | Responsibility |
|---|---|
| `lib/data.ts` (modify) | `Bean.description?: Text`. |
| `lib/graph.ts` (modify) | `GraphNode.description?`; `withTags` becomes `decorate`, which adds both optional payload fields. |
| `lib/graph.test.ts` (modify) | Three leak assertions narrow from "no description" to "description yes, everything else no"; new cases for blank/localized/bee. |
| `lib/projected-beans.ts` (modify) | A projected bean takes the materializing envelope's title. |
| `lib/projected-beans.test.ts` (modify) | Title adopted, slug fallback, first-envelope-wins. |
| `lib/promote.ts` (modify) | Pure `buildNewBean(form, slug)`. |
| `lib/promote.test.ts` (modify) | Its three cases. |
| `lib/botanical.ts` (modify) | `NewBean.description`, written by `createBean`. |
| `app/admin/actions.ts` (modify) | Uses `buildNewBean`. |
| `app/admin/triage/[id]/page.tsx` (modify) | Paired en/fr description inputs beside the new-bean name. |
| `app/(public)/page.tsx` (modify) | Plant / pod / bean descriptions on the Directory. |
| `app/(public)/bean/[id]/page.tsx` (modify) | The description as a lede. |
| `app/admin/bean/[id]/page.tsx` (modify) | The description under the header. |

---

## Task 1: Branch and model

**Files:**
- Modify: `lib/data.ts` (the `Bean` interface)
- Modify: `lib/botanical.ts` (`NewBean` + `createBean`)

- [ ] **Step 1: Branch**

```bash
git checkout slice-1-content-render && git checkout -b slice-2-content-describe
```

(Slice 1 is not merged yet, so this stacks on it: `main` ← `specs/content-composition` ← `slice-1-content-render` ← this branch. Nothing here depends on slice 1's code — the stack just avoids a README/ROADMAP conflict at merge time.)

- [ ] **Step 2: Add the field to `Bean`**

In `lib/data.ts`, in the `Bean` interface, add `description` between `parents` and `visibility`:

```ts
  description?: Text; // optional — every existing bean predates it (spec §2.1); Pod/Plant require theirs
```

- [ ] **Step 3: Let `createBean` write one**

In `lib/botanical.ts`, add to `NewBean`:

```ts
  description: Text;
```

and in `createBean`, build the document so a blank description is omitted rather than stored as `""`:

```ts
  const description = resolveText(input.description).trim();
  const doc: Bean = {
    slug: input.slug,
    name: input.name,
    parents: input.podSlug ? [`pod:${input.podSlug}`] : input.plantSlug ? [`plant:${input.plantSlug}`] : [],
    ...(description ? { description: input.description } : {}),
    visibility: "private",
  };
```

Add `resolveText` to the existing `./data` import in that file if it is not already there.

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: one error, in `app/admin/actions.ts` — `createBean` is called without the new required `description`. Task 4 fixes it. If any *other* file errors, stop and read it.

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/botanical.ts
git commit -m "feat: beans can describe themselves"
```

---

## Task 2: The graph payload

**Files:**
- Modify: `lib/graph.ts:13-22` (the `GraphNode` interface), `:55-67` (the node maps), `:131-133` (`withTags`)
- Test: `lib/graph.test.ts`

- [ ] **Step 1: Write the failing tests**

In `lib/graph.test.ts`, **replace** the three existing leak assertions so they admit `description`
while still proving nothing else leaks. In the pod test:

```ts
  assert.deepEqual(nodes, [{ id: "pod:m", kind: "pod", name: "M", description: "secret notes" }]);
  // Slice 2 (describe): description IS emitted — /api/graph composes filterPublic, so every node
  // it serializes is already public HTML. Everything below still never leaks.
  for (const key of ["parents", "domain", "visibility"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
```

In the bean test, the fixture has no description, so the expected node is unchanged — keep it as
`{ id: "bean:a", kind: "bean", name: "A" }` and keep its leak loop as-is.

In the sprout test, add `description: "secret"` to the expected node object and drop `"description"`
from that test's leak loop, leaving `content`, `media`, `source` and `parents` asserted absent.

Then append these cases:

```ts
test("a blank description emits no key at all", () => {
  const { nodes } = toGraph({
    pods: [{ slug: "m", name: "M", description: "   ", parents: [] }],
    beans: [{ slug: "a", name: "A", description: { en: "" }, parents: [] }],
  });
  for (const node of nodes) {
    assert.equal("description" in node, false, `${node.id} should carry no description key`);
  }
});

test("a localized description resolves en-first, like name", () => {
  const { nodes } = toGraph({
    pods: [{ slug: "m", name: "M", description: { en: "english", fr: "français" }, parents: [] }],
    beans: [{ slug: "a", name: "A", description: { fr: "seulement en français" }, parents: [] }],
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  assert.equal(byId.get("pod:m")?.description, "english");
  assert.equal(byId.get("bean:a")?.description, "seulement en français");
});

test("a public bee's description is emitted too", () => {
  const { nodes } = toGraph({
    bees: [
      {
        slug: "b",
        name: "B",
        kind: "routine",
        status: "live",
        levers: [],
        serves: [],
        description: "what it does",
        visibility: "public",
      },
    ],
  });
  assert.equal(nodes[0].description, "what it does");
  assert.equal("levers" in nodes[0], false, "levers must not leak into the node");
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --import tsx --test lib/graph.test.ts 2>&1 | tail -12`
Expected: FAIL — the deepEqual assertions report a missing `description` key.

- [ ] **Step 3: Implement**

In `lib/graph.ts`, add to `GraphNode`, after `name`:

```ts
  description?: string; // resolved (B1); emitted only when non-blank (slice 2)
```

Replace `withTags` with a helper that adds both optional fields:

```ts
// Optional payload fields ride along only when they carry something: a
// description when it resolves non-blank, tags when the array is non-empty.
// Everything else about a node stays deliberately minimal — content, media,
// source, parents and visibility never appear here.
function decorate(node: GraphNode, extra: { description?: Text; tags?: string[] }): GraphNode {
  const description = resolveText(extra.description ?? "").trim();
  return {
    ...node,
    ...(description ? { description } : {}),
    ...(extra.tags && extra.tags.length > 0 ? { tags: extra.tags } : {}),
  };
}
```

Add `Text` to the existing `./data` type import. Then rewrite the five node maps to call it:

```ts
  const nodes: GraphNode[] = [
    ...plants.map((p) =>
      decorate({ id: PLANT_PREFIX + p.slug, kind: "plant" as const, name: resolveText(p.name), natures: p.natures }, p),
    ),
    ...pods.map((m) => decorate({ id: POD_PREFIX + m.slug, kind: "pod" as const, name: resolveText(m.name) }, m)),
    ...beans.map((a) => decorate({ id: BEAN_PREFIX + a.slug, kind: "bean" as const, name: resolveText(a.name) }, a)),
    ...sprouts.map((v) =>
      decorate(
        { id: SPROUT_PREFIX + v.slug, kind: "sprout" as const, name: resolveText(v.name), type: v.type, date: v.date },
        v,
      ),
    ),
    ...bees.map((b) =>
      decorate(
        { id: BEE_PREFIX + b.slug, kind: "bee" as const, name: resolveText(b.name), type: b.kind, status: b.status },
        { description: b.description },
      ),
    ),
  ];
```

`Bee` has no `tags` field, which is why the bee call passes an explicit object rather than the doc.

Update the stale comment above `toGraph` — replace "no description/content/media/source/levers/serves"
with:

```
// Node payload stays minimal apart from description (slice 2): no
// content/media/source/levers/serves. tags and description only when non-empty.
```

- [ ] **Step 4: Run the tests**

Run: `node --import tsx --test lib/graph.test.ts 2>&1 | tail -12`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/graph.ts lib/graph.test.ts
git commit -m "feat: graph nodes carry their description"
```

---

## Task 3: Projected beans take a real name

**Files:**
- Modify: `lib/projected-beans.ts:24-25`
- Test: `lib/projected-beans.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/projected-beans.test.ts` (reuse the file's existing envelope factory if it has one —
otherwise build envelopes inline in the same shape as the tests above):

```ts
test("a projected bean takes the materializing envelope's title", () => {
  const beans = deriveProjectedBeans(
    [envelope({ id: "s:1", anchors: { plant: "plant:p", bean: "bean:webapp" }, title: "Pebbles Webapp" })],
    new Set(),
    new Set(["plant:p"]),
    "feed",
  );
  assert.equal(beans[0].name, "Pebbles Webapp");
});

test("the first envelope wins the name, like it wins the bean", () => {
  const beans = deriveProjectedBeans(
    [
      envelope({ id: "s:1", anchors: { plant: "plant:p", bean: "bean:webapp" }, title: "First" }),
      envelope({ id: "s:2", anchors: { plant: "plant:p", bean: "bean:webapp" }, title: "Second" }),
    ],
    new Set(),
    new Set(["plant:p"]),
    "feed",
  );
  assert.equal(beans.length, 1);
  assert.equal(beans[0].name, "First");
});

test("a blank title falls back to the slug", () => {
  const beans = deriveProjectedBeans(
    [envelope({ id: "s:1", anchors: { plant: "plant:p", bean: "bean:webapp" }, title: { en: "" } })],
    new Set(),
    new Set(["plant:p"]),
    "feed",
  );
  assert.equal(beans[0].name, "webapp");
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --import tsx --test lib/projected-beans.test.ts 2>&1 | tail -12`
Expected: FAIL — names come back as `webapp` where a title was expected.

- [ ] **Step 3: Implement**

In `lib/projected-beans.ts`, import `resolveText` from `./data` and replace `name: slug,` with:

```ts
      // The envelope's title is the only human-written name a source gives us;
      // the slug is the fallback when it resolves blank. Name only — the
      // envelope has no summary, so a projected bean carries no description.
      name: resolveText(p.title).trim() ? p.title : slug,
```

- [ ] **Step 4: Run the tests**

Run: `node --import tsx --test lib/projected-beans.test.ts 2>&1 | tail -12`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/projected-beans.ts lib/projected-beans.test.ts
git commit -m "feat: projected beans wear the name their source gave them"
```

---

## Task 4: The triage path writes a description

**Files:**
- Modify: `lib/promote.ts` (new pure `buildNewBean`)
- Modify: `app/admin/actions.ts:125-131`
- Test: `lib/promote.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/promote.test.ts`:

```ts
test("buildNewBean composes paired en/fr name and description", () => {
  const form = new FormData();
  form.set("newBeanName", "Karma");
  form.set("newBeanNameFr", "Karma");
  form.set("newBeanDescription", "How the octopus keeps score.");
  form.set("newBeanDescriptionFr", "Comment le poulpe compte les points.");
  assert.deepEqual(buildNewBean(form, "karma"), {
    slug: "karma",
    name: { en: "Karma", fr: "Karma" },
    description: {
      en: "How the octopus keeps score.",
      fr: "Comment le poulpe compte les points.",
    },
  });
});

test("buildNewBean falls back to the slug when the name is blank", () => {
  assert.equal(buildNewBean(new FormData(), "karma").name, "karma");
});

test("buildNewBean returns a blank description when both boxes are empty", () => {
  assert.equal(buildNewBean(new FormData(), "karma").description, "");
});
```

Add `buildNewBean` to the file's existing import from `./promote`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --import tsx --test lib/promote.test.ts 2>&1 | tail -12`
Expected: FAIL — `buildNewBean is not a function`.

- [ ] **Step 3: Implement**

In `lib/promote.ts`, add:

```ts
// Pure. The new-bean half of the triage form: name and description compose from
// their paired en/fr boxes exactly like the sprout's do (WYSIWYG — what the
// boxes submit is what is stored). A blank name falls back to the slug, which is
// what the action did inline before this existed; a blank description composes
// to "" and createBean omits the field rather than storing an empty string.
export function buildNewBean(form: FormData, slug: string): {
  slug: string;
  name: Text;
  description: Text;
} {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const name = composeText(get("newBeanName"), get("newBeanNameFr"));
  return {
    slug,
    name: resolveText(name).trim() ? name : slug,
    description: composeText(get("newBeanDescription"), get("newBeanDescriptionFr")),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --import tsx --test lib/promote.test.ts 2>&1 | tail -12`
Expected: PASS.

- [ ] **Step 5: Use it in the action**

In `app/admin/actions.ts`, replace the `createBean({ … })` call with:

```ts
      await createBean({
        ...buildNewBean(formData, beanChoice.slug),
        podSlug,
        plantSlug: podSlug ? null : plantSlug,
      });
```

and add `buildNewBean` to the existing `@/lib/promote` import.

- [ ] **Step 6: Verify the whole tree type-checks**

Run: `npx tsc --noEmit`
Expected: no output — Task 1 step 4's expected error is now resolved.

- [ ] **Step 7: Commit**

```bash
git add lib/promote.ts lib/promote.test.ts app/admin/actions.ts
git commit -m "feat: triage writes a new bean's description"
```

---

## Task 5: The triage form's inputs

**Files:**
- Modify: `app/admin/triage/[id]/page.tsx:167-177`

- [ ] **Step 1: Add the paired inputs**

In the Bean fieldset, replace the `grid gap-4 sm:grid-cols-2` block holding **New slug** and
**New name** with:

```tsx
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanSlug">New slug</Label>
                <Input id="newBeanSlug" type="text" name="newBeanSlug" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanName">New name</Label>
                <Input id="newBeanName" type="text" name="newBeanName" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanNameFr">New name (fr)</Label>
                <Input id="newBeanNameFr" type="text" name="newBeanNameFr" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanDescription">New description</Label>
                <Input id="newBeanDescription" type="text" name="newBeanDescription" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanDescriptionFr">New description (fr)</Label>
                <Input id="newBeanDescriptionFr" type="text" name="newBeanDescriptionFr" />
              </div>
            </div>
```

Plain `Input`s, no client JS — the form still posts to the server action without script
(`CLAUDE.md`).

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/triage/[id]/page.tsx"
git commit -m "feat: describe a new bean while promoting it"
```

---

## Task 6: The Directory shows what things are

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Render bean descriptions in the bean list**

Replace the `beanList` helper with:

```tsx
  const beanList = (beans: ReturnType<typeof data.beansForPod>) => (
    <ul className="flex flex-col gap-2">
      {beans.map((bean) => (
        <li key={bean.slug} className="flex flex-col gap-0.5">
          <a
            href={`/bean/${bean.slug}`}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {resolveText(bean.name)}
          </a>
          {/* One muted line, never markdown: descriptions are one-liners, content is not (spec §5). */}
          {resolveText(bean.description ?? "").trim() ? (
            <p className="text-xs text-muted-foreground/80">{resolveText(bean.description)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
```

- [ ] **Step 2: Render pod descriptions**

Replace the `podSection` helper with:

```tsx
  const podSection = (pod: ReturnType<typeof data.podsForPlant>[number]) => (
    <section key={pod.slug} className="flex flex-col gap-2">
      <h3 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
        {resolveText(pod.name)}
      </h3>
      {resolveText(pod.description ?? "").trim() ? (
        <p className="text-xs text-muted-foreground/80">{resolveText(pod.description)}</p>
      ) : null}
      {beanList(data.beansForPod(pod.slug))}
    </section>
  );
```

- [ ] **Step 3: Render plant descriptions**

In the plant `<Card>`, immediately after the `<div className="flex flex-wrap gap-1.5">` block that
renders the natures badges, and still inside `<CardHeader>`, add:

```tsx
            {resolveText(plant.description ?? "").trim() ? (
              <p className="text-sm text-muted-foreground">{resolveText(plant.description)}</p>
            ) : null}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: no tsc output; 0 failures.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/page.tsx"
git commit -m "feat: the Directory says what each plant, pod and bean is"
```

---

## Task 7: The bean pages

**Files:**
- Modify: `app/(public)/bean/[id]/page.tsx`
- Modify: `app/admin/bean/[id]/page.tsx`

- [ ] **Step 1: The public lede**

In `app/(public)/bean/[id]/page.tsx`, between the `<h1>` and the `{article ? … }` line, add:

```tsx
      {resolveText(bean.description ?? "").trim() ? (
        <p className="text-base text-muted-foreground">{resolveText(bean.description)}</p>
      ) : null}
```

- [ ] **Step 2: The admin header**

In `app/admin/bean/[id]/page.tsx`, immediately after the `<h1>` that renders `resolveText(bean.name)`,
add:

```tsx
          {resolveText(bean.description ?? "").trim() ? (
            <p className="text-sm text-muted-foreground">{resolveText(bean.description)}</p>
          ) : null}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: no tsc output; 0 failures.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/bean/[id]/page.tsx" "app/admin/bean/[id]/page.tsx"
git commit -m "feat: bean pages lead with their description"
```

---

## Task 8: Manual acceptance

**Files:** none (verification only)

- [ ] **Step 1: Give one bean a description, directly in Mongo**

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('beans').updateOne({slug:'wfts-wait-for-the-sun'},{\$set:{description:{en:'The title track, from demo to studio.',fr:'Le morceau-titre, de la démo au studio.'}}}); console.log('set'); process.exit(0) })"
```

- [ ] **Step 2: Check all four surfaces**

Run `npm run dev`, then:

- `/` — the description sits under the bean's link, muted, one line; plants and pods show theirs too.
- `/bean/wfts-wait-for-the-sun` — it reads as a lede under the title.
- `/api/graph` — `curl -s localhost:3000/api/graph | grep -c description` returns a non-zero count,
  and the node for `bean:wfts-wait-for-the-sun` carries the English text.
- `/admin/bean/wfts-wait-for-the-sun` — the same line under the header.

- [ ] **Step 3: Revert**

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('beans').updateOne({slug:'wfts-wait-for-the-sun'},{\$unset:{description:''}}); console.log('reverted'); process.exit(0) })"
```

Confirm `/` is back to bare bean links.

---

## Task 9: Documentation and PR

**Files:**
- Modify: `README.md` (the data-model Bean line, and the Pages section)
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: README**

In the **Architecture** list, extend the `**Bean**` bullet to read:

```markdown
* **Bean**: has a name, an optional description (one bilingual line — what preview cards, the Directory and the graph show), belongs to a pod (optional — can be standalone), and contains sprouts
```

In the **Pages** section, extend the `/` bullet:

```markdown
* `/` — Directory. For each plant (+ its pods, + a "Standalone" group for orphan beans): name, natures, description, and the beans beneath it, each with its own one-line description.
```

- [ ] **Step 2: ROADMAP**

Under **Track B**, append to the B3 status paragraph:

```markdown
    Slice 2 (describe) followed on 2026-08-22: `Bean.description`, descriptions rendered on the
    Directory and both bean pages, `description` in the `/api/graph` payload (reversing G1's
    withholding — the route already projects), and projected beans named from their envelope's title.
```

- [ ] **Step 3: Full sweep**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit and open the PR**

```bash
git add README.md docs/superpowers/ROADMAP.md
git commit -m "docs: document the describe layer"
git push -u origin slice-2-content-describe
```

Open the PR against `slice-1-content-render` (the stack's next link), with this Lab Note in the body:

    ## Lab Note

    ```yaml
    en:
      title: "Every piece of the garden introduces itself"
      summary: "Songs, features and episodes now carry a one-line description that shows up in the directory and on their own page, so you can tell what something is before opening it."
    fr:
      title: "Chaque élément du jardin se présente"
      summary: "Morceaux, features et épisodes ont maintenant une description d'une ligne, visible dans l'annuaire et sur leur page : tu sais ce que c'est avant de cliquer."
    suggested:
      molecule: ariko
      type: improvement
      tags: [changelog]
    ```

---

## Notes for the executor

- **The graph change is a reversal, not an addition.** `lib/graph.test.ts` currently asserts that
  descriptions must NOT appear, with fixtures literally named `"secret notes"`. Read spec §4 before
  touching them: the reasoning is that `/api/graph` composes `filterPublic`, so a serialized node is
  already public HTML. Keep every other leak assertion exactly as strict as it is.
- **`toGraph` still does not project.** Only the route may hand it unfiltered data — that was true
  for names and is now true for descriptions.
- **No migration.** `description` is optional; a bean without one renders exactly as before, which is
  what Task 8 step 3 verifies by reverting.
- **The cover is not in this slice** (spec §2.3) — no `coverFor`, no image rendering. It lands in
  slice 3 with the preview card that consumes it.
