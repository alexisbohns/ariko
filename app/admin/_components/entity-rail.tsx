"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { X } from "lucide-react";
import { Chrome, ChromeItem, chromeItemClass } from "@/components/chrome";
import { Button } from "@/components/ui/button";

/**
 * An entity page's own rail — a cluster on the right edge, and one panel the
 * page makes room for.
 *
 * The shell and NOTHING else: no form, no action, no field name. Every panel's
 * contents are server-rendered by the page and arrive as a `ReactNode`, which
 * is `plant-rail.tsx`'s arrangement for `ExhibitionPanel` and
 * `plant-hero.tsx`'s for `metaForm`. `lib/entity-rail-source.test.ts` enforces
 * it, and it matters more here than on the plant's rail, because one of these
 * panels is a DELETE.
 *
 * Written shared on its first use rather than sprout-first, because it is
 * provably generic — it knows only ids, labels, icons and nodes — and three
 * more entities are queued behind the sprout.
 *
 * WHY EVERY PANEL STAYS MOUNTED. Base UI's popovers unmount on close, and
 * `plant-hero.tsx` argues that is correct: an abandoned pick is not a pending
 * write, and unmounting discards it with nothing to reset by hand. This rail
 * takes the opposite side, for one panel's sake. `MediaPicker` uploads to
 * Cloudinary IMMEDIATELY and persists the list only on Save, so unmounting on
 * close would strand real assets in the bucket — the thing
 * `npm run check:orphans` exists to sweep — and would do it on a mis-click,
 * which is the failure mode the two-act rule is itself built to avoid. So the
 * panels are all mounted and the inactive ones are pushed off-screen and made
 * `inert`. React preserves state across both, so closing and reopening returns
 * the author to the list they were building.
 *
 * The cost is that a panel mounts on page load rather than on first open, which
 * is what the media form already did as a card in the document. Nothing
 * regresses, and treating all panels the same is simpler than a rule with one
 * exception in it.
 */

/**
 * The plate, held open while a panel is.
 *
 * `CHROME_PLATE` materializes on hover and focus-within, and neither stays true
 * once a panel opens: focus moves into the panel, which is a sibling of this
 * `<nav>` rather than a descendant, so the plate would ghost away underneath
 * the very panel it opened — the trigger reading as though it had vanished.
 * `aria-expanded` is the honest hook, and it needs no state of its own.
 *
 * A copy of `plant-rail.tsx`'s constant rather than an import of it: that one
 * is private to a file this slice does not otherwise touch, and exporting it
 * would make `plant-rail.tsx` a module this one depends on for one string. It
 * is lifted here when the plant's rail is converted.
 */
const PLATE_WHILE_OPEN =
  "md:has-[[aria-expanded=true]]:border-border md:has-[[aria-expanded=true]]:bg-card/80 " +
  "md:has-[[aria-expanded=true]]:shadow-lg md:has-[[aria-expanded=true]]:backdrop-blur";

/**
 * How far the page moves to make room, and from what width.
 *
 * A TRANSLATE, not padding, and the two halves of that are recorded here the
 * way `RAIL_CLEARANCE` records its own arithmetic.
 *
 * `app/admin/(chrome)/layout.tsx` argues for padding, because a transform does
 * not make room, it MOVES — and its 14rem move pushed a WIDE grid's left edge
 * past the viewport. Both halves invert here. This is the reading column, which
 * has gutters to spare (`plant-rail.tsx`'s case exactly), and the same docblock
 * states the other half outright: "keeps its columns" is a benefit for a prose
 * editor, whose measured width and caret position must not move under the
 * author. Padding re-flows; a transform does not.
 *
 * Padding is also unavailable. This component renders INSIDE `READING_COLUMN`
 * (`AdminMain` → `div.mx-auto.max-w-3xl.px-6` → the page), so a right padding
 * added here lands inside a 768px box and squeezes the editor to roughly 320px.
 * Only the layout can pad, and only for its own `@sheet` slot.
 *
 * The number, with `main`'s `px-20` (160px) and a 448px panel: a 768px column
 * centred has its left edge at (vw − 768)/2 and its right edge at (vw + 768)/2.
 * Moved 224px left, clearing the panel needs (vw + 768)/2 − 224 ≤ vw − 448, and
 * staying on screen needs (vw − 768)/2 − 224 ≥ 0. Both give vw ≥ 1216. Below
 * that there is no translate that does both, so there is none — the panel
 * floats over the prose instead, dismissible, as the screen library's does
 * below `lg`.
 */
const PAGE_ASIDE = "min-[76rem]:-translate-x-56";

export interface RailItem {
  /** Matches `openOnError`, and is the panel's key. Never a field name. */
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Server-rendered by the page. This file renders it and learns nothing from it. */
  panel: ReactNode;
  /** Drawn above the panel's contents, in the chrome's eyebrow face. */
  heading?: string;
}

export function EntityRail({
  label,
  items,
  openOnError,
  children,
}: {
  /** The cluster's accessible name, e.g. "Sprout panels". */
  label: string;
  items: RailItem[];
  /**
   * The panel a rejected save came from, from the page's `?form=`. The panel
   * renders the message itself — this file never sees one. An id that matches
   * no item opens nothing, which is what lets the page fall through to its own
   * banner for an unknown value.
   */
  openOnError?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (openOnError && items.some((i) => i.id === openOnError)) setOpen(openOnError);
    // items is rebuilt every render by the page; depending on it would reopen
    // the panel on every re-render, including the one that closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnError]);

  if (items.length === 0) return <>{children}</>;

  return (
    <>
      {/* The page, moved. `transition-transform` and nothing else: a transform
          does not re-flow the document, so the editor keeps its measure and the
          caret keeps its place while the panel opens. */}
      <div
        className={`transition-transform duration-200 ease-out ${open ? PAGE_ASIDE : ""}`}
      >
        {children}
      </div>

      <Chrome
        magnet="right"
        orientation="vertical"
        label={label}
        className={PLATE_WHILE_OPEN}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const current = open === item.id;
          return (
            <ChromeItem key={item.id} label={item.label}>
              <button
                type="button"
                aria-label={item.label}
                aria-expanded={current}
                onClick={() => setOpen(current ? null : item.id)}
                className={chromeItemClass(current)}
              >
                <Icon className="size-4" />
              </button>
            </ChromeItem>
          );
        })}
      </Chrome>

      {items.map((item) => {
        const current = open === item.id;
        return (
          <aside
            key={item.id}
            aria-label={item.label}
            // `inert` rather than unmounting — see this file's docblock. It also
            // takes the panel out of the accessibility tree and out of the tab
            // order, so a closed panel's fields are unreachable rather than
            // merely off-screen.
            inert={!current}
            className={
              "fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col gap-4 overflow-y-auto " +
              "border-l bg-card/95 p-6 shadow-xl backdrop-blur-xl " +
              "transition-transform duration-200 ease-out lg:w-[28rem] " +
              (current ? "translate-x-0" : "translate-x-full")
            }
          >
            <div className="flex items-start justify-between gap-4">
              {item.heading ? (
                <p className="font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  {item.heading}
                </p>
              ) : (
                <span />
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Close ${item.label}`}
                onClick={() => setOpen(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            {item.panel}
          </aside>
        );
      })}
    </>
  );
}
