"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Bean, Flower2, Leaf, Package, Search, Sprout, Waypoints } from "lucide-react";
import type { ComponentType } from "react";
// lib/palette-items.ts, never lib/palette.ts: the latter imports lib/data.ts,
// which opens with `node:fs`. Reaching for it from here does not merely bloat
// the bundle — it fails the build.
import {
  groupPaletteItems,
  sectionItems,
  sectionNavId,
  type PaletteItem,
  type PaletteKind,
} from "@/lib/palette-items";
// The rail's own map, imported rather than repeated — see section-icons.ts for
// what the second copy cost.
import { SECTION_ICONS } from "./section-icons";
import { EntityAvatar } from "@/components/admin/glyphs";
import { ChromeItem, chromeItemClass } from "@/components/chrome";
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
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteLabel,
  AutocompleteList,
  AutocompleteStatus,
} from "@/components/ui/autocomplete";

/**
 * The ⌘K command palette — the FOURTH deliberate client-JS exception in this
 * codebase, and the mildest of the four. Recorded as such in CLAUDE.md.
 *
 * Without script it renders nothing, ⌘K does nothing, and the search button is
 * not there — and its absence costs nothing, because it adds no destination of
 * its own. Every row is a faster route to a page that still has its slow route:
 * the sections from the rail, and every plant, pod, bean, sprout and seed
 * from the list page that already links to it. It also never writes: no form,
 * no server action, no submit. That is what makes this a contained loss like
 * the media picker's rather than a real one like seed capture's.
 *
 * A navigator, not a command runner. Nothing here publishes, deletes, promotes
 * or syncs — which is what keeps it small enough to trust.
 *
 * ONE INDEX, ONE ROW DEFINITION, TWO SHELLS. `PaletteAutocomplete` is the
 * palette — the input, the fetch, the groups, the rows and their marks. The
 * shells are what differ: the `Dialog` below, opened by ⌘K from the chrome, and
 * the bare one on the welcome page (`palette-search.tsx`), which is inline and
 * focused on arrival. A second implementation of the rows would be a second
 * answer to "what does a pod look like in a list", and the first one is
 * already shared with the rail.
 */

const ICONS: Record<PaletteKind, ComponentType<{ className?: string }>> = {
  section: Waypoints,
  // Only ever reached if a plant row somehow arrives without a name to make
  // initials from — RowMark below draws plants as avatars, not icons.
  plant: Flower2,
  pod: Package,
  bean: Bean,
  sprout: Sprout,
  seed: Leaf,
};

function iconFor(item: PaletteItem): ComponentType<{ className?: string }> {
  if (item.kind === "section") {
    const id = sectionNavId(item);
    return (id ? SECTION_ICONS[id] : undefined) ?? ICONS.section;
  }
  return ICONS[item.kind];
}

/**
 * A row's left gutter: an avatar for a plant, a lucide icon for everything else.
 *
 * Plants get the mark the admin's tables already draw — the same
 * `EntityAvatar` from components/admin/glyphs.tsx, imported rather than
 * reproduced, so a plant looks the same everywhere it is listed and there is
 * one place the squircle radius and the initials rule are decided.
 *
 * The fixed `size-6` box is what keeps the two kinds of mark in one column: an
 * avatar is 24px and a lucide icon is 16px, so without it the labels would step
 * left and right down the list depending on the row's kind.
 *
 * `aria-hidden` on the whole gutter: the avatar is decorative here (its name is
 * the very next thing in the row), and an icon that repeated the group heading
 * would only make every row read twice.
 */
