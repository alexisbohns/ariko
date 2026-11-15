# Editing from the garden map — design

**Date:** 2026-11-15
**Status:** implemented — see "Spike results" at the end
**Builds on:** [`2026-11-15-garden-map-design.md`](2026-11-15-garden-map-design.md),
whose "Out of scope: editing from the map, a side panel" this reverses.

## Problem

The map shows what waits and what is missing, and every node is a link. Clearing
a ring means leaving the map for the entity's page, editing, and navigating back
to find your place, once per node. The map is where the garden is read as a
whole, and the decision it prompts then happens somewhere else.

## What it is

Clicking a **plant, pod, bean or sprout** node on `/admin/map` opens that
entity's real admin page in a side sheet over the map. The author edits it there
with every tool the page has (head facts, visibility/status/state, the prose
editor, rail panels), and the map stays mounted and clickable underneath.

**The whole page, not a second surface.** The sheet renders the page module the
standalone route does, imported and not reimplemented, so there is no form in it
that is not also on the page. This is the screen sheet's claim
(`lib/screen-sheet-source.test.ts`) applied to four more routes.

Seed-count and bucket nodes are unchanged: they link to the inbox, which is not a
page the map intercepts.

## Mechanism: a slot that exists only under the map

```
app/admin/(chrome)/map/
  layout.tsx                      { children, entity } → children + <MapSheet>{entity}</MapSheet>
  page.tsx                        unchanged
  @entity/
    default.tsx                   null   (hard load of any route)
    page.tsx                      null   (the slot AT /admin/map: what closing navigates to)
    (..)plant/[slug]/page.tsx             wraps plant/[slug]/page
    (..)plant/[slug]/narrative/page.tsx   wraps plant/[slug]/narrative/page
    (..)pod/[slug]/page.tsx               wraps pod/[slug]/page
    (..)bean/[id]/page.tsx                wraps bean/[id]/page
    (..)sprout/[slug]/page.tsx            wraps sprout/[slug]/page
```

`(..)` is relative to the `map` segment (slots and route groups are not
segments), so each file intercepts `/admin/<tier>/…`. The slot is a child of
`map`, so **it is only active while the router is on the map**. That is the point
of putting it here and not under `(chrome)` as the screen sheet is: an
interceptor at the chrome level would turn every link to a bean in the tables,
the palette and the lineage chrome into a sheet, a change nobody asked for.

Consequences, each a reason this shape was chosen:

- **No node changes.** `lib/garden-map.ts` already emits the real
  `/admin/<tier>/<slug>` href on every node, and the card is already a
  `next/link`. A soft click is intercepted; a modified click, a hard load or a
  reload gives the full page. Every link is still a real `href`.
- **No action changes.** About a hundred redirects in `app/admin/actions.ts` send
  an author back to `/admin/bean/x?…` after a save. Under the map the router
  tree is still the map's, so that redirect matches the same interceptor and the
  sheet reloads in place. Nothing in the write path learns that a sheet exists.
- **Swapping is a content change.** A link inside the sheet to another
  plant/pod/bean/sprout (the pod's "Inside" list, a sprout's bean) is intercepted
  the same way. A link to anything else (`/admin/sprouts`, a triage page, a
  screen) is an ordinary navigation that leaves the map.

## The sheet

`app/admin/_components/map-sheet.tsx`, rendered by `map/layout.tsx`, so it is
**mounted by the layout and survives every swap**: the frame, its scroll and its
entry animation belong to the visit (the screen sheet's `(.)screens/layout.tsx`
lesson, in its simplest form). Renders nothing when `entity` is null.

- **Not `SideSheet`.** That component carries `data-screen-sheet`, which the
  admin layout reads to push the page by 28rem. The map is `bleed`
  (`fixed inset-0`) and must not be pushed. The map sheet has its own attribute
  (`data-map-sheet`) and its own width, about 44rem (capped to the viewport), so
  the prose editor has a measure to write in.
