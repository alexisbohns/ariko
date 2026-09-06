/**
 * The measure — one decision, both zones.
 *
 * The public zone read at `max-w-3xl px-6`: a 720px content box, centred. The
 * admin read at `max-w-5xl pl-20 pr-36`: an 800px box, and — because the
 * clearance for its fixed chrome was subtracted from INSIDE the max-width —
 * sitting left of centre. So the author wrote in one column and the visitor
 * read in another, narrower one, offset from it. Every judgement about line
 * length, about where an image lands, about whether a heading breaks, was made
 * against the wrong box.
 *
 * These two strings are what fixes that. Both zones render the same one on a
 * reading page, so on any screen wide enough the content box is the same width
 * in the same place. That is the whole of "pure WYSIWYG"; there is nothing else
 * to it.
 *
 * A plain string rather than a component, for `chrome-plate.ts`'s reason: the
 * callers differ in what they wrap and in their vertical rhythm, and wrapping
 * them in a shared element would mean threading that through as props to save
 * one `className` each.
 */

/** Prose, in both zones: 768px minus a 24px gutter each side. */
export const READING_COLUMN = "mx-auto w-full max-w-3xl px-6";

/**
 * The four admin section indexes, which are tables rather than documents.
 * `lib/admin-nav.ts` decides which routes those are — and derives it from
 * NAV_ITEMS rather than from a second list that could drift.
 */
export const WIDE_COLUMN = "mx-auto w-full max-w-5xl px-6";

/**
 * Horizontal room for a vertically centred rail. **Admin only.**
 *
 * The arithmetic, recorded rather than nudged: a rail is one `size-9` icon
 * (36px) inside the plate's `p-1.5` (12px) plus its 1px border — 50px — offset
 * `left-4`, so it ends at x = 66. `px-20` (80px) clears it with 14px to spare,
 * on both sides, which is what keeps the column centred.
 *
 * The public zone takes none of this, and the asymmetry is honest rather than an
 * oversight: its chrome is two clusters at the TOP, cleared by `pt-24` like any
 * other, and `TocRail` is `xl:block` only and lives in the gutter a centred
 * 768px column already leaves. The two zones' clearances differ because their
 * chromes differ. What is identical is the measure inside them.
 *
 * Vertical clearance is `pt-24` in both zones and is not a constant here, since
 * each zone pairs it with its own bottom rhythm. 96px clears a cluster —
 * `size-9` inside `p-1.5` at `top-4` occupies y ∈ [16, 64] — with 32px to
 * spare, and unlike the `pr-36` it replaces it does not depend on how many
 * buttons that cluster holds.
 */
export const RAIL_CLEARANCE = "px-20";
