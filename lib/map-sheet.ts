/**
 * The map's entity sheet — the parts of it that are arithmetic.
 *
 * No imports, on purpose: `app/admin/_components/garden-map.tsx` (a client
 * island that may import only types from `lib/` plus this) and `map-sheet.tsx`
 * both read these, and `lib/garden-map-source.test.ts` forbids any `lib/`
 * module that reaches `node:fs` from a client file.
 */

export const MAP_PATH = "/admin/map";

/** On the sheet's root, so the island can find it without a ref crossing files. */
export const MAP_SHEET_ATTR = "data-map-sheet";

/** On the prose editor's surface while it holds an unsaved edit. */
export const EDITOR_DIRTY_ATTR = "data-editor-dirty";

export const DISCARD_PROMPT = "You have unsaved changes in this editor. Discard them?";

/**
 * Where closing goes. The sheet's own URL is `/admin/bean/x`, so the map's
 * `?plant=` and `?view=` are gone from it; the caller keeps the last map query
 * it saw and hands it back here. Accepts `location.search` (with `?`) or
 * `URLSearchParams#toString()` (without).
 */
export function mapCloseHref(search: string): string {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return query ? `${MAP_PATH}?${query}` : MAP_PATH;
}

/**
 * The sheet is open whenever the router is anywhere but the map itself while
 * the map's layout is still mounted — which is exactly the interception: the
 * layout is unmounted by any navigation the slot does not catch.
 */
export function sheetOpenFor(pathname: string): boolean {
  return pathname.replace(/\/$/, "") !== MAP_PATH;
}

/** The fields of a `MouseEvent` this reads, so a test passes a plain object. */
export interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** The slice of an `<a>` this reads. */
export interface AnchorLike {
  getAttribute(name: string): string | null;
}

/**
 * Whether a click navigates THIS tab away from what is on screen: a plain
 * primary click on a real destination that opens in the same tab. A modified or
 * middle click opens elsewhere and leaves this tab's draft alone; a `#`
 * fragment or a `_blank` target does not replace the sheet's content either.
 * The sheet and the map's node click both ask before any such click when an
 * editor holds an unsaved edit.
 */
export function isInPlaceNavigation(click: ClickLike, anchor: AnchorLike | null): boolean {
  if (!anchor) return false;
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  const target = anchor.getAttribute("target");
  return !target || target === "_self";
}

/** The slice of `ParentNode` this needs, so a test passes a plain object. */
export interface Queryable {
  querySelector(selector: string): unknown;
}

export function hasUnsavedEdit(root: Queryable | null): boolean {
  return Boolean(root?.querySelector(`[${EDITOR_DIRTY_ATTR}]`));
}

/**
 * True when it is safe to leave: nothing is unsaved, or the author said so.
 * `confirm` is a parameter so a test supplies the answer.
 */
export function confirmDiscard(
  root: Queryable | null,
  confirm: (message: string) => boolean = (message) => window.confirm(message),
): boolean {
  return hasUnsavedEdit(root) ? confirm(DISCARD_PROMPT) : true;
}