- **The sheet is the containing block for its fixed descendants.** It carries a
  `transform`, so the page's viewport-fixed pieces (the entity rail's icon
  cluster and its 448px panel, the editor's floating commit, the lineage chrome)
  land inside the sheet and not over the map. This is what makes "the whole page"
  possible without touching the rail or the editor.
- **Z order.** Below the chrome's `z-40` plates, so the top-right cluster (the
  public site, log out) stays reachable. The sheet clears it with top padding and
  puts its ✕ on the left.
- **Closing** is a `next/link` to `/admin/map` plus the map's own query. The URL
  while a sheet is open is `/admin/bean/x`, so `?plant=` and `?view=` are gone
  from it; `MapSheet` keeps them in a ref, updated whenever the pathname is
  `/admin/map`, and the close href is built from it. Never `router.back()`: after
  a save the history holds redirect hops, and the screen sheet's rule (every
  close is a real `href`) applies.
- **Escape closes** only when focus is in no editor, menu or popover, because a
  dismiss that also discards a draft is the thing this slice must not add.

## Unsaved work

The editor has no `beforeunload` guard, and the admin accepts that on a
full-page navigation. On the map it is a materially easier mistake: the canvas
stays clickable beside an open editor, so one stray node click or ✕ would swap
the sheet and drop the draft. The slice therefore adds one small thing:

- `ProseEditor` marks its root `data-editor-dirty` while `dirty` (its existing
  state, debounced as it already is). It publishes nothing else.
- `MapSheet` and the map's node click read it: with a dirty editor inside the
  sheet, a close or a node click asks before it navigates, and carries on only
  on yes. The standalone pages are untouched.

## Known limits, stated rather than discovered

- **The rail reshapes.** The chrome reads the URL, and the sheet's URL is
  `/admin/plant/x`: opening a plant scopes the rail (Overview in, Beanstalk out)
  and the switcher while the map behind is unscoped. That is the URL rule
  working, and it will read as odd. If it does, the fix is in `admin-chrome.tsx`
  (treat a sheet as not changing scope), not here.
