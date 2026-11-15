"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { MAP_PATH, confirmDiscard, isInPlaceNavigation, mapCloseHref, sheetOpenFor } from "@/lib/map-sheet";
import { cn } from "@/lib/utils";

/**
 * Where Escape must NOT close the sheet: a field, the editor, or any menu or
 * popover the page opened. A dismiss that also discards a draft is the thing
 * this component exists not to do. Base UI popups portal out of the sheet but
 * React events bubble through portals, so the role check is load-bearing.
 */
const KEEP_ESCAPE =
  'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], [role="dialog"]';

/**
 * The frame around the entity page the `@entity` slot renders — spec
 * 2026-11-15 §"The sheet". The frame only: no form, no action, no field.
 *
 * MOUNTED BY `map/layout.tsx`, so it survives every swap from one entity to
 * the next; the slot's content changes inside it. It is open exactly when the
 * router is somewhere other than the map (`sheetOpenFor`), because the map's
 * layout is unmounted by any navigation the slot does not intercept.
 *
 * THE `transform` IS LOAD-BEARING. A transformed element is the containing
 * block for its `position: fixed` descendants, which is what pulls the entity
 * rail's icon cluster, its 448px panel and the editor's floating commit INTO
 * the sheet instead of leaving them over the map. `lib/map-sheet-source.test.ts`
 * pins it. The consequence is the one `entity-rail.tsx` documents for the page
 * offset: viewport coordinates stop meaning viewport. The `@`/`/` menu is the
 * one place that computes them.
 *
 * TWO BOXES, because a scrolling container is also a containing block: with
 * the scroller itself transformed, the rail and the commit would scroll away
 * with the prose. The outer box is fixed, transformed and does not scroll; the
 * inner one scrolls; fixed descendants measure against the outer one, and the
 * inner box's overflow does not clip them.
 *
 * Z 30, under the chrome's 40, so the public-site and log-out buttons stay
 * reachable; the ✕ is on the left for the same reason, and the top padding
 * clears the cluster as `AdminMain`'s does.
 *
 * Closing is a real `href` and never `router.back()`: after a save the history
 * holds redirect hops. The map's own query is kept here, in state set during
 * render from the URL while it is the map's, because the sheet's URL has none.
 */
export function MapSheet({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const sheet = useRef<HTMLElement>(null);

  const [mapSearch, setMapSearch] = useState("");
  if (pathname === MAP_PATH && search.toString() !== mapSearch) setMapSearch(search.toString());

  if (!sheetOpenFor(pathname)) return null;

  const closeHref = mapCloseHref(mapSearch);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if ((event.target as HTMLElement).closest(KEEP_ESCAPE)) return;
    if (confirmDiscard(sheet.current)) router.push(closeHref);
  }

  // Capture phase, on the whole frame: every in-place navigation out of the
  // sheet's current content — the ✕, an entity link in a table, the EN/FR
  // switch, a link in the prose — passes through here before `next/link` sees
  // it, so one guard covers them all and no link needs to know about drafts.
  function onClickCapture(event: MouseEvent<HTMLElement>) {
    const anchor = (event.target as Element).closest("a[href]");
    if (!isInPlaceNavigation(event, anchor)) return;
    if (!confirmDiscard(sheet.current)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <aside
      ref={sheet}
      data-map-sheet
      aria-label="Entity editor"
      onKeyDown={onKeyDown}
      onClickCapture={onClickCapture}
      className={cn(
        "fixed inset-y-0 right-0 z-30 w-full max-w-[44rem] transform-gpu overflow-hidden border-l bg-card shadow-xl",
        "duration-200 animate-in slide-in-from-right",
        // The rail's page offset is viewport-gated (it needs 1216px of
        // viewport) and means nothing inside a 44rem box; the rail's panel
        // then floats over the prose, dismissible, as it does below that width.
        "[&_[data-entity-page]]:right-0!",
      )}
    >
      <Link
        href={closeHref}
        aria-label="Close"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "absolute left-4 top-4 z-10")}
      >
        <X />
      </Link>
      <div className="h-full overflow-y-auto px-6 pb-16 pt-24">{children}</div>
    </aside>
  );
}
