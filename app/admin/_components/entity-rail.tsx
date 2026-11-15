"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Chrome, ChromeItem, chromeItemClass } from "@/components/chrome";
import { Button } from "@/components/ui/button";
import { sweepRejection } from "@/lib/sweep-rejection";
import { RailPanelContext, type PagePanel, type RailPanelApi } from "./rail-panel";

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
 * takes the opposite side, for one panel's sake. The media picker uploads to
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
 *
 * WHAT A DISMISSIBLE SURFACE OWES. `overlay-sheet.tsx` gets focus containment,
 * scroll lock, Escape and focus restoration from `Dialog.Root` and only has to
 * name the two focus ends. This is not a dialog — the page behind it stays
 * live and usable, which is the point of pushing it aside rather than
 * scrimming it — so the primitive is the wrong tool and the two halves that
 * are NOT about modality are hand-rolled below: Escape dismisses, and closing
 * returns focus to the trigger that opened the panel. Both are load-bearing
 * rather than polish. Focus, because the Close button lives inside the subtree
 * that `inert` is about to swallow, so without restoring it the browser blurs
 * to `document.body` and the next Tab restarts at the top of the document.
 * Escape, because below the push threshold the panel is full-width with no
 * scrim, no outside-press dismissal, and it paints over the trigger cluster
 * (same `z-40`, later in the DOM) — the ✕ would otherwise be the only exit.
 *
 * PAGE PANELS (spec 2026-11-15 §11). Something inside the page can open a
 * panel here too, through `useRailPanel()` (`rail-panel.tsx`) — the editor's
 * staging blocks do, for their forms. It is the same surface (`PanelShell`,
 * below, draws both kinds), the same push, the same Escape and the same focus
 * return, and only one panel of either kind is open at a time. Two things
 * differ, each for a reason: a page panel UNMOUNTS on close, because its
 * draft is meant to be discarded (the stay-mounted argument above is about an
 * upload persisted on Save in a panel the page re-renders every time, which a
 * staging form is not); and its contents arrive at run time from a client
 * component rather than from the server. The shell still composes no payload
 * and names no field — the caller hands it a title and a node.
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
 * How wide a panel is, in one place.
 *
 * `max-w-md` is 28rem — 448px — and that number is an operand in `PAGE_ASIDE`'s
 * arithmetic below. Two independent literals could drift apart silently (the
 * push would clear a panel of the wrong width, which looks like a spacing
 * quibble rather than a bug), so the class string and the reasoning quote the
 * same constant.
 *
 * `w-full max-w-md` is already `min(100%, 28rem)`. There was an `lg:w-[28rem]`
 * here that set the width it already had at that breakpoint — dead code reading
 * as a live rule, which is the thing CLAUDE.md objects to most.
 */
const PANEL_WIDTH = "w-full max-w-md";

