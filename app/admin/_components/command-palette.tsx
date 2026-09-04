"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Archive,
  Bean,
  Flower2,
  Inbox,
  Leaf,
  Package,
  Search,
  Sprout,
  Waypoints,
} from "lucide-react";
import type { ComponentType } from "react";
// lib/palette-items.ts, never lib/palette.ts: the latter imports lib/data.ts,
// which opens with `node:fs`. Reaching for it from here does not merely bloat
// the bundle — it fails the build.
import {
  groupPaletteItems,
  sectionItems,
  type PaletteItem,
  type PaletteKind,
} from "@/lib/palette-items";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteLabel,
  AutocompleteList,
  AutocompleteStatus,
} from "@/components/ui/autocomplete";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The ⌘K command palette — the FOURTH deliberate client-JS exception in this
 * codebase, and the mildest of the four. Recorded as such in CLAUDE.md.
 *
 * Without script it renders nothing, ⌘K does nothing, and the search button is
 * not there — and its absence costs nothing, because it adds no destination of
 * its own. Every row is a faster route to a page that still has its slow route:
 * the four sections from the rail, and every plant, pod, bean, sprout and seed
 * from the list page that already links to it. It also never writes: no form,
 * no server action, no submit. That is what makes this a contained loss like
 * the media picker's rather than a real one like seed capture's.
 *
 * A navigator, not a command runner. Nothing here publishes, deletes, promotes
 * or syncs — which is what keeps it small enough to trust.
 */

const ICONS: Record<PaletteKind, ComponentType<{ className?: string }>> = {
  section: Waypoints,
  plant: Flower2,
  pod: Package,
  bean: Bean,
  sprout: Sprout,
  seed: Leaf,
};

// The four sections carry the rail's own icons, so the same destination looks
// the same in both places.
const SECTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/admin": Inbox,
  "/admin/vault": Archive,
  "/admin/garden": Sprout,
  "/admin/beanstalk": Waypoints,
};

function iconFor(item: PaletteItem): ComponentType<{ className?: string }> {
  if (item.kind === "section") return SECTION_ICONS[item.href] ?? ICONS.section;
  return ICONS[item.kind];
}

const KIND_LABEL: Record<PaletteKind, string> = {
  section: "",
  plant: "plant",
  pod: "pod",
  bean: "bean",
  sprout: "sprout",
  seed: "seed",
};

type LoadState = "idle" | "loading" | "error";

/**
 * The island's edge, and the reason it is a separate component rather than a
 * flag inside the one below: the server render IS the script-off render, so
 * `mounted` stays false there and this returns null — no dead search button
 * that looks pressable and does nothing, and no `useRouter()` call on a path
 * that has no router. lib/palette-mount.test.ts pins exactly this.
 *
 * Same shape as MediaPicker's gate, for the same reason.
 */
export function CommandPalette() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <Palette />;
}

