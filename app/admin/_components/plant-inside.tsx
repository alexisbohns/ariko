"use client";

import { useState, type ReactNode } from "react";
import { Boxes } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

export interface InsideItem {
  href: string;
  name: string;
  /** `pod:slug` / `bean:slug` — the second line, as the admin tables spell it. */
  ref: string;
}

export function PlantInside({ items, children }: { items: InsideItem[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
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

      <nav
        aria-label="Plant panels"
        className="fixed right-4 top-1/2 z-40 -translate-y-1/2 rounded-2xl border bg-card/80 p-1.5 shadow-lg backdrop-blur"
      >
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Inside"
                      className={
                        "flex size-9 items-center justify-center rounded-xl transition-colors " +
                        (open
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                      }
                    >
                      <Boxes className="size-4" />
                    </button>
                  }
                />
              }
            />
            <TooltipContent side="left">
              Inside{items.length > 0 ? ` (${items.length})` : ""}
            </TooltipContent>
          </Tooltip>

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
      </nav>
    </TooltipProvider>
  );
}