/**
 * How far the page moves to make room, and from what width.
 *
 * AN OFFSET, NOT A TRANSFORM, and not padding either. Three choices, each
 * against something.
 *
 * Against PADDING: `app/admin/(chrome)/layout.tsx` argues for it, because a
 * transform does not make room, it MOVES — and its 14rem move pushed a WIDE
 * grid's left edge past the viewport. Both halves invert here. This is the
 * reading column, which has gutters to spare (`plant-rail.tsx`'s case exactly),
 * and the same docblock states the other half outright: "keeps its columns" is
 * a benefit for a prose editor, whose measured width and caret position must
 * not move under the author. Padding re-flows; neither of the other two does.
 * Padding is also unavailable. This component renders INSIDE `READING_COLUMN`
 * (`AdminMain` → `div.mx-auto.max-w-3xl.px-6` → the page), so a right padding
 * added here lands inside a 768px box and squeezes the editor to roughly 320px.
 * Only the layout can pad, and only for its own `@sheet` slot.
 *
 * Against a TRANSFORM, which this was first and which is the reason for the
 * rewrite: `transform` makes an element a CONTAINING BLOCK for its
 * `position: fixed` descendants. This wrapper holds the whole page body, and
 * two things inside it are fixed to the VIEWPORT on purpose:
 *
 *  - the floating commit, a `<Chrome magnet="bottom-center">` — `Chrome` is
 *    `fixed` and that magnet is `bottom-4`, so anchored to a wrapper whose
 *    height is the whole document it resolves near the end of the article and
 *    the floating save button stops floating, exactly while a panel is open;
 *  - `components/editor/suggestion-menu.tsx`, which positions the @ and /
 *    menus with `position: fixed` from `clientRect()` — viewport coordinates —
 *    so at ≥1216px with a panel open the menu lands 224px away from the caret.
 *
 * Both are gated on open state AND on viewport width, so `tsc`, `eslint`,
 * `npm test` and `npm run build` all pass them.
 *
 * A RELATIVE OFFSET keeps every promise the transform made and drops the trap.
 * `position: relative` offsets are applied after layout, so the box keeps its
 * computed width and nothing re-flows — the editor keeps its measure, the caret
 * keeps its place — and a relatively positioned element does NOT establish a
 * containing block for fixed descendants. `right-56` is 14rem, the same 224px
 * in the same direction the transform moved.
 *
 * The cost, paid knowingly: `right` is a layout property, so the animation is
 * not compositor-accelerated the way a transform's is. A 200ms slide of one
 * column may drop frames on a slow machine where the transform would not. That
 * is a worse animation in exchange for two features that would otherwise be
 * broken, which is the right way round.
 *
 * (`relative` is on the wrapper permanently rather than toggled with the
 * offset: it must not flip between `static` and `relative` under the page,
 * since that would move the anchor for any absolutely positioned descendant
 * mid-interaction. Nothing under it depended on the `static` it used to have
 * while closed — `components/entity-card.tsx` positions nothing absolutely at
 * all, `components/admin/media-picker.tsx`'s one absolute remove button sits
 * inside its own `relative` thumbnail, and `components/editor/prose-editor.tsx`,
 * `components/editor/entity-views.tsx` and `components/plant-header.tsx` carry
 * no absolute, sticky or fixed class between them. `right-0` is there for the
 * same permanence — `auto` is not an interpolable value, so an offset animating
 * out of `auto` would jump.)
 *
 * The number, with `main`'s `px-20` (160px) and a 448px panel: a 768px column
 * centred has its left edge at (vw − 768)/2 and its right edge at (vw + 768)/2.
 * Moved 224px left, clearing the panel needs (vw + 768)/2 − 224 ≤ vw − 448, and
 * staying on screen needs (vw − 768)/2 − 224 ≥ 0. Both give vw ≥ 1216. Below
 * that there is no offset that does both, so there is none — the panel floats
 * over the prose instead, dismissible, as the screen library's does below `lg`.
 */
const PAGE_BASE = "relative right-0 transition-[right] duration-200 ease-out";
const PAGE_ASIDE = "min-[76rem]:right-56";

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

/**
 * The panel itself, for both kinds — a rail item's and a page's. One element,
 * one class string, one heading-and-✕ row: a page panel is the rail's surface,
 * not a second one drawn to look like it (spec 2026-11-15 §11).
 *
 * `open` is false only for a rail panel, which stays mounted (this file's
 * docblock); a page panel is mounted only while it is open, so it arrives with
 * `open` and `enter` both true. `enter` slides it in from the edge with
 * `@starting-style` — the closed rail panels already sit off-screen and slide
 * by toggling the class, which a freshly mounted element cannot do. It is not
 * given to rail panels: one opened by `openOnError` is in the server HTML
 * already open, on purpose, and must not slide in on load.
 */
function PanelShell({
  id,
  label,
  heading,
  open,
  enter = false,
  onClose,
  children,
}: {
  id: string;
  /** Names the panel when there is no heading, and its ✕ always. */
  label: string;
  heading?: string;
  open: boolean;
  enter?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <aside
      id={id}
      // The heading when there is one, so what a screen reader announces is
      // the words the author can see — they disagree wherever a panel's
      // heading is not its icon's label. The label is the fallback, never a
      // second name.
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : label}
      // `inert` rather than unmounting, for a rail panel — see this file's
      // docblock. It also takes the panel out of the accessibility tree and
      // out of the tab order, so a closed panel's fields are unreachable
      // rather than merely off-screen.
      inert={!open}
      // A closed panel sits at `translate-x-full`, a full panel-width past the
      // right edge, and produces no horizontal scrollbar ONLY because
      // `app/globals.css` clips `body`'s overflow-x — a rule written for the
      // full-bleed screen strip, with a second thing now depending on it.
      //
      // `backdrop-filter` is on the same list as `transform`, so this panel IS
      // a containing block for any fixed descendant — the trap PAGE_ASIDE
      // removed from the wrapper, still live in here. Nothing in a panel is
      // fixed today.
      className={
        `fixed inset-y-0 right-0 z-40 flex ${PANEL_WIDTH} flex-col gap-4 ` +
        "overflow-y-auto overscroll-contain " +
        "border-l bg-card/95 p-6 shadow-xl backdrop-blur-xl " +
        "transition-transform duration-200 ease-out " +
        (open ? "translate-x-0" : "translate-x-full") +
        (enter ? " starting:translate-x-full" : "")
      }
    >
      <div className={"flex items-start gap-4 " + (heading ? "justify-between" : "justify-end")}>
        {heading ? (
          <h2
            id={headingId}
            className="font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground"
          >
            {heading}
          </h2>
        ) : null}
        <Button type="button" size="icon" variant="ghost" aria-label={`Close ${label}`} onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      {children}
    </aside>
  );
}

