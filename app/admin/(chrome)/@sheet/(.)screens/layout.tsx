import type { ReactNode } from "react";
import { SideSheet } from "@/app/admin/_components/side-sheet";

/**
 * The panel itself, hoisted out of the pages it holds — which is the whole of
 * why walking the library with the arrows is a content swap rather than a
 * flicker.
 *
 * The shell used to live in `(.)screens/[slug]/page.tsx`. Next keys a route
 * segment by its params, so every move from one screen to the next made a NEW
 * `[slug]` segment: React unmounted the whole `<aside>` and mounted another
 * one, the entry animation replayed from scratch, and the panel visibly left
 * and came back on each press of `→`. Nothing was wrong with the navigation —
 * the panel was simply being rebuilt each time.
 *
 * A layout is the one thing above that boundary. It is mounted when the
 * interception begins and stays mounted while `children` changes underneath
 * it, so the frame, its scroll position and its entry animation belong to the
 * VISIT rather than to the screen — and `→` swaps only what is inside.
 *
 * It wraps `[slug]`, `new` and the not-found boundary alike, so every one of
 * them is the panel's content and none of them draws a panel of its own.
 */
export default function SheetLayout({ children }: { children: ReactNode }) {
  return <SideSheet>{children}</SideSheet>;
}