function RowMark({ item }: { item: PaletteItem }) {
  const Icon = iconFor(item);
  return (
    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
      {item.kind === "plant" ? (
        <EntityAvatar mark={{ name: item.label, ...(item.logoUrl ? { logoUrl: item.logoUrl } : {}) }} />
      ) : (
        <Icon className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}

/** The shortcut as engraved. A JS string, deliberately: a JSX attribute is raw
 *  text, so `hotkey="\u2318K"` renders the six characters rather than ⌘K. */
const CMD_K = "⌘K";

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
 * The index, kept beyond the life of any one mount.
 *
 * The dialog's popup is unmounted while it is closed, so every ⌘K would
 * otherwise open onto the sections alone and then flash the full list in when
 * the fetch landed — and a REFRESH that failed would have nothing to fall back
 * on, which is the one case the palette is careful about. A module-scoped cache
 * is what lets the fetch live in the shared component rather than in each
 * shell: the two shells then warm the same index, so opening ⌘K on the welcome
 * page draws the list the inline search already loaded.
 *
 * Never stale for long: every mount refetches, and the cache is only ever what
 * the last successful fetch returned.
 */
let cachedItems: PaletteItem[] | null = null;

/**
 * The palette proper: the input, the index, the groups and the rows.
 *
 * Fetches on mount and not before — which is what keeps the dialog's promise
 * that nothing happens until it is opened, since the popup mounts this on open.
 * `onNavigate` is the shell's chance to get out of the way before the router
 * moves (the dialog closes itself); the inline shell has nothing to close and
 * passes nothing.
 *
 * `inputRef` is likewise the shell's: the dialog hands it to `initialFocus` so
 * the caret starts in the field rather than on the popup. The inline shell uses
 * `autoFocus` instead, because there is no popup to take focus from it.
 *
 * It lays out as the flex COLUMN its shell provides — an input that does not
 * shrink, then a list that takes the rest — rather than wrapping itself in a
 * box, so each shell decides how tall the palette is.
 */
export function PaletteAutocomplete({
  autoFocus = false,
  inputRef,
  onNavigate,
  surface = "inline",
}: {
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onNavigate?: () => void;
  /** Which shell holds the list. `inline` is the ⌘K dialog, whose sheet is the
   *  surface; `popover` is an ordinary field with the list in a popup under it.
   *  The index, the rows and the fetch are the same in both — see the two
   *  returns at the bottom of this component for the only difference. */
  surface?: "inline" | "popover";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // Popover surface only: the inline one is open by definition. Held here
  // rather than derived from `query` so Escape can close the list without
  // clearing what was typed.
  const [open, setOpen] = useState(false);
  // The sections are the starting index, built locally from NAV_ITEMS —
  // never fetched. That one line is what makes the palette impossible to open
  // onto nothing, whatever the network does.
  const [items, setItems] = useState<PaletteItem[]>(() => cachedItems ?? sectionItems());
  const [load, setLoad] = useState<LoadState>("idle");

  // Only the newest request may write to state: two quick opens must not let a
  // slow first response overwrite a fresh second one.
  const requestId = useRef(0);
  // Whether a full index has ever landed. Governs the Status line only: before
  // the first load "Loading…" is worth saying, after it a background refresh
  // is not.
  const loaded = useRef(cachedItems !== null);

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
      // After the staleness check, not before: the cache is what the NEXT mount
      // opens onto, and a late response that lost the race must not become it.
      if (id !== requestId.current) return;
      cachedItems = body.items;
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

  // Refetched on every mount, not once: an author who has just created a sprout
  // finds it on the next press, with no reload. The cache renders immediately
  // meanwhile, so the refresh is never something to wait through.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const go = (item: PaletteItem): void => {
    onNavigate?.();
    router.push(item.href);
  };

  const groups = groupPaletteItems(items);

  // The list and everything that speaks for it. Identical in both surfaces —
  // only what WRAPS it differs, which is the whole point of the split.
  const body = (
    <>
      {/* Must stay mounted for screen readers to announce it, so the
          CHILDREN are conditional, never the component. */}
      <AutocompleteStatus>
        {load === "error"
          ? "Could not load the index."
          : load === "loading" && !loaded.current
            ? "Loading…"
            : null}
      </AutocompleteStatus>

      <AutocompleteEmpty>Nothing matches.</AutocompleteEmpty>

      {/* No height cap here: the list takes every pixel its surface leaves and
          scrolls inside that. `min-h-0` is what lets it. The dialog's surface
          is the sheet; the popup's is `--available-height`. */}
      <AutocompleteList className="min-h-0 flex-1">
        {(group: { value: string; items: PaletteItem[] }) => (
            <AutocompleteGroup key={group.value} items={group.items}>
              <AutocompleteLabel>{group.value}</AutocompleteLabel>
              <AutocompleteCollection>
                {(item: PaletteItem) => (
                  <AutocompleteItem
                    key={item.id}
                    value={item}
                    // A row is a destination, so it is a real link: ⌘-click and
                    // "open in new tab" work, and the status bar shows where
                    // Enter goes. The click handler is what keeps it a soft
                    // navigation.
                    render={<a href={item.href} />}
                    onClick={(e) => {
                      // Let the browser have the modified clicks.
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      go(item);
                    }}
                  >
                    <RowMark item={item} />
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
                )}
              </AutocompleteCollection>
            </AutocompleteGroup>
          )}
      </AutocompleteList>
    </>
  );

  // THE POPOVER SURFACE — the welcome page's. An ordinary field that stays an
  // ordinary field until it has something to say: the list is a popup anchored
  // under the input, and it opens on the first character rather than on focus
  // or on click.
  //
  // That last part is the whole difference, and it is why `openOnInputClick` is
  // off. An index that is already open when you arrive is not a search field,
  // it is a menu that happens to have a text box on top — it reserves a screen
  // of space for rows nobody asked for, and every keystroke re-lays it out
  // under the caret.
  if (surface === "popover") {
    return (
      <Autocomplete
        items={groups}
        value={query}
        onValueChange={(next: string) => {
          setQuery(next);
          // Typing opens it; clearing the field closes it again, so a
          // backspaced-to-empty search leaves the page as it found it.
          setOpen(next.trim().length > 0);
        }}
        open={open}
        onOpenChange={setOpen}
        openOnInputClick={false}
        itemToStringValue={(item: PaletteItem) => item.label}
        autoHighlight="always"
        limit={20}
      >
        <AutocompleteInput
          ref={inputRef}
          autoFocus={autoFocus}
          aria-label="Search"
          placeholder="Search the garden…"
          className="h-12 w-full rounded-lg border bg-background px-4 text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-[3px] focus:ring-ring/20"
        />
        <AutocompleteContent>{body}</AutocompleteContent>
      </Autocomplete>
    );
  }

  // THE INLINE SURFACE — the ⌘K dialog's. `inline` renders the list without the
  // primitive's own popup, because the sheet IS the surface, and it requires
  // `open` stated unconditionally so the list counts as visible. A popup inside
  // a dialog would be a second floating layer over the first.
  return (
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
        autoFocus={autoFocus}
        aria-label="Search"
        placeholder="Go to…"
        className="w-full shrink-0 border-0 bg-transparent text-center font-heading text-3xl tracking-tight outline-none placeholder:text-muted-foreground/40 focus:outline-none"
      />

      {/* `border-t` and nothing else. Any padding here is padding the list
          cannot use, and it shows as a band between the divider and the first
          row. */}
      <div className="flex min-h-0 flex-1 flex-col border-t">{body}</div>
    </Autocomplete>
  );
}

/**
 * THERE IS NO MOUNT GATE HERE ANY MORE, and its removal is a performance fix
 * rather than a tidy-up.
 *
 * It used to read:
 *
 *     const [mounted, setMounted] = useState(false);
 *     useEffect(() => setMounted(true), []);
 *     if (!mounted) return null;
 *
 * — so the search button was absent from the server HTML, absent through
 * hydration, and arrived only when the effect flushed. On a screen recording of
 * the admin that was the icon visibly blinking in a few hundred milliseconds
 * after everything around it had painted, on every single page.
 *
 * The gate's argument was that the server render IS the script-off render, and
 * a button that cannot be pressed should not be drawn. That argument belonged
 * to the POC's zero-client-JS rule and does not survive it: the admin is a
 * JavaScript application (CLAUDE.md §"Script, by zone"), it is behind a session
 * gate, and it is not a surface anyone reaches with script disabled. Paying a
 * visible flash on every page to be correct for a reader who does not exist is
 * the wrong trade.
 *
 * This is NOT the shape MediaPicker's gate has, and that one stays. There the
 * gate is a data-loss guard — an unmounted picker must be inert rather than
 * destructive, because a server-rendered submit beside it would post an empty
 * media list and clear every stored image (`lib/media-picker-mount.test.ts`
 * pins it). Nothing here writes: the palette is a navigator, every row is a
 * faster route to a page that still has its slow route, and the worst a
 * script-off reader gets is a button that does nothing.
 *
 * `Palette` stays a separate component so its hooks sit below this boundary,
 * which is the half of the old arrangement worth keeping.
 */
export function CommandPalette() {
  return <Palette />;
}

/** The dialog shell: the hotkey, the trigger, and the sheet the palette sits
 *  in. It knows no field name and composes no row — only when the palette is
 *  on screen and how big it is. */
function Palette() {
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      {/* The trigger wears the chrome's own ghost box (components/chrome.tsx)
          rather than a Button — it lives IN the account cluster, and a button
          that sized itself differently from the two icons beside it was the
          clearest sign the cluster had three implementations. The label and its
          side come from the cluster it is dropped into. */}
      {/* The shortcut is a `<kbd>` chip beside the label now rather than
          parenthetical text inside it — same treatment as the rail's ⌥ digits,
          so every shortcut in the chrome is drawn one way. The control's own
          `aria-label` stays the plain word: a screen reader user gets "Search",
          not "Search (⌘K)", and the chip is `aria-hidden` with the rest of the
          label. */}
      <ChromeItem label="Search" hotkey={CMD_K}>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Search"
          onClick={() => setOpen(true)}
          className={chromeItemClass()}
        >
          <Search className="size-4" />
        </button>
      </ChromeItem>

      <Dialog open={open} onOpenChange={setOpen}>
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
            // scrolls, and it is the list. No bottom padding either: the list
            // runs to the bottom edge of the viewport, so a long one reads as
            // continuing rather than as ending in a margin.
            className="fixed inset-0 z-50 flex justify-center overflow-hidden px-6 pb-0 pt-[12vh] outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
            // The popup covers the viewport, so nothing is ever "outside" it
            // for the primitive's own outside-press dismissal to catch. Only a
            // press that both starts and ends on the empty surround dismisses —
            // a drag that began on a row and released outside is a selection.
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <DialogTitle className="sr-only">Search the admin</DialogTitle>

            {/* `min-h-0` at every level of this column: a flex child's default
                `min-height: auto` refuses to shrink below its content, which is
                what makes an overflowing list push past the bottom of the
                viewport and get clipped by it instead of scrolling inside it.
                The popup unmounts with the dialog, so the query resets itself
                on close and the next ⌘K opens on the sections rather than on
                whatever was last searched for. */}
            <div className="flex min-h-0 w-full max-w-xl flex-col gap-4">
              <PaletteAutocomplete inputRef={inputRef} onNavigate={() => setOpen(false)} />
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </>
  );
}
