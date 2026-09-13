# Parenting chrome — design

**Date:** 2026-09-13
**Status:** approved, not yet planned

## What

A floating chrome cluster, magnet `top-center`, that says where the entity you
are looking at hangs from: `plant | pod | bean`, outermost first. On
`pbbls-d8-0` it reads as the pbbls plant's logo, the `pbbls-karma` pod, and the
`pbbls-d8` bean — three items, each a link to its parent.

It ships in **both zones** out of one file, which is the shared-surfaces rule
(CLAUDE.md): one geometry, and what differs is a parameter.

## Why

The ancestry is in the data and nowhere on the page. The admin sprout page has a
single "back to bean" link — one parent of three tiers, one direction — and the
public bean and pod pages have nothing. Moving up a tier means the rail, the
palette, or the URL bar.

## The lineage model — `lib/lineage.ts`

Pure and JSX-free, beside `lib/admin-nav.ts`, for the same reason: the component
is rendered, this is arithmetic, and `npm test` reaches arithmetic without a DB.

```ts
export interface LineageEntry {
  slug: string;
  name: string;   // resolved to the reading language by the CALLER's garden
  href: string;
  logoUrl?: string; // plants only
}
export interface LineageTier {
  kind: "plant" | "pod" | "bean";
  entries: LineageEntry[];
}
export type Lineage = LineageTier[]; // outermost first

export function resolveLineage(raw: RawGarden, ref: string): Lineage;
```

`ref` is the prefixed-ref grammar the rest of the repo already speaks
(`sprout:x`, `bean:x`, `pod:x`, `screen:x`). The climb uses
`parentsWithPrefix`, exactly as `publishCascade` does, and **drops dangling
refs** exactly as `publishCascade` and `filterPublic` drop them.

A tier with zero entries is **omitted from the array**, never rendered empty. A
bean that hangs directly off a plant has no pod tier, and an absent item is a
statement about the entity rather than a slot that failed to fill — the same
argument `components/plant-header.tsx` makes for its optional `mark`.

Plant hrefs go through `lib/plant-path.ts` so the plant address stays spelled
once, and `resolveLineage` cannot disagree with `resolveNavItem` about which
plant a path names.

The garden is a **parameter**, never loaded here. That keeps CLAUDE.md's garden
rule where it belongs — with the page: `loadRawGarden` in the admin,
`loadCachedGarden` in the public zone. A self-loading component would take the
privacy decision away from the page and read the garden twice.

## The cluster — `components/lineage-chrome.tsx`

Server-safe, and added to `lib/server-safe-source.test.ts`'s pinned list **in
the same commit that creates it**: no `"use client"`, no `lucide-react`, no
`next/link`, no `node:` imports. Every one of those passes `tsc`, `npm test`
and `npm run build` while costing the public zone its navigation.

```tsx
<LineageChrome lineage={lineage} as={Link} />   // admin
<LineageChrome lineage={lineage} />             // public — default <a>
```

One `<Chrome magnet="top-center">`, one item per tier:

- **One parent** → a `ChromeLink` to it. `label` is the PARENT'S NAME, not the
  tier's word, so the accessible name says which parent you are about to reach.
  This is the "an icon trigger names its stored value" rule applied to
  navigation.
- **Two or more** → a `<details>` whose `<summary>` wears `chromeItemClass()`
  and carries `aria-label="Pods: 3"`; the panel is a list of `ChromeLink` rows
  wearing `CHROME_PLATE`, so it is visibly the same object as the cluster it
  hangs from.

A disclosure rather than a popover because the public zone is progressively
enhanced: Base UI's `Popover` is a client component, and reaching for it here
would make moving up a tier script-dependent. `<details>` is server-rendered,
complete with script off, and identical in both zones — so the shared file stays
one file rather than one file with two behaviours. The known cost, stated rather
than discovered: no outside-click dismissal, and the open panel is in flow under
the plate.

A tier of one is a plain link rather than a disclosure because the common case
is one bean, one pod, one plant, and a menu of one is a click that costs a
click.

### Glyphs

- **Plant** — the plant's logo, drawn the way `AvatarMark` draws it: a monogram
  painted underneath, a real `<img>` laid over it, both in the SERVER HTML. Not
  `components/ui/avatar.tsx` (deleted): its client-state image would flash the
  monogram on every load, in the chrome, which is the regression PR #97 removed.
- **Pod** and **bean** — two new hand-drawn icons in
  `components/public-icons.tsx`, mirroring the `Package` / `Bean` glyphs
  `SECTION_ICONS` uses in the admin. Lucide cannot cross into the public zone
  (one import is one client boundary), and `public-icons.tsx` is the documented
  way around it.

The entity itself is **not** an item. The cluster says where you are from; the
page's own `PlantHeader` already says what you are looking at.

## Where it mounts

Per page, not per layout — the cluster's content depends on the entity the page
resolved, and a layout would have to resolve it a second time.

| Page | Tiers |
| --- | --- |
| `app/admin/(chrome)/sprout/[slug]` | plant, pod, bean |
| `app/admin/(chrome)/bean/[slug]` | plant, pod |
| `app/admin/(chrome)/pod/[slug]` | plant |
| `app/admin/(chrome)/screens/[slug]` | plant |
| `app/(public)/(chrome)/bean/[id]` | plant, pod |
| `app/(public)/(chrome)/pod/[slug]` | plant |

The admin sprout page's existing single "back to bean" link is **removed**.
Leaving both would give one destination two shapes on one page.

There is no public sprout page, so the sprout row has no public half.

## Collision

`top-center` is unoccupied in both zones today (`top-left`, `left`, `top-right`
and `bottom-center` are taken). At 400px the three top clusters come to roughly
100px (mark + switcher) + 132px (three items) + 90px (account) plus gutters,
which fits but not by much. The plan's last task **verifies it in a browser at
400px**; if it does not fit, the lineage cluster is what changes — dropping to
icons without its plate — never one of the two clusters that were there first.

## Tests

- `lib/lineage.test.ts` — the climb; dangling refs dropped; a pod-less bean
  omitting the pod tier entirely; multi-parent tiers; outermost-first ordering.
- `lib/server-safe-source.test.ts` — `components/lineage-chrome.tsx` added to
  the pinned list. This is the file that reports a `lucide-react` or `next/link`
  import, which nothing else would.
- `lib/lineage-chrome-render.test.tsx` — one parent renders an anchor whose
  accessible name is the parent's NAME; two-plus renders a `<details>` with
  every parent as a real `href`; the plant item's `<img>` is present in the
  server HTML (the `entity-avatar-ssr.test.tsx` guarantee, extended to the
  chrome).

## Not in this slice

No new client component, no island, no server action, no schema change. No
lineage on the plant page (a plant is the outermost tier and has no parents),
and no descent — this cluster climbs only.

## Lab Note

Visitor-facing: the public bean and pod pages gain the trail. The PR needs one.