function Palette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // The four sections are the starting index, built locally from NAV_ITEMS —
  // never fetched. That one line is what makes the palette impossible to open
  // onto nothing, whatever the network does.
  const [items, setItems] = useState<PaletteItem[]>(() => sectionItems());
  const [load, setLoad] = useState<LoadState>("idle");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Only the newest request may write to state: two quick opens must not let a
  // slow first response overwrite a fresh second one.
  const requestId = useRef(0);
  // Whether a full index has ever landed. Governs the Status line only: before
  // the first load "Loading…" is worth saying, after it a background refresh
  // is not.
  const loaded = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    const id = ++requestId.current;
    setLoad("loading");
    try {
      const res = await fetch("/admin/palette", {
        headers: { accept: "application/json" },
      });
      // The session expired and middleware bounced us to the login page. Go
      // there rather than reporting a load failure about a palette that is not
      // the problem.
      if (res.redirected && new URL(res.url).pathname === "/admin/login") {
        window.location.href = res.url;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { items?: PaletteItem[] };
      if (!Array.isArray(body.items)) throw new Error("malformed");
      if (id !== requestId.current) return;
      setItems(body.items);
      loaded.current = true;
      setLoad("idle");
    } catch {
      if (id !== requestId.current) return;
      // A failed REFRESH keeps the index it already had — a stale list beats an
      // empty one, and nothing the author can act on has changed. Only a failed
      // FIRST load is worth a line, because the palette is sections-only.
      setLoad(loaded.current ? "idle" : "error");
    }
  }, []);

  // Refetched on every open, not once: an author who has just created a sprout
  // finds it on the next press, with no reload. The cache renders immediately
  // meanwhile, so the refresh is never something to wait through.
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  // "Mod+K" — ⌘K on macOS, Ctrl+K elsewhere. Two library defaults are relied on
  // here and must not be overridden:
  //  - ignoreInputs defaults to FALSE for Ctrl/Meta combinations (it is true
  //    only for bare single keys and Shift/Alt combos), so this opens from
  //    inside the TipTap editor and from inside the seed overlay's fields —
  //    which is what a palette has to do.
  //  - preventDefault defaults to TRUE, which is what takes ⌘K back from the
  //    browser's own address-bar search.
  //
  // The seed overlay's bare `k` cannot fire from this input, because single-key
  // hotkeys default to ignoreInputs: true. The two never fight.
  useHotkey("Mod+K", () => setOpen(true), { enabled: !open });

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    // The query is this component's own state and the popup unmounting does not
    // clear it. Reset on close so the next ⌘K opens on the four sections rather
    // than on whatever was last searched for.
    if (!next) setQuery("");
  };

  const go = (item: PaletteItem): void => {
    handleOpenChange(false);
    router.push(item.href);
  };

  const groups = groupPaletteItems(items);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={triggerRef}
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Search"
              onClick={() => setOpen(true)}
            >
              <Search className="size-4" />
            </Button>
          }
        />
        <TooltipContent side="bottom">Search (⌘K)</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          {/* The seed overlay's treatment exactly: the blurred surface is the
              backdrop, and the popup above it is transparent and full-bleed, so
              the two read as one sheet rather than a card on a scrim. */}
          <DialogOverlay className="z-50 bg-background/70 backdrop-blur-xl supports-backdrop-filter:backdrop-blur-xl" />
          <DialogPopup
            aria-label="Search the admin"
            initialFocus={inputRef}
            finalFocus={triggerRef}
            // `items-stretch` (the flex default, so unstated) rather than
            // `items-start`: the column below has to REACH the bottom padding
            // for the list to have a height to fill. And `overflow-hidden`
            // rather than `overflow-y-auto` — exactly one thing on this sheet
            // scrolls, and it is the list.
            className="fixed inset-0 z-50 flex justify-center overflow-hidden p-6 pt-[12vh] outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
            // The popup covers the viewport, so nothing is ever "outside" it
            // for the primitive's own outside-press dismissal to catch. Only a
            // press that both starts and ends on the empty surround dismisses —
            // a drag that began on a row and released outside is a selection.
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) handleOpenChange(false);
            }}
          >
            <DialogTitle className="sr-only">Search the admin</DialogTitle>

            {/* `min-h-0` at every level of this column: a flex child's default
                `min-height: auto` refuses to shrink below its content, which is
                what makes an overflowing list push past the bottom of the
                viewport and get clipped by it instead of scrolling inside it. */}
            <div className="flex min-h-0 w-full max-w-xl flex-col gap-4">
              {/* `inline` renders the list without the primitive's own popup —
                  this sheet IS the popup — and it requires `open` stated
                  unconditionally so the list counts as visible. */}
              <Autocomplete
                inline
                open
                items={groups}
                value={query}
                onValueChange={setQuery}
                itemToStringValue={(item: PaletteItem) => item.label}
                autoHighlight="always"
                limit={20}
              >
                <AutocompleteInput
                  ref={inputRef}
                  aria-label="Search"
                  placeholder="Go to…"
                  className="w-full shrink-0 border-0 bg-transparent text-center font-heading text-3xl tracking-tight outline-none placeholder:text-muted-foreground/40 focus:outline-none"
                />

                <div className="flex min-h-0 flex-1 flex-col border-t pt-2">
                  {/* Must stay mounted for screen readers to announce it, so
                      the CHILDREN are conditional, never the component. */}
                  <AutocompleteStatus>
                    {load === "error"
                      ? "Could not load the index."
                      : load === "loading" && !loaded.current
                        ? "Loading…"
                        : null}
                  </AutocompleteStatus>

                  <AutocompleteEmpty>Nothing matches.</AutocompleteEmpty>

                  {/* No height cap: the list takes every pixel the input and
                      the sheet's padding leave, down to the bottom edge, and
                      scrolls inside that. `min-h-0` is what lets it. */}
                  <AutocompleteList className="min-h-0 flex-1">
                    {(group: { value: string; items: PaletteItem[] }) => (
                      <AutocompleteGroup key={group.value} items={group.items}>
                        <AutocompleteLabel>{group.value}</AutocompleteLabel>
                        <AutocompleteCollection>
                          {(item: PaletteItem) => {
                            const Icon = iconFor(item);
                            return (
                              <AutocompleteItem
                                key={item.id}
                                value={item}
                                // A row is a destination, so it is a real link:
                                // ⌘-click and "open in new tab" work, and the
                                // status bar shows where Enter goes. The click
                                // handler is what keeps it a soft navigation.
                                render={<a href={item.href} />}
                                onClick={(e) => {
                                  // Let the browser have the modified clicks.
                                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                                  e.preventDefault();
                                  go(item);
                                }}
                              >
                                <Icon className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">{item.label}</span>
                                {item.sublabel ? (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {item.sublabel}
                                  </span>
                                ) : null}
                                {KIND_LABEL[item.kind] ? (
                                  <span className="ml-auto shrink-0 font-heading text-[10px] uppercase tracking-wider text-muted-foreground/60">
                                    {KIND_LABEL[item.kind]}
                                  </span>
                                ) : null}
                              </AutocompleteItem>
                            );
                          }}
                        </AutocompleteCollection>
                      </AutocompleteGroup>
                    )}
                  </AutocompleteList>
                </div>
              </Autocomplete>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </>
  );
}
