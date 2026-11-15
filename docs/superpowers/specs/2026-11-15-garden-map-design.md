# The garden map — design

**Date:** 2026-11-15
**Status:** approved in conversation, awaiting plan

## Problem

The admin navigates the garden through tables: plants, pods, beans, sprouts,
inbox. Each answers "what is in this list" and none answers "what does the whole
garden look like, where is it thin, and what is waiting for me". Planting
(`garden:plant`) and the article door both write **private** things by design, so
review debt accumulates out of sight, and a plant with no pods or a bean with no
narrative is only discoverable by opening it.

## What it is

A read-only React Flow map of the garden at `/admin/map`. It draws the
botanical containment tree and marks two things on it: what **waits for review**
and what is **missing**.

## Nodes and edges

| Node | Drawn when | Edges |
|---|---|---|
| Plant | always | — (root) |
| Pod | always | plant → pod |
| Bean | always | pod → bean, or plant → bean when it skips the pod |
| Sprout | **drafts only** (`stateOf(sprout) === "draft"`: `state` absent or `draft`). A `private` sprout is a deliberate hold, not a wait | to every ref in `about`; to its `plant:` parent when `about` is empty |
| Seed | `status === "inbox"` only, drawn as **one count node per attachment point** ("62 seeds"), never one node each | parent → count node; the parent is the most specific of `suggested.beanSlug` / `podSlug` / `plantSlug` that resolves, else the Inbox node |

- **Published sprouts are not drawn.** They would turn the garden into a
  hairball. They still count toward "bean has no journal".
- **An unresolved sprout keeps its links.** A draft sprout `resolveSproutPlant`
  cannot resolve still gets an edge from every existing pod or bean its `about`
  names (so an ambiguous one visibly bridges two trees); it falls to Unrooted
  only when it names nothing that exists.
- **Seeds are one count node per parent.** 62 inbox seeds on one plant stacked
  into a ~7,200px column and fit-to-screen zoomed to ~11%, unreadable, so the
  seeds that resolve to the same target are grouped into one node
  (`seeds:<target id>`, label `N seed(s)`, `count`). It links to the plant-level
  inbox (`/admin/inbox?plant=<slug>`, the plant the parent sits under; bare
  `/admin/inbox` for the Inbox node or an unrooted parent) — the inbox filters on
  a seed's own suggested plant, so that is not an exact list of these seeds.
  Draft sprouts stay individual nodes. `stats` is **weighted** by `count`
  (`waiting`, `gaps` and `total` all count a "62 seeds" node as 62), and `total`
  leaves buckets out.
- **Seeds resolve against the whole garden, then scope filters.** A seed's most
  specific suggestion is chosen without regard to scope, so it never attaches to
  different nodes in different scopes; scoped, it is dropped when that target is
  out of scope. A bucket is never dimmed by a view.
- **Unrooted cluster.** Pods with no resolvable plant, beans with no pod nor
  plant, and sprouts `resolveSproutPlant` cannot resolve (ambiguous or
  anchorless) hang off one synthetic **Unrooted** node. The detached state is
  itself a missing part.
- **Inbox node.** Seeds with no resolvable suggestion hang off one synthetic
  **Inbox** node.
- Scoped (`?plant=`), the map keeps only what rolls up to that plant: its pods,
  their beans, its direct beans, the draft sprouts whose derived plant it is, and
  the seeds whose suggestion lands on one of those. The Unrooted and Inbox nodes
  are not drawn scoped.
- A pod or bean with two parents is drawn once, with an edge from each.
- A sprout is drawn once, with an edge per `about` ref. Its plant is **never
  re-derived** here: the map calls `resolveSproutPlant`, the one derivation.

## Flags

**Waiting for review** — drawn as an amber ring:

- a plant, pod or bean whose visibility is not `"public"` (absent means public,
  per the repo-wide rule — use `visibilityOf`, never a raw compare);
- a draft sprout (a `private` one is a decision already made);
- a seed in the inbox.

**Missing** — drawn as chips on the node:

- **No narrative** — plant, pod, bean with `!hasNarrative(content)`.
- **No FR half** — only where the narrative exists in English and the French
  half is empty. A missing narrative is reported once, as "no narrative", never
  also as "no FR".
- **No children** — a plant with no pods and no beans; a pod with no beans; a
  bean with no sprouts of **any** state (this is why published sprouts must be
  read even though they are not drawn).
