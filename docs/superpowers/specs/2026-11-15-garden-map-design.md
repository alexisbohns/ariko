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

A file tree, not a left-to-right graph. Plants stand side by side across the
top; each plant's pods stand in a row under it; a pod's beans stack in an
indented column under it with a trunk line down the left; a bean's draft
sprouts and its seed count sit indented right under that bean. What hangs
directly off a plant (its own beans and sprouts) is a first column with no head
card, to the left of its pods. The Unrooted and Inbox buckets are roots too and
come last, after every plant. Every node is placed once, under its **primary
parent** (the source of the first edge into it); its other edges are kept and
drawn but move nothing, so a bean shared by two pods stands under the first.
A plant-to-pod edge leaves the plant's bottom and enters the pod's top; every
other edge leaves a trunk handle near the left of the parent's bottom and
enters the child's left, so a smoothstep draws the elbow. Nothing is ever
dropped: a node no root reaches goes into a final block.
- New dependency: `@xyflow/react` (verify the exact current version and React 19
  compatibility at install). The layout is our own arithmetic, so there is no
  graph-layout dependency.
- Live reads: the admin and every server action read the live garden. A map
  reading the cached one would show a pre-write garden.

## Interaction

Read-only. There is no write path, no server action and no side panel.

- A node is a small card: kind icon, name as a real `next/link` to its admin
  page (a client navigation, per the admin rule), the amber ring if waiting,
  chips for gaps. The card already carries everything a panel would list.
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
- `lib/garden-map-layout.test.ts` — every node positioned, no two overlap, a
  disconnected forest lays out.
- `lib/garden-map-source.test.ts` — the island imports types only from lib, and
  no file of the map imports an action or `lib/store.ts`.
- `lib/admin-nav.test.ts` / `lib/section-icons.test.ts` /
  `lib/admin-scope.test.ts` updated for the seventh section and for `bleed`.
- A short CLAUDE.md note: the map is a live-garden reader, and `bleed` is why.

## Out of scope

Editing from the map, saving positions, published sprouts as nodes, screens,
bees, a side panel.
