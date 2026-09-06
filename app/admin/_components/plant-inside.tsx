"use client";

import { useState, type ReactNode } from "react";
import { Boxes } from "lucide-react";
import { Chrome, ChromeItem, chromeItemClass } from "@/components/chrome";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * What is inside the plant — its pods and beans — as a floating panel on a
 * right-hand rail.
 *
 * The rail is the mirror of the chrome's: same fixed pill, same borderless
 * icon button, on the right edge at the same height. The chrome moves you
 * between sections; this moves you inside one, so it belongs to the page and
 * not to `admin-chrome.tsx`.
 *
 * The panel itself is the registry's popover — it FLOATS over the page rather
 * than taking a column of its own. What keeps it from covering the page it
 * describes is the second half: this component wraps the whole page body and
 * slides it left while the panel is open. The nudge is a courtesy, not a
 * layout: it is enough to clear the panel on a wide screen and it is suppressed
 * below `lg`, where moving the column that far would only push it under the
 * chrome's own rail.
 *
 * Client only for the open state. Nothing here writes and nothing here is a
 * form — every row is the same <a href> the page rendered before, and
 * script-off the panel simply never opens. That costs discovery and never a
 * destination, exactly as the vault's filter popovers do: every page listed
 * here is also reachable from /admin/garden, from ⌘K, and from the prose.
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

export interface InsideItem {
  href: string;
  name: string;
  /** `pod:slug` / `bean:slug` — the second line, as the admin tables spell it. */
  ref: string;
}

export function PlantInside({ items, children }: { items: InsideItem[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* The page, nudged. `transition-transform` and nothing else: a transform
          does not re-flow the document, so the prose editor keeps its measured
          width and its caret keeps its place while the panel opens. */}
      <div
        className={
          "transition-transform duration-200 ease-out " + (open ? "lg:-translate-x-28" : "")
        }
      >
        {children}
      </div>

      {/* The mirror of the admin rail, and now literally the same component:
          `magnet="right"` is the only thing that differs, and it is what turns
          the hover labels around to open leftward. That side used to be a
          hand-written `side="left"` on a Tooltip. */}
      <Chrome magnet="right" orientation="vertical" label="Plant panels" className={PLATE_WHILE_OPEN}>
        <Popover open={open} onOpenChange={setOpen}>
          <ChromeItem label={`Inside${items.length > 0 ? ` (${items.length})` : ""}`}>
            <PopoverTrigger
              render={
                <button type="button" aria-label="Inside" className={chromeItemClass(open)}>
                  <Boxes className="size-4" />
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
            className="max-h-[70vh] w-64 overflow-y-auto"
          >
            <p className="font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Inside
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {items.map((item) => (
                <li key={item.ref}>
                  <a
                    href={item.href}
                    className="-mx-1.5 block rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/50"
                  >
                    <span className="block truncate">{item.name}</span>
                    <span className="block truncate font-heading text-xs text-muted-foreground">
                      {item.ref}
                    </span>
                  </a>
                </li>
              ))}
              {items.length === 0 ? <li className="text-muted-foreground">nothing yet</li> : null}
            </ul>
          </PopoverContent>
        </Popover>
      </Chrome>
    </>
  );
}
