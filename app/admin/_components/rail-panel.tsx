"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The door through which something INSIDE an entity page opens a panel in
 * that page's `EntityRail` (spec 2026-11-15 §11) — today the staging blocks'
 * forms (components/editor/staging-views.tsx), which used to float in a
 * popover anchored under their block until a tall figure pushed its own form
 * below the viewport.
 *
 * A module of its own rather than an export of `entity-rail.tsx`, because of
 * who imports it. The editor's node views need the hook and the type and
 * nothing else; importing `entity-rail.tsx` for them would make the editor
 * depend on the rail's chrome, lucide and `sweepRejection`, and would pull all
 * of that into `lib/editor.test.ts`, which builds the staging extensions
 * headless. This file is a context and a type — the contract both sides
 * agree on, and the only thing either needs from the other.
 *
 * The contract carries a title, a node and where focus goes back to. It
 * carries no field name and no action, which is what keeps the rail a shell:
 * the content is composed by the caller, exactly as a rail item's `panel` is.
 */

export interface PagePanel {
  /** Unique per opener. Opening the panel that is already open replaces its content in place. */
  id: string;
  /** Drawn as the panel's heading and names it for assistive tech. */
  title: string;
  /** Composed by the caller; the rail renders it and learns nothing from it. */
  content: ReactNode;
  /**
   * Where focus goes when the panel is dismissed (Escape, ✕ or `close`) — if
   * focus was in the panel or on `document.body`; never out of the page.
   */
  returnFocus: HTMLElement | null;
  /** Called once when this panel stops being the open one, for whatever reason. */
  onClose?: () => void;
}

export interface RailPanelApi {
  /** The id of the page panel that is open, or null. Rail panels do not appear here. */
  openId: string | null;
  /** The page panel's DOM id, for an opener's `aria-controls` while it is open. */
  panelId: string;
  /** Opens a page panel, closing whatever panel — rail or page — was open. */
  open: (panel: PagePanel) => void;
  /**
   * Closes the page panel and returns focus to its `returnFocus`. With an id,
   * only if THAT panel is the open one — which is what lets an opener that is
   * going away (a staging block deleted while its form is open) close its own
   * panel without closing somebody else's.
   */
  close: (id?: string) => void;
}

export const RailPanelContext = createContext<RailPanelApi | null>(null);

/** The enclosing `EntityRail`'s page-panel door, or null outside one. */
export function useRailPanel(): RailPanelApi | null {
  return useContext(RailPanelContext);
}