/**
 * A page panel's contents, given focus when they arrive.
 *
 * A rail panel's trigger sits beside it at the edge, one Tab away. A page
 * panel's opener is somewhere in the middle of an article, and the panel is
 * after the whole page in the DOM — left where it was, focus would be a
 * document's worth of Tabs from the form it just opened. The popover this
 * replaces moved focus in too. The first control, not the panel: the ✕ is the
 * first thing in it, and focusing that would make Enter a dismissal.
 */
function FocusOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), " +
          "button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )
      ?.focus();
  }, []);
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

export function EntityRail({
  label,
  items,
  openOnError,
  children,
}: {
  /** The cluster's accessible name, e.g. "Sprout panels". */
  label: string;
  /**
   * May be empty: the plant-narrative and pod pages render a rail with no
   * items so their editor has somewhere to open a staging block's panel.
   */
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
  // Seeded from `openOnError` rather than always `null`, so a rejected save
  // arrives with its panel ALREADY OPEN in the server-rendered HTML instead of
  // sliding in a frame after hydration. The initializer runs on the server too;
  // the effect below is a supplement to it for the soft-navigation case, where
  // this component keeps its place in the tree and no initializer runs again.
  const [open, setOpen] = useState<string | null>(() =>
    openOnError && items.some((i) => i.id === openOnError) ? openOnError : null,
  );

  // The page panel, if one is open (`rail-panel.tsx`). Mirrored in a ref
  // because `close` must restore focus BEFORE the re-render that unmounts it
  // (the same ordering `close` below argues for rail panels), and must know
  // which panel is open to honour `close(id)` — neither can wait for state.
  const [page, setPage] = useState<PagePanel | null>(null);
  const pageRef = useRef<PagePanel | null>(null);

  // Ids for the panels, so a trigger can point at the one it controls. The
  // rail's panels are always mounted, so `aria-controls` always resolves.
  const uid = useId();
  const panelId = (id: string) => `${uid}-${id}`;

  // The triggers, by id. Closing has to put focus back on one of them, and
  // `openOnError` opens a panel with no click to remember — so a map keyed by
  // id rather than one ref written when a trigger is pressed.
  const triggers = useRef(new Map<string, HTMLButtonElement | null>());

  // Reconciled against the current items rather than trusted: an id that is no
  // longer offered leaves the page un-pushed, instead of pushed aside to make
  // room for a panel that is not there. Nothing reads the stored id except this
  // line, so one left dangling is inert rather than something to clean up.
  const active = items.find((i) => i.id === open) ?? null;
  const activeId = active ? active.id : null;

  const close = useCallback((id: string): void => {
    setOpen(null);
    // Before the re-render, while the panel is still interactive: moving focus
    // out first means `inert` has nothing to blur, so focus lands on the
    // trigger rather than on `document.body`.
    triggers.current.get(id)?.focus();
    sweepRejection();
  }, []);

  // Takes the page panel down. Focus goes back first, for `close`'s reason —
  // here the panel is about to UNMOUNT rather than go inert, and the effect
  // is the same: focus inside a removed subtree falls to `document.body`. An
  // opener that is gone (its block deleted) has nothing to return to, and the
  // panel closes anyway. `restore` is false when a rail trigger replaces the
  // page panel: that trigger was just pressed and already holds focus.
  const dismissPage = useCallback((restore: boolean): void => {
    const current = pageRef.current;
    if (!current) return;
    pageRef.current = null;
    if (restore && current.returnFocus?.isConnected) current.returnFocus.focus();
    setPage(null);
    current.onClose?.();
  }, []);

  // One panel at a time: opening a page panel closes the rail's, and the
  // reverse is the rail trigger's onClick below. A rail panel closed this way
  // gets no focus restoration — focus is going into the page panel instead.
  const openPage = useCallback((next: PagePanel): void => {
    const previous = pageRef.current;
    pageRef.current = next;
    setOpen(null);
    setPage(next);
    if (previous && previous.id !== next.id) previous.onClose?.();
  }, []);

  const closePage = useCallback(
    (id?: string): void => {
      if (id !== undefined && pageRef.current?.id !== id) return;
      dismissPage(true);
    },
    [dismissPage],
  );

  const pageId = page ? page.id : null;
  const api = useMemo<RailPanelApi>(
    () => ({ openId: pageId, open: openPage, close: closePage }),
    [pageId, openPage, closePage],
  );

  useEffect(() => {
    if (openOnError && items.some((i) => i.id === openOnError)) {
      dismissPage(false);
      setOpen(openOnError);
    }
    // items is rebuilt every render by the page; depending on it would reopen
    // the panel on every re-render, including the one that closes it.
    //
    // What an `openOnError`-only dep CANNOT catch: a rejection identical to the
    // last one. The props are then identical too, so this does not re-run, and
    // the message renders inside a closed, inert panel. Reaching it takes a
    // deliberate dismissal while a write is still in flight — otherwise the
    // panel is inert and its submit is out of the hit-testing tree, so the
    // author must reopen (which sets the id directly) before they can submit
    // again — and `sprout-hero.tsx` has the same race with `[error, errorForm]`.
    // The fix, if one is ever wanted, is a per-attempt nonce from the page that
    // BOTH files take, not a prop invented here for one caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnError]);

  // Escape, while a panel is open. On the document rather than the panel: the
  // author may have clicked back into the page behind it, which stays live
  // precisely because this is not a modal.
  useEffect(() => {
    if (!activeId && !pageId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Base UI portals its popups to `document.body`, so an Escape a nested
      // Popover, Select or Dialog has already handled still bubbles to here.
      // Without this guard one keypress would dismiss both it and the panel
      // around it. The editor's `@` / `/` menu is the same case from the other
      // side: ProseMirror prevents the default of an Escape it handled.
      if (event.defaultPrevented) return;
      if (event.key !== "Escape") return;
      if (activeId) close(activeId);
      else dismissPage(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeId, pageId, close, dismissPage]);

  return (
    <RailPanelContext.Provider value={api}>
      {/* The page, moved. Always this element, whether or not there are items:
          swapping between a bare fragment and a wrapper at this position would
          change the element type React sees, remounting the entire page body —
          including a prose editor holding unsaved text. The provider above it
          adds no element, so the same holds with it there. */}
      <div className={`${PAGE_BASE} ${active || page ? PAGE_ASIDE : ""}`}>{children}</div>

      {items.length === 0 ? null : (
        <>
          <Chrome
            magnet="right"
            orientation="vertical"
            label={label}
            className={PLATE_WHILE_OPEN}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const current = activeId === item.id;
              return (
                <ChromeItem key={item.id} label={item.label}>
                  <button
                    type="button"
                    ref={(el) => {
                      triggers.current.set(item.id, el);
                    }}
                    aria-label={item.label}
                    aria-expanded={current}
                    aria-controls={panelId(item.id)}
                    onClick={() => {
                      if (current) return close(item.id);
                      dismissPage(false);
                      setOpen(item.id);
                    }}
                    className={chromeItemClass(current)}
                  >
                    <Icon className="size-4" />
                  </button>
                </ChromeItem>
              );
            })}
          </Chrome>

          {items.map((item) => (
            <PanelShell
              key={item.id}
              id={panelId(item.id)}
              label={item.label}
              heading={item.heading}
              open={activeId === item.id}
              onClose={() => close(item.id)}
            >
              {item.panel}
            </PanelShell>
          ))}
        </>
      )}

      {/* NOT kept mounted, unlike the rail's: a page panel's draft is thrown
          away on close by design, and unmounting is what throws it away
          (spec §11). Keyed by the opener, so a second block's panel opened
          over the first is a fresh form rather than the first one's state. */}
      {page ? (
        <PanelShell
          key={page.id}
          id={`${uid}-page`}
          label={page.title}
          heading={page.title}
          open
          enter
          onClose={() => dismissPage(true)}
        >
          <FocusOnMount>{page.content}</FocusOnMount>
        </PanelShell>
      ) : null}
    </RailPanelContext.Provider>
  );
}
