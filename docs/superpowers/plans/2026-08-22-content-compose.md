# Slice 3 — Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a container's prose embed live views of its children — `::entity{ref=bean:…}` resolved at render time, fail-closed — and give plants and pods pages to hold that prose.

**Architecture:** The slice-1 pipeline gains `remark-directive` plus a local transform that mints two custom elements; the sanitize schema widens to admit them. Resolution is a pure function over the dataset the page already loaded, passed to `Prose` as a prop because server components have no context. Refs mirror into `relations[]` at write time so the graph keeps reading stored refs.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `remark-directive` 4 + `unist-util-visit` 5 on top of slice 1's stack, tests via `node --import tsx --test`.

**Spec:** [`docs/superpowers/specs/2026-08-22-content-compose-design.md`](../specs/2026-08-22-content-compose-design.md)

---

## File structure

| File | Responsibility |
|---|---|
| `lib/markdown.ts` (modify) | `remarkDirective` + local `remarkEntity`; widened `sanitizeSchema`. |
| `lib/entity-resolve.ts` (create) | Pure `resolveEntity(dataset, ref)` → href/name/description, or `null`. |
| `lib/entity-refs.ts` (create) | Pure `extractRefs` + `mergeMirrored` — the write-time mirror. |
| `components/entity.tsx` (create) | `EntityCard` / `EntityLink`, both fail-closed. |
| `components/markdown.tsx` (modify) | `Prose` takes a `resolve` prop and wires the two components. |
| `app/(public)/plant/[slug]/page.tsx` (create) | Container page: name, description, prose, child index. |
| `app/(public)/pod/[slug]/page.tsx` (create) | The same, for pods. |
| `lib/data.ts` (modify) | `content?` on Plant and Pod; `getPlant`/`getPod` on `Dataset`. |
| `lib/promote.ts` (modify) | `buildSproutInput` carries the seed's content. |
| `scripts/migrate-garden.ts`, `lib/synthesis-store.ts`, `app/admin/actions.ts` (modify) | Mirror refs on write. |

---

## Task 1: Branch, dependencies, model

**Files:** `package.json`, `lib/data.ts`, `lib/data.test.ts`

- [ ] **Step 1: Branch and install**

```bash
git checkout main && git pull && git checkout -b slice-3-content-compose
npm install remark-directive@^4 unist-util-visit@^5
```

- [ ] **Step 2: Add `content` to the container tiers**

In `lib/data.ts`, add to **both** `Plant` and `Pod`, after their `description` line:

```ts
  content?: Text; // optional narrative — the container's own page (slice 3)
```

- [ ] **Step 3: Write the failing test for the new accessors**

Append to `lib/data.test.ts`:

```ts
test("getPlant and getPod look a container up by slug", () => {
  const data = buildDataset({
    plants: [{ slug: "p", name: "P", natures: ["work"], description: "" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:p"] }],
  });
  assert.equal(data.getPlant("p")?.slug, "p");
  assert.equal(data.getPod("m")?.slug, "m");
  assert.equal(data.getPlant("ghost"), undefined);
  assert.equal(data.getPod("ghost"), undefined);
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `node --import tsx --test lib/data.test.ts 2>&1 | grep -E "not a function|^ℹ fail"`
Expected: `data.getPlant is not a function`.

- [ ] **Step 5: Implement**

In `lib/data.ts`, add to the `Dataset` interface, beside `getBean`:

```ts
  getPlant(slug: string): Plant | undefined;
  getPod(slug: string): Pod | undefined;
```

and in `buildDataset`'s returned object (the maps `plantBySlug` / `podBySlug` already exist — reuse
them; build them if they do not):

```ts
    getPlant: (slug) => plantBySlug.get(slug),
    getPod: (slug) => podBySlug.get(slug),