- **The map refreshes behind an open sheet.** The spike showed a save re-renders
  it live (a published bean's "Waiting" ring clears with the sheet still open),
  so nothing here needs to wait for Close.
- **Script off.** The map is a canvas island and draws nothing without script, so
  it never had a script-off reading to preserve. Every node href is still the
  real page.
- **The admin's column follows the router, not the URL.** The sheet's URL is
  `/admin/bean/x`, a reading column; `AdminMain` therefore passes the active
  layout segment to `resolveColumn`, and `map` outranks the path. Without it the
  tree under `<main>` changes shape when a sheet opens and the map, the sheet and
  any editor in it remount.

## Spike first

The design leans on four things that cannot be settled by reading. They are the
first task of the plan, run against a scratch database in a worktree dev server,
and each has a stated fallback:

1. **Interception from a map click, and again after a save redirect.** If the
   redirect leaves the map, the fallback is a `?from=map`-style marker the
   wrapper pages read; it must not be an action change.
2. **A `transform` on the sheet contains the rail, its panel and the floating
   commit.** If it does not, the fallback is the iframe approach (B in the
   conversation): the real page in a frame, chrome withheld on
   `Sec-Fetch-Dest: iframe`.
3. **The `@` / `/` suggestion menu** (`components/editor/suggestion-menu.tsx`)
   positions itself `fixed` from caret viewport coordinates, and a transformed
   ancestor offsets it, which is the trap `entity-rail.tsx` documents. Fix by
   portalling it to `document.body`; if that is not clean, take fallback 2.
4. **Whether the map re-renders behind an open sheet** (see limits).

## Testing

- `lib/map-sheet-source.test.ts`, on comment-stripped source as the screen
  sheet's is: every file under `map/@entity/` imports the standalone page module
  and contains no form, action or field of its own; every interceptor sits under
  `map/@entity/`, none under `(chrome)/@sheet/`; `map/layout.tsx` renders
  `entity`; `MapSheet` carries `data-map-sheet` and not `data-screen-sheet`; no
  `router.back` in it; `@entity/default.tsx` and `@entity/page.tsx` render null.
- `lib/garden-map-source.test.ts` still holds: the island imports types only and
  no map file imports an action or `lib/store.ts`. `MapSheet` is not a map
  component and imports neither.
- A unit test for the pure helpers (`lib/map-sheet.test.ts`), and a source test
  that the editor's surface binds `data-editor-dirty` to its `dirty` state. A
  render test cannot do the second: `dirty` is set by an editor update, which
  `renderToStaticMarkup` never runs, so the behaviour is covered by the browser
  pass below.
- A browser pass is part of done, not optional: click a plant, a pod, a bean and a
  sprout; edit and save a field; write in the editor and use `@` and `/`; open a
  rail panel; swap by clicking another node and by an in-sheet link; close; reload
  on `/admin/bean/x`. Type-checks, `npm test` and `npm run build` pass with every
  one of these broken.

## Docs

- `2026-11-15-garden-map-design.md`: the Interaction section's "Read-only … no
  side panel" and Out of scope line point here.
- `CLAUDE.md`: the garden-map bullet says the map is read-only with no write path;
  it gains the sheet and the reason the slot is under `map/` and not `(chrome)/`.

## Out of scope

Highlighting the open node, panning the canvas to it, a sheet for seed-count or
bucket nodes, and keyboard navigation between nodes.

## Spike results

Run 2026-11-15 against a scratch database, `next dev`, in the app's built-in
browser at 1400×900.

| # | Assumption | Result |
|---|---|---|
| 1 | Interception from a map click, and again after a save redirect | **Pass.** A click opens the sheet with the map still mounted. A save's redirect (a bean's visibility) re-matches the interceptor and leaves the *same* sheet and canvas elements in place: no remount. Swapping pod → sprout → plant changes only the content. Close returns to `/admin/map`, and `?plant=` / `?view=` come back with it. A table click and a hard load of `/admin/bean/x` give the plain page. **Dev only:** `next dev` builds its interception table at startup, so the server must be restarted after the first interceptor is added or nothing intercepts. |
| 2 | The transform contains the rail, its panel and the floating commit | **Pass.** The lineage chrome, the editor's commit and the rail's icon cluster all measure inside the sheet. The commit and rail stay put while the content scrolls 163px (the two-box structure works). A rail panel opens inside the sheet (448px of its 704px) and floats over the prose; the page offset is 0. Base UI's popover anchors correctly. |
| 3 | The `@` / `/` menu lands on the caret | **Fail, then fixed.** Measured 674px off (the sheet's left edge), vertical 6px as designed. Portalling the menu to `document.body` (f346864) puts it back on the caret's line, 6px below it, anchored at the `@`. Picking with Enter inserts the mention; Escape in the editor leaves the sheet open. |
| 4 | The map re-renders behind an open sheet | **Yes, live.** Publishing the bean cleared its "Waiting" ring on the map while the sheet stayed open. The spec's floor (current after close) was not needed. |

Also found:

- **A defect the spec did not predict, now fixed.** `AdminMain` chose its
  column from the URL, and `/admin/bean/x` is a reading column, so opening a
  sheet switched `<main>` to a differently-shaped tree. That remounted the map,
  the sheet and any editor in it, and the reading column squeezed the canvas to
  height 0. `AdminMain` now passes `useSelectedLayoutSegment()` to
  `resolveColumn`, and the active segment (still `map`) outranks the URL
  (f542194). A remount here would have dropped an unsaved draft.
- **The lineage chrome** draws inside the sheet, clear of the title, so
  `inSheet` is not needed.
- **The rail reshapes** when a plant opens (Overview in, Beanstalk out, the
  switcher names the plant), the accepted limit above.
- **A hidden browser pane freezes CSS animations** (`currentTime` stays 0), so
  the sheet looked parked off-screen mid slide-in during automated checks. A
  test-harness artifact, not a bug.
