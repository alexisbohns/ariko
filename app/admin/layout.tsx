import type { ReactNode } from "react";
import { AdminChrome, AdminMain } from "./_components/admin-chrome";

/**
 * The admin/tooling zone. It shares the design system with the public zone but
 * not its chrome: the floating rail and the top-right actions are rendered
 * here, once, and withdraw themselves on the login page.
 *
 * The column's padding clears those two fixed clusters — the rail on the left,
 * the account actions top-right — while keeping the centred max-width column.
 * It lives in AdminMain rather than here because it is route-dependent (the
 * login page has no chrome to clear) and a server component cannot read the
 * pathname.
 *
 * THE `sheet` SLOT is the screen library's side panel (a parallel route filled
 * by `@sheet/(.)screens/…`, and `@sheet/default.tsx` — null — everywhere else).
 * The page makes ROOM for it when one is open, and the whole of that is the CSS
 * below: `:has(~ [data-screen-sheet])` asks whether a panel exists beside this
 * wrapper, which needs no open flag, no client state and no knowledge of the
 * route. It is the idiom `plant-inside.tsx` already uses to hold its plate open
 * under a portaled popover.
 *
 * IT MAKES ROOM RATHER THAN MOVING, and the distinction is the whole of a bug
 * this shipped with. The first version was `plant-inside.tsx`'s move — a 14rem
 * negative translate — with that file's reasoning copied across: a transform
 * does not re-flow, so the grid keeps its columns and its scroll position. Both
 * halves of that were wrong here.
 *
 * (Written as prose rather than as the class name on purpose: Tailwind v4
 * scans source files as TEXT, so spelling a utility inside a comment mints it
 * into the stylesheet. The docs/ specs do this too — a code block in a plan is
 * indistinguishable from markup to the scanner.)
 *
 * A transform does not make room, it MOVES. `PlantInside` nudges a *reading*
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
 * left, and nothing is ever off-screen. No transition on it either: animating
 * padding re-flows 170 images on every frame, and the panel's own
 * `slide-in-from-right` already carries the movement.
 *
 * Below `lg` the panel covers instead — reserving 28rem of a narrow screen
 * would leave the column nothing to live in.
 */
export default function AdminLayout({
  children,
  sheet,
}: {
  children: ReactNode;
  sheet: ReactNode;
}) {
  return (
    <>
      <AdminChrome />
      <div className="lg:[&:has(~[data-screen-sheet])]:pr-[28rem]">
        <AdminMain>{children}</AdminMain>
      </div>
      {sheet}
    </>
  );
}
