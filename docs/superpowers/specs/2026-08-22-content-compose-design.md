# Slice 3 — Compose: pages made of other pages

**Date:** 2026-08-22
**Umbrella:** [`2026-08-22-content-composition-design.md`](2026-08-22-content-composition-design.md) §6 — this slice implements the compose layer.
**Status:** Approved design, ready for a plan.

---

## 1. Problem

Slice 1 renders a sprout's markdown; slice 2 gives every entity a line about itself. What is still
missing is the thing the Paulopus molecule actually is: **a page whose prose is interleaved with
live views of other pages.**

Three concrete gaps:

1. **No container page exists.** `/`, `/beanstalk` and `/bean/[id]` are the whole public surface.
   A plant is a card on the Directory; a pod is a heading that links nowhere. The molecule — the
   story of the project — has no home.
2. **No tier above a bean can hold narrative.** `content` lives on `Sprout`, and sprouts attach to
   beans only (every parent walk filters `BEAN_PREFIX`), so a plant-level narrative is structurally
   impossible today.
3. **A cross-reference is a dead string.** The molecule's 16 links into its focuses would be plain
   anchors, going stale the moment a focus is retitled, and invisible to `/api/graph`.

## 2. Decisions

1. **`content?: Text` on `Plant` and `Pod`.** Same field, same renderer, same optionality as
   everywhere else. This is what makes a container page more than a list of its children.
2. **One generic directive, not one per kind:** `::entity{ref=bean:karma-accountability}` as a
   block, `:entity[label]{ref=…}` inline. The `ref` reuses the prefixed grammar that `parents[]`,
   `relations[]`, graph node ids and pollen anchors all already speak, so the mirrored relation is
   the string **verbatim** — no reassembly, no second vocabulary, and one Tiptap node type in
   slice 4 rather than four.
3. **Blocks resolve fail-closed.** Public: a ref whose target did not survive `filterPublic` renders
   **nothing** — not a stub, not a name. Admin: the same ref renders visibly as an unresolved
   reference, because in the authoring zone a dangling ref is information. This is the rule
   `scrubRelations` already applies to `relations[]`, extended to prose.
4. **Refs mirror into `relations[]` at write time**, under two kinds: `embeds` for a block card,
   `mentions` for an inline reference. Two kinds rather than one because the graph should be able to
   tell "this page shows that thing" from "this page name-drops it". Mirroring is **derived state**:
   on every write, all existing `embeds`/`mentions` relations are dropped and re-derived from the
   content, while hand-authored kinds are left untouched. Idempotent by construction.
5. **The graph never parses prose.** It reads `relations[]`, exactly as it does today. Decision 4 is
   what makes that possible.
6. **The cover defers again — to roadmap B2.** Slice 2's spec said it would land here. It should not:
   there are still **zero `MediaImage`s in the database**, and B2 (image attach on the capture bar) is
   the slice that creates them. `coverFor` would be dead code with no data behind it for the second
   slice running. Cards render name, description and link. When B2 lands, the card gains an image and
   nothing else changes.
7. **Both container pages ship**: `/plant/[slug]` and `/pod/[slug]`, sharing one rendering component.
   The Directory's plant and pod names become links to them.
8. **Triage stops dropping bodies.** `/api/inbox` accepts and stores `content`, and
   `buildSproutInput` has never carried it onto the sprout — a body captured from a connector is
   silently lost at promote. That was invisible while nothing rendered content; now it is a hole in
   the only authoring path that exists. Three lines and a test, included here.

## 3. The pipeline additions

`lib/markdown.ts` grows, in the order slice 1's comment demanded:

- `remarkPlugins` gains `remarkDirective`, then a local `remarkEntity` transform that converts
  `containerDirective`/`leafDirective`/`textDirective` nodes named `entity` into hast elements:
  `hName: "entity-card"` (block) / `"entity-link"` (inline), with `hProperties: { ref, label? }`.
- `sanitizeSchema` widens to admit those two tag names and their attributes. **This is the failure
  slice 1 warned about**: a minted node absent from the schema is stripped silently, and the symptom
  is a card that simply never appears.
- Sanitization still runs **last**.

A directive whose `ref` is missing or malformed produces no element at all — it degrades to nothing
rather than to a broken card.

