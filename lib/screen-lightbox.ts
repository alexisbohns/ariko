/**
 * The lightbox's arithmetic and its one shared name — everything it decides
 * that is not a render.
 *
 * ISOMORPHIC, and pinned as server-safe in lib/server-safe-source.test.ts,
 * because BOTH sides of the arrangement import it: `components/screen-strip.tsx`
 * (server-safe, rendered by the public plant page) writes the attribute below
 * onto its anchors, and `app/(public)/_components/screen-lightbox.tsx` (the
 * client island) reads it back. One constant is what keeps the two from
 * drifting — rename the attribute on one side only and the island finds no
 * anchors, intercepts nothing, and every screen quietly goes back to opening
 * the bare image. That failure is SAFE (the link still works), which is exactly
 * why nothing else would report it.
 */

/**
 * The attribute the strip puts on each screen's anchor, carrying its slug.
 *
 * A data attribute rather than a class or a DOM position: the island must be
 * able to tell a screen's anchor from any other link on the page, and to know
 * WHICH screen it is, without the strip rendering anything on the island's
 * behalf. The anchor stays the gallery's; the island only reads it.
 */
export const SCREEN_ANCHOR_ATTR = "data-screen";

/** The least of a MouseEvent the interception test needs — structural, so the
 *  test can hand it a literal. */
export interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/**
 * Whether a click on a screen's anchor is the island's to take.
 *
 * Only a PLAIN primary click. Every modifier is the visitor asking the browser
 * for something specific — ⌘/Ctrl for a new tab, Shift for a new window, Alt
 * to download — and a middle click never reaches `click` in the first place
 * but is excluded here anyway. Taking any of those would turn an enhancement
 * into a replacement: the visitor asked for the image in a tab and got an
 * overlay instead. The anchor's native behaviour is the default the island
 * must never be able to remove.
 *
 * `defaultPrevented` too, so that if anything upstream has already claimed the
 * click, the island does not claim it a second time.
 *
 * Enter on a focused anchor dispatches a click with `button === 0` and no
 * modifiers, so the keyboard path opens the lightbox exactly as the mouse does.
 */
export function isPlainClick(event: ClickLike): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/**
 * One step through the exhibition: the new index, or `null` when the step
 * would leave the strip.
 *
 * CLAMPED, never wrapped, matching the admin's screen sheet
 * (`app/admin/_components/screen-nav.tsx`), whose arrows go dead at either end
 * rather than jumping. A wrap turns "→ on the last screen" into "→ back to the
 * first", which on a strip of two reads as the arrow doing nothing at all.
 *
 * `null` rather than the unchanged index so the caller can tell a no-op from a
 * move — the same shape as `applyExhibitionOp` in lib/exhibition.ts.
 */
export function stepScreen(index: number, delta: number, count: number): number | null {
  const next = index + delta;
  if (!Number.isInteger(next) || next < 0 || next >= count) return null;
  return next;
}

/**
 * How far a finger has to travel sideways before a touch counts as a swipe.
 *
 * Swipe is the phone's arrow key, and the phone is the reason this lightbox
 * exists at all — a screen at strip size on a phone is small, and the visitor
 * there has no arrow keys. 48px is about a fingertip, so a tap that drifts is
 * still a tap.
 */
export const SWIPE_THRESHOLD = 48;

/**
 * A finished touch, as a step: -1 (swiped right, go back), 1 (swiped left, go
 * on), or 0 (not a swipe).
 *
 * Horizontal must DOMINATE, not merely clear the threshold: the lightbox can
 * scroll vertically on a short viewport, and a scroll with a little sideways
 * drift must stay a scroll.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