- A machine-projected bean is exempt from **every** gap, not only "no
  narrative": it has no journal by construction, so "no children" would flag
  each one.

## Images

A node carries an optional `image`, a ready-to-draw thumbnail URL. Sources, per
kind: a **plant** its `logo`; a **bean** `fillCoverFor` (`lib/bean-cover.ts`: the
explicit `cover` wins, else the first image of its newest sprout that has one);
a **pod** borrows the first bean cover its beans offer (`podCoverFrom`). Buckets,
sprouts and seed counts never have one. The admin is read-only, so the bean
derivation reads sprouts of **any** state (a draft's image counts), newest first,
indexed in one pass over the sprouts; the public zone's published-only rule does
not apply here. Thumbnails are requested at 2x the card they are drawn into
(`MAP_THUMB`: plant 144, pod 400x140, bean 88) through the existing Cloudinary
transform, `cloudinaryThumb` in `lib/image-url.ts`, which leaves a non-Cloudinary
URL, an SVG or an already-transformed one untouched. **Absent means the card
draws a monogram / initial tile** — `image` is never an empty string.

## Page, scope, column

- `/admin/map` under `app/admin/(chrome)/`, so `middleware.ts` gates it with no
  new auth code. `export const dynamic = "force-dynamic"`.
- New `NavId` `map`: a `NAV_ITEMS` entry, a `SECTION_KEYS` entry (`["plant"]`),
  and an icon in `app/admin/_components/section-icons.ts`. `lib/section-icons.test.ts`
  and `lib/admin-nav.test.ts` already force the three to agree.
- Scope follows `lib/admin-scope.ts`. Unscoped: the whole garden, a forest, one
  tree per plant. `?plant=slug`: that plant's tree only. Unlike Beanstalk, a plant
  tree is naturally filterable, so the rail keeps **Map** when scoped (rail:
  7 items unscoped and 7 scoped — Overview comes in, Beanstalk drops out — inside the Alt+1–9 hotkeys).
- `resolveColumn` gains a third member, `"bleed"`, for `/admin/map`: the canvas
  fills the viewport and the floating chrome plates sit over it. `AdminMain` in
  `admin-chrome.tsx` handles it. The minimap sits bottom-right (from `lg` up)
  and the zoom controls bottom-left (from `md` up); the view toolbar is
  bottom-centre. All three keep clear of the vertically centred left rail and the
  two top clusters.

## Data flow

```
page.tsx (force-dynamic)
  loadRawGarden() + listSeeds()                    // live readers, never the cache
    → lib/garden-map.ts         pure: nodes, edges, flags, stats, view dimming
    → lib/garden-map-layout.ts  pure: deterministic column layout, fixed size per node kind
    → <GardenMap/>              thin @xyflow/react island, draws positioned nodes
```

- Both lib modules are pure and JSX-free so `npm test` reaches the rules.
- **The island imports types only** from them (`import type`). `lib/data.ts`
  opens with `node:fs`; a runtime import fails the build. This is the trap
  `lib/palette.ts` / `lib/palette-items.ts` already document, and a source test
  pins it.
- Layout runs on the server; the client ships no layout code.

### Layout

A bloom, not a graph and not a file tree. Plants stand side by side across the
top (y = 0), each card a **pill**: a large round medallion (the logo) with the
name beside it at 24px and the chips under the name. Every plant owns a
**block**, and every block's columns start on one row, so rows align across
plants. The Unrooted and Inbox buckets are roots too and come last.

Sizes are fixed per kind (`KIND_SIZE`): plant 300x88, pod 220x124, bean 220x60,
sprout and seed count 180x44, bucket 150x44. Under a root there are columns
`COLUMN_WIDTH` (220) wide, `COLUMN_GAP` (28) apart, and **every card is centred
in its column — nothing is indented**:

- a **pod column** is the pod card on top and its beans stacked straight down
  beneath it, each bean's draft sprouts and seed count right under that bean
  (depth-first, `ITEM_GAP` 28 between cards);
- a **loose cell** is any other child of the root — a bean planted directly on a
  plant, a plant-level draft sprout, a seed count — stacked the same way with
  its own descendants under it. Loose cells form a **grid**, row-major in input
  order, two across when the root also has pods and four across when it has
  none (a plant with nine direct beans fans out as four, four, one). A grid row
  is as tall as its tallest cell and rows are two item gaps apart. With pods
  present the grid is the leftmost thing in the block and the pod columns follow
  to its right.

The root card is centred over its block (block width = the wider of the card and
its content). Every node is placed once, under its **primary parent** (the
source of the first edge into it); its other edges are kept and drawn but move
nothing, so a bean shared by two pods stands under the first. Nothing is ever
dropped: a node no root reaches goes into a final block.

**Edges** are plain soft Bezier curves from the bottom-centre of the source to
the top-centre of the target. There are no elbows, no trunk and no handle ids:
each card has one hidden target on top and one hidden source below. Edges draw
under the opaque cards, so the stem from a pod to its fifth bean passes behind
beans one to four and shows only in the gaps; that is the look and is not
special-cased.

**Images** come from the builder (`MapNode.image`, a ready Cloudinary thumbnail:
a plant's logo, a bean's cover, a pod's borrowed cover). A pod card has a wide
cover across its top, a bean a square thumbnail on the left, a plant the
medallion. A node with no image draws its initial on a quiet tile in the same
box, so a missing picture moves nothing.
- New dependency: `@xyflow/react` (verify the exact current version and React 19
  compatibility at install). The layout is our own arithmetic, so there is no
  graph-layout dependency.
- Live reads: the admin and every server action read the live garden. A map
  reading the cached one would show a pre-write garden.

## Interaction

Read-only **on the canvas**: no write path, no server action. Editing happens in
the entity's own page, shown in a side sheet over the map
([`2026-11-15-map-entity-sheet-design.md`](2026-11-15-map-entity-sheet-design.md)).

- A node is a card sized by its kind: a plant is a pill with a medallion, a pod
  has a cover on top, a bean a thumbnail on the left. The name is a real
  `next/link` to its admin page (a client navigation, per the admin rule), and
  the link is **stretched** (`after:absolute after:inset-0` on a `relative`
  card), so the WHOLE card is the click target while the name stays the one tab
  stop and the accessible text. It carries `pointer-events-auto` (React Flow
  gives a non-interactive node wrapper an inline `pointer-events: none`),
  `prefetch={false}` and `draggable={false}`. The amber ring and the word
  "Waiting" say what waits; chips say what is missing. The images are plain
  decorative `<img alt="" loading="lazy">`, not `next/image`: the thumbnail is
  already cut to size.
- Nodes are not draggable and positions are not saved, so there is no layout
  state to lose or to leak.
- Toolbar: **All · Needs review · Has gaps**, each with a count. It is
  `?view=review|gaps` in the URL, read server-side (the filters rule: a filtered
  view is shareable and filtering is server-side). Non-matching nodes are
  **dimmed, not hidden**, so the tree's shape stays readable. The builder sets
  the dim flag; the island has no filter logic.

## Edge cases

- Load failure: the destructive `Alert`, like the other admin pages.
- Empty garden / empty scope: one line of text, no canvas.
- Dark mode: node colours are design tokens; React Flow's `colorMode` follows
  the `dark` class (the theme is localStorage + a class, so the server cannot
  name it — sync client-side, not from props).
- Slugs that a seed suggests but the garden no longer has resolve to nothing and
  fall to the Inbox node, never to a dangling edge.

## Testing

- `lib/garden-map.test.ts` — every flag, the orphan cluster, an ambiguous
  sprout, an `about` spanning two refs, seed attachment and its fall-back, the
  projected-bean exemption, "no narrative" suppressing "no FR", a bean whose only
  sprout is published (has a journal, draws no sprout node), scope filtering, and
  `view` dimming.
- `lib/garden-map-layout.test.ts` — every node positioned, columns centred, the
  direct-bean grid and its place beside pods, no two overlap, a disconnected
  forest lays out, edges untouched.
- `lib/garden-map-source.test.ts` — the island imports types only from lib, and
  no file of the map imports an action or `lib/store.ts`.
- `lib/admin-nav.test.ts` / `lib/section-icons.test.ts` /
  `lib/admin-scope.test.ts` updated for the seventh section and for `bleed`.
- A short CLAUDE.md note: the map is a live-garden reader, and `bleed` is why.

## Out of scope

Saving positions, published sprouts as nodes, screens, bees. (Editing from the
map and a side panel were out of scope here and are now
[their own slice](2026-11-15-map-entity-sheet-design.md).)
