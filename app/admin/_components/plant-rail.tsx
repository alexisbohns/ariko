"use client";

import { useState, type ReactNode } from "react";
import { GalleryHorizontal } from "lucide-react";
import { Chrome, ChromeItem, chromeItemClass } from "@/components/chrome";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The plant page's own rail — one floating panel, on the right edge.
 *
 * It carried two. The first was **Inside**: a plant's pods and beans, as a
 * list, floating, because the page was a header and a prose editor and had
 * nowhere in the document to put them. The hub has that place now — four
 * previews below the prose, three of them drawn by the very table their
 * section draws — so the list is in the page rather than one click behind an
 * icon, and it says more there (a pod's beans, a bean's sprouts, a visibility)
 * than a name and a ref ever did. A panel whose contents the page below it
 * already shows is a control that only ever repeats itself, so it went with
 * the reason for it.
 *
 * The rail is the mirror of the chrome's: same fixed pill, same borderless
 * icon button, on the right edge at the same height. The chrome moves you
 * between sections; this belongs to the page and not to `admin-chrome.tsx`.
 *
 * The panel itself is the registry's popover — it FLOATS over the page rather
 * than taking a column of its own. What keeps it from covering the page it
 * describes is the second half: this component wraps the whole page body and
 * slides it left while the panel is open. The nudge is a courtesy, not a
 * layout: it is enough to clear the panel on a wide screen and it is suppressed
 * below `lg`, where moving the column that far would only push it under the
 * chrome's own rail.
 *
 * Client only for the open state. The Exhibition panel DOES carry forms, and
 * this file still composes none of them: its contents are server-rendered by
 * app/admin/plant/[slug]/page.tsx and arrive as a prop, exactly as
 * plant-hero.tsx takes metaForm, roleForm and logoForm. This island owns the
 * open state and nothing else — it learns no field name and builds no payload.
 *
 * What that costs without script is ORDERING, and only ordering: membership
 * lives on the screen's own page in the library (screen-exhibit-form.tsx), so
 * adding and withdrawing both survive script-off, and every survivor renders —
 * in the order the author added it. `exhibitionWrites` maps a newly-added slug
 * to `undefined`, which never equals a stored index, so `add` is always
 * promoted with a concrete `order` (the append position): `exhibitionOrder`'s
 * missing-key fallback is not a state a script-off strip ever actually
 * reaches, so the strip is never merely tolerable, it is correctly ordered by
 * construction. Only RE-SEQUENCING — moving a screen once more than one is
 * exhibited — needs this panel. That is also why the hub's Screens preview did
 * not swallow this rail the way it swallowed Inside: a preview can show the
 * strip, and cannot reorder it.
 */

/**
 * The plate, held open while the panel is.
 *
 * `CHROME_PLATE` materializes on `hover` and `focus-within`, and neither stays
 * true here once the panel opens: the popover is PORTALED, so focus moves to a
 * node outside this <nav> and the plate would ghost away underneath the very
 * panel it opened — the trigger reading as though it had vanished.
 *
 * `aria-expanded` is the honest hook. The trigger already sets it, so holding
 * the plate open needs no state and no client code of its own. `md:` only,
 * matching the ghost itself; below that the plate never left.
 */
const PLATE_WHILE_OPEN =
  "md:has-[[aria-expanded=true]]:border-border md:has-[[aria-expanded=true]]:bg-card/80 " +
  "md:has-[[aria-expanded=true]]:shadow-lg md:has-[[aria-expanded=true]]:backdrop-blur";

export function PlantRail({
  exhibition,
  children,
}: {
  /** The Exhibition panel — its count for the trigger's label and its
   *  server-rendered contents for the popover, ONE prop rather than two so a
   *  count and a panel that disagree is unrepresentable. Absent for a plant
   *  with no screens at all — the rail then shows nothing, which is why the
   *  <Chrome> below is not rendered at all in that case: an empty pill floating
   *  at the edge is a control with no controls in it. */
  exhibition?: { count: number; panel: ReactNode };
  children: ReactNode;
}) {
  const [showing, setShowing] = useState(false);

  return (
    <>
      {/* The page, nudged. `transition-transform` and nothing else: a transform
          does not re-flow the document, so the prose editor keeps its measured
          width and its caret keeps its place while the panel opens. */}
      <div
        className={
          "transition-transform duration-200 ease-out " + (showing ? "lg:-translate-x-28" : "")
        }
      >
        {children}
      </div>

      {/* The mirror of the admin rail, and literally the same component:
          `magnet="right"` is the only thing that differs, and it is what turns
          the hover labels around to open leftward. */}
      {exhibition ? (
        <Chrome
          magnet="right"
          orientation="vertical"
          label="Plant panels"
          className={PLATE_WHILE_OPEN}
        >
          <Popover open={showing} onOpenChange={setShowing}>
            <ChromeItem
              label={`Exhibition${exhibition.count > 0 ? ` (${exhibition.count})` : ""}`}
            >
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="Exhibition"
                    className={chromeItemClass(showing)}
                  >
                    <GalleryHorizontal className="size-4" />
                  </button>
                }
              />
            </ChromeItem>

            {/* `side`/`align` are named rather than left to the primitive's
                default (`bottom`, which would drop the panel off a vertically
                centred rail), and `sideOffset` is measured rather than left at
                the registry's 4px: the anchor is the BUTTON, but what the panel
                has to clear is the pill around it — 1px border plus the rail's
                `p-1.5`. At 4 the panel sat on the pill's edge. */}
            <PopoverContent
              side="left"
              align="center"
              sideOffset={16}
              className="max-h-[70vh] w-80 overflow-y-auto"
            >
              <p className="mb-2 font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Exhibition
              </p>
              {exhibition.panel}
            </PopoverContent>
          </Popover>
        </Chrome>
      ) : null}
    </>
  );
}