## 4. Resolution

Server components cannot use React context, so the dataset travels as a prop:

```ts
Prose({ content, resolve }: { content?: Text; resolve?: EntityResolver })
```

`EntityResolver` is `(ref: string) => ResolvedEntity | null`, built once per page from the dataset the
page already loaded — `getPublicDataset()` on public routes, `getFullDataset()` in the admin. No new
query, no N+1: resolution is a map lookup.

`lib/entity-resolve.ts` is pure and holds the whole rule:

```ts
interface ResolvedEntity { ref: string; kind: string; href: string; name: string; description?: string }
resolveEntity(dataset: Dataset, ref: string): ResolvedEntity | null
```

`href` is `/plant/<slug>` · `/pod/<slug>` · `/bean/<slug>`. A `sprout:` ref resolves to **null** for
now — sprouts still have no public URL, and a card that cannot link anywhere is worse than no card.
An unknown prefix, an unknown slug, or a target the passed dataset does not contain all return
`null`, which is what makes the public path fail-closed without any extra check: **the public dataset
is the projection.**

## 5. Container pages

`/plant/[slug]` and `/pod/[slug]` render, in order: name, description, `content` through `Prose`
(with blocks resolved), then a **mechanical** index of children — pods and beans for a plant, beans
for a pod. `notFound()` when the slug is absent from the public dataset, so a private container 404s
rather than existing as an empty shell.

The child index takes no authoring and never will: it is an aggregation with no argument to make.
The narrative above it is where the argument lives.

## 6. Write-time mirroring

`lib/entity-refs.ts`, pure:

```ts
extractRefs(content: Text | undefined): Relation[]   // [{ kind: "embeds"|"mentions", ref }]
mergeMirrored(existing: Relation[] | undefined, mirrored: Relation[]): Relation[]
```

`mergeMirrored` drops every existing `embeds`/`mentions` entry and appends the freshly derived ones,
preserving order and leaving all other kinds alone. Re-running it on unchanged content is a no-op.

Call sites — the three places content enters the database:

| Writer | Where |
|---|---|
| `scripts/migrate-garden.ts` | garden-authored sprouts, plants and pods |
| `lib/synthesis-store.ts` | the digest bee's draft sprouts |
| `app/admin/actions.ts` (promote) | a capture's carried body (decision 8) |

## 7. Testing

Pure logic, no DB:

- **`lib/markdown.test.ts`** — a block directive renders an `entity-card` element carrying its ref;
  an inline directive renders an `entity-link`; a directive with no `ref` renders nothing; **a
  directive still cannot smuggle a script or an event handler past the widened schema.**
- **`lib/entity-resolve.test.ts`** — each kind resolves to its href; an unknown slug, an unknown
  prefix and a `sprout:` ref all resolve to `null`; a target absent from the passed dataset resolves
  to `null` (the fail-closed case, exercised with `filterPublic`'s output).
- **`lib/entity-refs.test.ts`** — block and inline refs extract with the right kinds; duplicates
  collapse; `mergeMirrored` replaces prior mirrored entries, keeps hand-authored kinds, and is
  idempotent across two runs.
- **`lib/promote.test.ts`** — `buildSproutInput` carries the seed's content, and omits the field when
  the seed has none.

## 8. Acceptance

- A plant with `content` containing `::entity{ref=bean:…}` renders its prose with a live card for
  that bean, showing the name and description slice 2 gave it.
- Un-publishing the referenced bean makes the card **vanish** from the public page while the admin
  page still shows the ref as unresolved — the same withdrawal `/api/graph` performs on its edge.
- `/api/graph` shows an `embeds` edge from the container to the bean, derived from `relations[]`,
  with no prose parsing anywhere in the serializer.
- The Directory's plant and pod names link to their pages.

## 9. Out of scope, seams reserved

- **The cover** — roadmap B2, with the images that give it something to show (§2.6).
- **A public `/sprout/[slug]`** — until it exists, `sprout:` refs resolve to `null` (§4).
- **Tiptap** — the next slice: node views and a mention menu over this exact grammar.
- **The Paulopus import** — a content task, unblocked by this slice.
- **Media embeds and syntax highlighting** — still the open half of roadmap B3.
