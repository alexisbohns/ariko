import { Suspense, type ReactNode } from "react";
import { resolveText } from "@/lib/data";
import { byResolvedName } from "@/lib/name-order";
import { visibilityOf } from "@/lib/plant-visibility";
import { loadPlantMarks } from "@/lib/store";
import { AdminChrome, AdminMain } from "../_components/admin-chrome";
import type { PlantMark } from "../_components/plant-switcher";

/**
 * The admin/tooling zone, MINUS the login page. It shares the design system
 * with the public zone but not its chrome: the three floating clusters — the
 * mark and the plant switcher top-left, the section rail on the left edge, the
 * account actions top-right — are rendered here, once.
 *
 * THE GROUP IS THE PRIVACY BOUNDARY, and it is the reason this file sits under
 * `(chrome)` rather than at `app/admin/`. `/admin/login` is the one route
 * `middleware.ts` lets through unauthenticated; it is now the one routeable
 * thing left OUTSIDE this group, so an anonymous request never enters a layout
 * that reads the garden. `lib/admin-login-layout-source.test.ts` pins it, and
 * carries the full account of what leaked before.
 *
 * The short version, because it is the thing to understand before adding a prop
 * below: `AdminChrome` is a client island, so everything handed to it is
 * SERIALIZED INTO THE FLIGHT PAYLOAD and inlined in the HTML document before
 * the component runs. A `return null` inside it suppresses markup, never data.
 * The chrome used to withdraw on `/admin/login` that way while this layout read
 * the garden anyway — and an anonymous `curl` of the login page came back with
 * all twelve plants, names, Cloudinary logo URLs and the visibility of the
 * private one. Structure, not a conditional, is what fixes that class of bug:
 * outside the group there is no read to leak.
 *
 * The column's padding clears the clusters while keeping the centred max-width
 * column. It lives in AdminMain rather than here because it is route-dependent
 * (a section index reads wide, a document reads narrow) and a server component
 * cannot read the pathname. The top-left cluster needed no new clearance:
 * `pt-24` clears anything pinned to the top edge, which is `RAIL_CLEARANCE`'s
 * whole argument for being vertical rather than measured against a cluster's
 * width.
 *
 * THE `sheet` SLOT is the screen library's side panel (a parallel route filled
 * by `@sheet/(.)screens/…`, and `@sheet/default.tsx` — null — everywhere else).
 * The page makes ROOM for it when one is open, and the whole of that is the CSS
 * below: `:has(~ [data-screen-sheet])` asks whether a panel exists beside this
 * wrapper, which needs no open flag, no client state and no knowledge of the
 * route. It is the idiom `plant-rail.tsx` already uses to hold its plate open
 * under a portaled popover.
 *
 * IT MAKES ROOM RATHER THAN MOVING, and the distinction is the whole of a bug
 * this shipped with. The first version was `plant-rail.tsx`'s move — a 14rem
 * negative translate — with that file's reasoning copied across: a transform
 * does not re-flow, so the grid keeps its columns and its scroll position. Both
 * halves of that were wrong here.
 *
 * (Written as prose rather than as the class name on purpose: Tailwind v4
 * scans source files as TEXT, so spelling a utility inside a comment mints it
 * into the stylesheet. The docs/ specs do this too — a code block in a plan is
 * indistinguishable from markup to the scanner.)
 *
 * A transform does not make room, it MOVES. `PlantRail` nudges a *reading*
 * column 7rem and gets away with it because a 768px measure on a wide screen
 * has gutters to spare. The library is the WIDE column, and 14rem pushed its
 * left edge past the viewport: the page title rendered as "creens" and the
 * first column of tiles was cut off with no way to scroll to it — while the
 * 28rem panel still covered the last column, because a 14rem move never was
 * going to clear a 28rem panel.
 *
 * And "keeps its columns" is a benefit for a prose editor, whose measured width
 * and caret position must not move under the author. This is a GRID. Re-flowing
 * into the remaining width is exactly what it should do — it drops a column and
 * every tile stays on screen.
 *
 * So: padding, not translate. `mx-auto` inside re-centres the column in what is
 * left, and nothing is ever off-screen.
 *
 * THE DURATION AND THE CURVE ARE THE PANEL'S, deliberately. Left untransitioned
 * the room appeared instantly and the panel then slid into it over 200ms — so
 * the page was seen re-laying itself out BEFORE anything arrived to justify it,
 * which reads as a glitch rather than as a push. Matching
 * `side-sheet.tsx`'s `duration-200` makes the two one movement: the column
 * narrows at exactly the rate the panel takes up the space.
 *
 * It is a re-flow per frame, which is the cost, and on this page that is 170
 * thumbnails. It is affordable because the grid is `object-contain` images in
 * fixed `aspect-[3/4]` boxes — the box geometry does not depend on the image,
 * so the browser re-flows boxes, not pictures, and nothing is decoded again.
 * If it ever does judder, the fix is to transition the panel's width and the
 * padding together off one variable, not to drop back to a transform.
 *
 * Below `lg` the panel covers instead — reserving 28rem of a narrow screen
 * would leave the column nothing to live in.
 *
 * THE GARDEN READ BELOW is the chrome's, and it is here because the chrome is
 * a client island: the server composes the plant marks and the island receives
 * a finished array, exactly as `app/admin/(chrome)/plant/[slug]/page.tsx` composes its
 * Exhibition panel and hands it down.
 */