```

- [ ] **Step 6: Verify and commit**

```bash
node --import tsx --test lib/data.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
npx tsc --noEmit
git add package.json package-lock.json lib/data.ts lib/data.test.ts
git commit -m "feat: containers can hold a narrative, and be looked up by slug"
```

---

## Task 2: The entity directive

**Files:** `lib/markdown.ts`, `lib/markdown.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/markdown.test.ts`:

```ts
test("a block entity directive mints an entity-card carrying its ref", () => {
  const html = render("::entity{ref=bean:karma-accountability}");
  assert.match(html, /<entity-card/);
  assert.match(html, /bean:karma-accountability/);
});

test("an inline entity directive mints an entity-link", () => {
  const html = render("see :entity[the karma page]{ref=bean:karma} for detail");
  assert.match(html, /<entity-link/);
  assert.match(html, /the karma page/);
});

test("a directive with no ref mints no card", () => {
  const html = render("::entity{}");
  assert.doesNotMatch(html, /entity-card/);
});

test("a directive cannot smuggle an event handler past the widened schema", () => {
  const html = render('::entity{ref=bean:x onclick="alert(1)"}');
  assert.doesNotMatch(html, /onclick/);
});

test("a non-entity directive is left alone", () => {
  const html = render("::note{ref=bean:x}");
  assert.doesNotMatch(html, /entity-card/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --import tsx --test lib/markdown.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: 5 failures.

- [ ] **Step 3: Implement the transform**

In `lib/markdown.ts`, above the plugin arrays:

```ts
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";

// The directive's shape, kept local: mdast-util-directive's node types arrive
// through declaration merging, and depending on them here would couple this
// file to a transitive dependency's type exports.
interface DirectiveNode {
  type: string;
  name?: string;
  attributes?: Record<string, string | null | undefined>;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

// Converts ::entity{ref=…} (block) and :entity[label]{ref=…} (inline) into the
// two custom elements the renderer maps to components. A directive with no ref
// mints nothing: it degrades to absence, never to a broken card. Runs BEFORE
// rehypeSanitize, whose schema must admit whatever this mints (spec §3).
function remarkEntity() {
  return (tree: unknown) => {
    visit(tree as never, (node: DirectiveNode) => {
      const block = node.type === "containerDirective" || node.type === "leafDirective";
      const inline = node.type === "textDirective";
      if ((!block && !inline) || node.name !== "entity") return;
      const ref = typeof node.attributes?.ref === "string" ? node.attributes.ref.trim() : "";
      if (!ref) return;
      node.data = {
        ...node.data,
        hName: block ? "entity-card" : "entity-link",
        hProperties: { "data-ref": ref },
      };
    });
  };
}
```

Replace the two exported arrays:

```ts
export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "entity-card", "entity-link"],
  attributes: {
    ...defaultSchema.attributes,
    "entity-card": ["dataRef"],
    "entity-link": ["dataRef"],
  },
};

export const remarkPlugins: PluggableList = [remarkGfm, remarkDirective, remarkEntity];
```

If the ref does not survive sanitization, the schema key is the wrong spelling — try `"data-ref"`
instead of `"dataRef"`. The test in step 1 tells you immediately which one this version wants; do not
guess, run it.

- [ ] **Step 4: Verify and commit**

```bash
node --import tsx --test lib/markdown.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
git add lib/markdown.ts lib/markdown.test.ts
git commit -m "feat: an entity directive that survives sanitization"
```

---

## Task 3: Resolution

**Files:** `lib/entity-resolve.ts`, `lib/entity-resolve.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/entity-resolve.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, filterPublic, type RawGarden } from "./data";
import { resolveEntity } from "./entity-resolve";

const garden: RawGarden = {
  plants: [{ slug: "paulopus", name: "Paulopus", natures: ["work"], description: "The oracle." }],
  pods: [{ slug: "celesta", name: "Celesta", description: "An album.", parents: ["plant:paulopus"] }],
  beans: [
    { slug: "karma", name: "Karma", description: "How it scores.", parents: ["plant:paulopus"] },
    { slug: "hidden", name: "Hidden", parents: ["plant:paulopus"], visibility: "private" },
  ],
};

test("each kind resolves to its page", () => {
  const data = buildDataset(garden);
  assert.deepEqual(resolveEntity(data, "plant:paulopus"), {
    ref: "plant:paulopus",
    kind: "plant",
    href: "/plant/paulopus",
    name: "Paulopus",
    description: "The oracle.",
  });
  assert.equal(resolveEntity(data, "pod:celesta")?.href, "/pod/celesta");
  assert.equal(resolveEntity(data, "bean:karma")?.href, "/bean/karma");
});

test("a description is omitted when blank", () => {
  const data = buildDataset({ beans: [{ slug: "b", name: "B", parents: [] }] });
  assert.equal("description" in resolveEntity(data, "bean:b")!, false);
});

test("unknown slug, unknown prefix and sprout refs resolve to null", () => {
  const data = buildDataset(garden);
  assert.equal(resolveEntity(data, "bean:ghost"), null);
  assert.equal(resolveEntity(data, "bee:something"), null);
  assert.equal(resolveEntity(data, "sprout:anything"), null);
  assert.equal(resolveEntity(data, "nonsense"), null);
});

test("fail-closed: a target the projection dropped resolves to null", () => {
  const publicData = buildDataset(filterPublic(garden));
  assert.equal(resolveEntity(publicData, "bean:hidden"), null);
  assert.notEqual(resolveEntity(publicData, "bean:karma"), null);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --import tsx --test lib/entity-resolve.test.ts 2>&1 | grep -E "Cannot find|^ℹ fail"`
Expected: `Cannot find module './entity-resolve'`.

- [ ] **Step 3: Implement**

Create `lib/entity-resolve.ts`:

```ts
import { BEAN_PREFIX, PLANT_PREFIX, POD_PREFIX, resolveText, type Dataset } from "./data";

export interface ResolvedEntity {
  ref: string;
  kind: "plant" | "pod" | "bean";
  href: string;
  name: string;
  description?: string;
}

export type EntityResolver = (ref: string) => ResolvedEntity | null;

// Pure. Turns a prefixed ref into what a card needs, or null.
//
// null is the whole security story: the caller passes the dataset it is allowed
// to show — filterPublic's projection on a public page, the full one in the
// admin — so a hidden target is simply absent, and a card over it renders
// nothing without any extra check. sprout: refs resolve to null too: sprouts
// have no public URL yet, and a card that cannot link anywhere is worse than no
// card (spec §4).
export function resolveEntity(dataset: Dataset, ref: string): ResolvedEntity | null {
  const found = ref.startsWith(PLANT_PREFIX)
    ? ({ kind: "plant", href: "/plant/", doc: dataset.getPlant(ref.slice(PLANT_PREFIX.length)) } as const)
    : ref.startsWith(POD_PREFIX)
      ? ({ kind: "pod", href: "/pod/", doc: dataset.getPod(ref.slice(POD_PREFIX.length)) } as const)
      : ref.startsWith(BEAN_PREFIX)
        ? ({ kind: "bean", href: "/bean/", doc: dataset.getBean(ref.slice(BEAN_PREFIX.length)) } as const)
        : null;
  if (!found?.doc) return null;

  const description = resolveText(found.doc.description ?? "").trim();
  return {
    ref,
    kind: found.kind,
    href: found.href + found.doc.slug,
    name: resolveText(found.doc.name),
    ...(description ? { description } : {}),
  };
}
```

- [ ] **Step 4: Verify and commit**

```bash
node --import tsx --test lib/entity-resolve.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
git add lib/entity-resolve.ts lib/entity-resolve.test.ts
git commit -m "feat: resolve an entity ref against whatever dataset the caller may show"
```

---

## Task 4: The card and the link

**Files:** `components/entity.tsx`, `components/markdown.tsx`

- [ ] **Step 1: Write the components**

Create `components/entity.tsx`:

```tsx
import type { ReactNode } from "react";
import type { EntityResolver } from "@/lib/entity-resolve";
import { Card, CardContent } from "@/components/ui/card";

// Fail-closed (spec §2.3): an unresolved ref renders NOTHING on a public page.
// The admin passes `showUnresolved` so a dangling ref stays visible where it is
// information rather than a leak.
export function EntityCard({
  refValue,
  resolve,
  showUnresolved,
}: {
  refValue?: string;
  resolve?: EntityResolver;
  showUnresolved?: boolean;
}) {
  const entity = refValue && resolve ? resolve(refValue) : null;
  if (!entity) {
    return showUnresolved ? (
      <p className="text-xs text-muted-foreground">unresolved reference: {refValue ?? "(no ref)"}</p>
    ) : null;
  }
  return (
    <Card className="not-prose my-4">
      <CardContent className="flex flex-col gap-1 py-4">
        <a href={entity.href} className="text-sm font-medium underline-offset-4 hover:underline">
          {entity.name}
        </a>
        {entity.description ? (
          <p className="text-xs text-muted-foreground">{entity.description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Inline: the label the author wrote, or the entity's own name when they wrote
// none. Unresolved inline refs degrade to their label as plain text — the
// sentence must still read.
export function EntityLink({
  refValue,
  resolve,
  children,
}: {
  refValue?: string;
  resolve?: EntityResolver;
  children?: ReactNode;
}) {
  const entity = refValue && resolve ? resolve(refValue) : null;
  if (!entity) return <>{children}</>;
  return (
    <a href={entity.href} className="underline-offset-4 hover:underline">
      {children ?? entity.name}
    </a>
  );
}
```

- [ ] **Step 2: Wire them into `Prose`**

In `components/markdown.tsx`, change the signature and build the components map per render so it can
close over the resolver:

```tsx
export function Prose({
  content,
  resolve,
  showUnresolved,
}: {
  content?: Text;
  resolve?: EntityResolver;
  showUnresolved?: boolean;
}) {
  const source = resolveText(content ?? "").trim();
  if (!source) return null;

  // Built per render: server components have no context, so the resolver is
  // closed over here rather than provided (spec §4). The two custom tag names
  // are not in react-markdown's element map, hence the cast.
  const components = {
    ...baseComponents,
    "entity-card": (props: { "data-ref"?: string }) => (
      <EntityCard refValue={props["data-ref"]} resolve={resolve} showUnresolved={showUnresolved} />
    ),
    "entity-link": (props: { "data-ref"?: string; children?: ReactNode }) => (
      <EntityLink refValue={props["data-ref"]} resolve={resolve}>
        {props.children}
      </EntityLink>
    ),
  } as Components;
  …
}
```

Rename the existing module-level `components` constant to `baseComponents`.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add components/entity.tsx components/markdown.tsx
git commit -m "feat: entity cards and links, fail-closed by construction"
```

---

## Task 5: Container pages

**Files:** `app/(public)/plant/[slug]/page.tsx`, `app/(public)/pod/[slug]/page.tsx`, `app/(public)/page.tsx`

- [ ] **Step 1: The plant page**

Create `app/(public)/plant/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";
import { resolveEntity } from "@/lib/entity-resolve";
import { Prose } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PlantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicDataset();
  const plant = data.getPlant(slug);
  if (!plant) notFound(); // a private container 404s rather than existing as an empty shell

  const pods = data.podsForPlant(slug);
  const beans = data.beansForPlant(slug);

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">{resolveText(plant.name)}</h1>
        <div className="flex flex-wrap gap-1.5">
          {plant.natures.map((nature) => (
            <Badge key={nature} variant="secondary">
              {nature}
            </Badge>
          ))}
        </div>
        {resolveText(plant.description ?? "").trim() ? (
          <p className="text-base text-muted-foreground">{resolveText(plant.description)}</p>
        ) : null}
      </header>

      <Prose content={plant.content} resolve={(ref) => resolveEntity(data, ref)} />

      {/* Mechanical index — an aggregation with no argument to make (spec §5). */}
      {pods.length > 0 || beans.length > 0 ? (
        <nav className="flex flex-col gap-2">
          <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
            Inside
          </h2>
          <ul className="flex flex-col gap-1">
            {pods.map((pod) => (
              <li key={pod.slug}>
                <a href={`/pod/${pod.slug}`} className="text-sm underline-offset-4 hover:underline">
                  {resolveText(pod.name)}
                </a>
              </li>
            ))}
            {beans.map((bean) => (
              <li key={bean.slug}>
                <a href={`/bean/${bean.slug}`} className="text-sm underline-offset-4 hover:underline">
                  {resolveText(bean.name)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 2: The pod page**

Create `app/(public)/pod/[slug]/page.tsx` — the same file with `getPod`, `beansForPod`, no natures
badges, and only the bean list in the index.

- [ ] **Step 3: Link them from the Directory**

In `app/(public)/page.tsx`, wrap the plant's `CardTitle` text and the pod's `<h3>` text in anchors to
`/plant/${plant.slug}` and `/pod/${pod.slug}`, keeping the existing classes and adding
`underline-offset-4 hover:underline`.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"
git add "app/(public)/plant" "app/(public)/pod" "app/(public)/page.tsx"
git commit -m "feat: plants and pods have pages, and the Directory leads to them"
```

---

## Task 6: Resolvers on the existing pages

**Files:** `app/(public)/bean/[id]/page.tsx`, `app/admin/sprout/[slug]/page.tsx`

- [ ] **Step 1: The public bean page**

Pass a resolver over the dataset it already loaded:

```tsx
      {article ? (
        <Prose content={article.content} resolve={(ref) => resolveEntity(data, ref)} />
      ) : null}
```

- [ ] **Step 2: The admin preview**

The admin page loads a single sprout, not a dataset, so it needs one:

```tsx
import { getFullDataset } from "@/lib/store";
import { resolveEntity } from "@/lib/entity-resolve";
…
  const dataset = await getFullDataset();
…
              <Prose
                content={version.content}
                resolve={(ref) => resolveEntity(dataset, ref)}
                showUnresolved
              />
```

`showUnresolved` is the admin's whole difference: a dangling ref is information here, not a leak.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"
git add "app/(public)/bean/[id]/page.tsx" "app/admin/sprout/[slug]/page.tsx"
git commit -m "feat: rendered content resolves its entity refs"
```

---

## Task 7: Write-time mirroring

**Files:** `lib/entity-refs.ts`, `lib/entity-refs.test.ts`, then the three writers

- [ ] **Step 1: Write the failing tests**

Create `lib/entity-refs.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractRefs, mergeMirrored } from "./entity-refs";

test("block refs extract as embeds, inline as mentions", () => {
  assert.deepEqual(
    extractRefs("intro\n\n::entity{ref=bean:karma}\n\nsee :entity[here]{ref=plant:paulopus}"),
    [
      { kind: "embeds", ref: "bean:karma" },
      { kind: "mentions", ref: "plant:paulopus" },
    ],
  );
});

test("duplicates collapse, and a localized value reads its en part", () => {
  assert.deepEqual(extractRefs("::entity{ref=bean:k}\n\n::entity{ref=bean:k}"), [
    { kind: "embeds", ref: "bean:k" },
  ]);
  assert.deepEqual(extractRefs({ en: "::entity{ref=bean:k}" }), [{ kind: "embeds", ref: "bean:k" }]);
});

test("no content, no refs", () => {
  assert.deepEqual(extractRefs(undefined), []);
  assert.deepEqual(extractRefs("just prose"), []);
});

test("mergeMirrored replaces prior mirrored entries and keeps authored ones", () => {
  const existing = [
    { kind: "evolves-from", ref: "bean:old" },
    { kind: "embeds", ref: "bean:gone" },
  ];
  assert.deepEqual(mergeMirrored(existing, [{ kind: "embeds", ref: "bean:new" }]), [
    { kind: "evolves-from", ref: "bean:old" },
    { kind: "embeds", ref: "bean:new" },
  ]);
});

test("mergeMirrored is idempotent", () => {
  const mirrored = [{ kind: "embeds", ref: "bean:k" }];
  const once = mergeMirrored([], mirrored);
  assert.deepEqual(mergeMirrored(once, mirrored), once);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --import tsx --test lib/entity-refs.test.ts 2>&1 | grep -E "Cannot find|^ℹ fail"`

- [ ] **Step 3: Implement**

Create `lib/entity-refs.ts`:

```ts
import { resolveText, type Relation, type Text } from "./data";

const MIRRORED_KINDS = new Set(["embeds", "mentions"]);

// Block form ::entity{ref=…} at the start of a line; inline form :entity[…]{ref=…}
// anywhere. Deliberately a scan, not a parse: this runs on write, where the cost
// of a full mdast pass per document is not worth it and the grammar is fixed.
const BLOCK = /^::entity\{[^}]*\bref=([^\s}]+)/gm;
const INLINE = /(?<!:):entity\[[^\]]*\]\{[^}]*\bref=([^\s}]+)/g;

// Pure. The refs a document points at, as relations ready to mirror.
export function extractRefs(content: Text | undefined): Relation[] {
  const source = resolveText(content ?? "");
  if (!source.trim()) return [];
  const out: Relation[] = [];
  const seen = new Set<string>();
  const add = (kind: string, ref: string) => {
    const key = `${kind} ${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, ref });
  };
  for (const m of source.matchAll(BLOCK)) add("embeds", m[1]);
  for (const m of source.matchAll(INLINE)) add("mentions", m[1]);
  return out;
}

// Pure. Mirrored relations are DERIVED state: every write drops the previous
// embeds/mentions and re-adds what the content says now, leaving hand-authored
// kinds untouched. Idempotent on unchanged content.
export function mergeMirrored(existing: Relation[] | undefined, mirrored: Relation[]): Relation[] {
  return [...(existing ?? []).filter((r) => !MIRRORED_KINDS.has(r.kind)), ...mirrored];
}
```

- [ ] **Step 4: Wire the three writers**

In `scripts/migrate-garden.ts`, for sprouts, plants and pods, replace the `$set: { ...v }` spread with
one that mirrors first:

```ts
    const relations = mergeMirrored(v.relations, extractRefs(v.content));
    const doc = { ...v, ...(relations.length > 0 ? { relations } : {}) };
```

In `lib/synthesis-store.ts`'s `upsertDigestDrafts`, add to the `$set`:

```ts
          relations: mergeMirrored(undefined, extractRefs(d.content)),
```

In `app/admin/actions.ts`, after `buildSproutInput`, mirror the carried content (Task 8 makes that
content exist):

```ts
    const input = buildSproutInput(formData, seed, beanSlug);
    const relations = mergeMirrored(undefined, extractRefs(input.content));
```

and pass `relations` through `createSprout` when non-empty.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npm test 2>&1 | grep -E "^ℹ (pass|fail)"
git add lib/entity-refs.ts lib/entity-refs.test.ts scripts/migrate-garden.ts lib/synthesis-store.ts app/admin/actions.ts
git commit -m "feat: refs in prose become edges in the graph"
```

---

## Task 8: Triage stops dropping bodies

**Files:** `lib/promote.ts`, `lib/promote.test.ts`, `lib/botanical.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/promote.test.ts`:

```ts
test("buildSproutInput carries the seed's captured body", () => {
  const withBody = { ...seed, content: { en: "# A captured body" } };
  const form = new FormData();
  form.set("sproutSlug", "s");
  form.set("sproutName", "S");
  form.set("type", "note");
  form.set("date", "2026-08-22");
  assert.deepEqual(buildSproutInput(form, withBody, null).content, { en: "# A captured body" });
});

test("buildSproutInput omits content when the seed has none", () => {
  const form = new FormData();
  form.set("sproutSlug", "s");
  form.set("sproutName", "S");
  form.set("type", "note");
  form.set("date", "2026-08-22");
  assert.equal("content" in buildSproutInput(form, seed, null), false);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --import tsx --test lib/promote.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"`

- [ ] **Step 3: Implement**

Add `content?: Text` to `SproutInput`, and in `buildSproutInput`'s returned object:

```ts
    // The inbox has always accepted a body; until now promote dropped it on the
    // floor (spec §2.8). Carried verbatim, like media and provenance.
    ...(seed.content ? { content: seed.content } : {}),
```

Confirm `createSprout` in `lib/botanical.ts` writes `content` — if it enumerates fields, add it.

- [ ] **Step 4: Verify and commit**

```bash
node --import tsx --test lib/promote.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
npx tsc --noEmit
git add lib/promote.ts lib/promote.test.ts lib/botanical.ts
git commit -m "fix: a captured body survives triage"
```

---

## Task 9: Manual acceptance

**Files:** none

- [ ] **Step 1: Give a plant a narrative with a live card**

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('plants').updateOne({slug:'pbbls'},{\$set:{content:'## What it is\n\nA sentence of narrative.\n\n::entity{ref=bean:pbbls-webapp}\n\nAnd an inline :entity[mention]{ref=bean:pbbls-ios} in a sentence.\n'}}); console.log('set'); process.exit(0) })"
```

- [ ] **Step 2: Check the page**

`npm run dev`, then open `/plant/pbbls` (note the port — 3000 may be taken).
Expected: the prose renders, the block ref becomes a card carrying `Pebbles Webapp` and its
description, the inline ref is a link, and the "Inside" index lists the plant's beans.

- [ ] **Step 3: Prove fail-closed**

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('beans').updateOne({slug:'pbbls-webapp'},{\$set:{visibility:'private'}}); console.log('hidden'); process.exit(0) })"
```

Reload `/plant/pbbls`. Expected: **the card is gone entirely** — no name, no stub, no gap in the
sentence. Then restore:

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('beans').updateOne({slug:'pbbls-webapp'},{\$set:{visibility:'public'}}); console.log('restored'); process.exit(0) })"
```

- [ ] **Step 4: Revert the fixture**

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('plants').updateOne({slug:'pbbls'},{\$unset:{content:''}}); console.log('reverted'); process.exit(0) })"
```

---

## Task 10: Documentation and PR

**Files:** `README.md`, `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Document the compose layer**

Extend the README's "Rich content" section with the directive grammar, the fail-closed rule, the two
mirrored relation kinds, and the two new routes.

- [ ] **Step 2: Roadmap**

Append slice 3 to the B3 status paragraph, and note that the cover moved to B2.

- [ ] **Step 3: Full sweep and PR**

```bash
npm test && npx tsc --noEmit && npm run build
git add README.md docs/superpowers/ROADMAP.md
git commit -m "docs: document the compose layer"
git push -u origin slice-3-content-compose
```

Open the PR against `main` with a Lab Note whose benefit is *pages that show their own pieces*.

---

## Notes for the executor

- **Sanitize last, and widen the schema.** A minted element absent from `sanitizeSchema` disappears
  with no error. If a card never renders, check the schema before anything else.
- **Fail-closed is the point.** The public page passes the projected dataset; that is the whole
  mechanism. Never add a visibility check inside a component — one projection, one place.
- **`sprout:` refs resolve to null** until sprouts get a public URL. That is deliberate, not a gap.
- **Mirrored relations are derived.** Never hand-author an `embeds`/`mentions` relation: the next
  write drops it.
