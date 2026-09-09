import type { ReactNode } from "react";

/**
 * The admin's right-hand side sheet: a fixed panel that the page slides out
 * from under, rather than an overlay that covers it.
 *
 * `PlantInside`'s move, promoted from a popover to a real panel, and the reason
 * for the shape is the whole design of the screen library: the contact sheet
 * stays VISIBLE and stays CLICKABLE while a screen is open, so the author edits
 * one, sees the next one they meant, clicks it, and the panel swaps. An overlay
 * would make that two gestures and a lost place.
 *
 * It is the SHELL and nothing else — no form, no action, no fields — which is
 * the line `overlay-sheet.tsx` already draws. Every consumer is a route, so
 * this file can never become the place a save goes wrong.
 *
 * `data-screen-sheet` is the hook the layout's push reads. It is on the panel
 * rather than on a wrapper because the layout's CSS asks "is there a sheet
 * beside me", and the answer has to be an element that exists only when there
 * is one — which is exactly what a parallel route's `default.tsx` returning null
 * gives.
 *
 * UNVERIFIED IN A BROWSER, and worth a reader's eye before it is trusted: this
 * panel and `admin-chrome.tsx`'s top-right cluster both sit at `z-40`, so a
 * full-height panel on the right MAY cover the public-site and log-out buttons.
 * Equal z-index means the later element in the document wins, and the sheet
 * slot renders after the chrome. If it does cover them, the fix is the panel's
 * z-index or the cluster's, not a new stacking context here.
 */
export function SideSheet({ children }: { children: ReactNode }) {
  return (
    <aside
      data-screen-sheet
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l bg-card/95 p-6 shadow-xl backdrop-blur-xl duration-200 animate-in slide-in-from-right lg:w-[28rem]"
    >
      {children}
    </aside>
  );
}