/**
 * The plants the switcher draws, in `byResolvedName`'s order — the welcome
 * page's order, out of the same comparator, so the list in the chrome and the
 * table on the root agree about which plant comes first by construction rather
 * than because two sort calls happen to be spelled alike.
 *
 * The LIVE reader, never `loadCachedGarden`: CLAUDE.md's rule is that the admin
 * and every server action read live, and the chrome is the surface most likely
 * to be looked at immediately after a rename.
 *
 * `loadPlantMarks`, though, and not `loadRawGarden` — the narrowing matters
 * because THIS LAYOUT SITS ABOVE EVERY ADMIN PAGE and its `await` gates the
 * first byte of all of them. `loadRawGarden` here was six unfiltered collection
 * scans (421 KB, ~130 ms warm, most of it sprout markdown and pod narrative)
 * spent composing 1.6 KB of marks. `lib/store.ts` carries the measurements.
 *
 * It reads no less OFTEN than before — see the note on soft navigation in
 * `app/admin/_components/admin-chrome.tsx` for what actually stopped the
 * per-navigation repeat, which is that this layout is no longer torn down and
 * rebuilt on every click.
 *
 * THE LOGIN PAGE NO LONGER PAYS FOR THIS READ, and never sees its result: it
 * sits outside `(chrome)`, so this layout does not wrap it. See the docblock at
 * the top of this file for what that used to cost.
 *
 * The try/catch is not decoration: an unreachable garden must cost the
 * switcher, never the page. Every admin page renders its own failure state,
 * and a throw here would replace all of them with the error boundary.
 */
async function plantMarks(): Promise<PlantMark[]> {
  try {
    return (await loadPlantMarks())
      .map((plant) => ({
        slug: plant.slug,
        name: resolveText(plant.name),
        ...(plant.logo?.url ? { logoUrl: plant.logo.url } : {}),
        visibility: visibilityOf(plant),
      }))
      .sort(byResolvedName);
  } catch {
    return [];
  }
}

export default async function AdminLayout({
  children,
  sheet,
}: {
  children: ReactNode;
  sheet: ReactNode;
}) {
  const plants = await plantMarks();

  return (
    <>
      {/* `useSearchParams` in AdminChrome requires a boundary. `fallback={null}`
          because the chrome has nothing meaningful to show half-resolved: a
          skeleton rail would be a row of grey boxes nothing can be done with. */}
      <Suspense fallback={null}>
        <AdminChrome plants={plants} />
      </Suspense>
      <div className="transition-[padding] duration-200 ease-out lg:[&:has(~[data-screen-sheet])]:pr-[28rem]">
        <AdminMain>{children}</AdminMain>
      </div>
      {sheet}
    </>
  );
}
