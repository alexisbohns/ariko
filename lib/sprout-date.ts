/**
 * A sprout's date as a SHAPE — the sibling of `lib/sprout-state.ts`, which does
 * the same job for a value that happens to have a vocabulary.
 *
 * **This module is client-safe for `lib/sprout-state.ts`'s reason**: the date
 * editor lives in the sprout head, and a value import from `lib/data.ts` (which
 * opens with `node:fs`) would fail `npm run build` four modules downstream. It
 * imports nothing at all.
 *
 * THIS FILE IS WHERE THE DATE ARGUMENT LIVES. `setSproutDateAction` applies it
 * and `updateSproutDate` is protected by it; neither restates it. One fact told
 * in three files is three files that drift.
 */

/**
 * Whether a stored date is one the garden can put in order.
 *
 * Two sorters read it, and they do NOT agree about what they are reading:
 * `mergeBeanstalk` (`lib/beanstalk.ts`) compares `date.slice(0, 10)`, while
 * `byDateDesc` (`lib/data.ts`) compares the string RAW — and that one orders a
 * bean's sprouts, the whole timeline, and the cover `lib/graph.ts` derives from
 * the newest. Both are string comparisons; neither ever parses. So the
 * chronological order of the public site rests on stored dates all being the
 * same ten characters, and nothing else in the chain checks that:
 * `validateSproutInput` and the old `validateSproutPatch` both only ask whether
 * the string is non-empty, and `<input type="date">` is a client control a
 * server must not trust anyway. A `09/12/2026` reaches storage, sorts above
 * every `2…` line in the garden, and silently misfiles the sprout on the public
 * site with nothing failing anywhere.
 *
 * DATE-ONLY, anchored at both ends, which is stricter than `mergeBeanstalk`
 * alone would need. Three things decide it together: `byDateDesc` does not
 * slice, so a stored timestamp sorts against date-only strings as though it
 * were a later day; the two other doors that write a sprout-shaped date
 * (`lib/articles.ts`, `lib/synthesis.ts`) already enforce exactly this pattern,
 * and `lib/beanstalk.ts` and `lib/synthesis.ts` both record date-only as the
 * convention; and `<input type="date">` cannot display a time, so a timestamp
 * would round-trip to blank the next time an author opened the field. Accepting
 * one would have been tolerating a value nothing in the garden actually wants.
 *
 * Shape only: `2026-13-45` passes and is not a day. That is deliberate — the
 * invariant being protected is the SORT, and a nonsense month sorts perfectly
 * well. Nothing parses a stored sprout date (the only `new Date(` on this path
 * is in the pollen and synthesis windows, which never see one), so a calendar
 * check would be guarding against a failure that cannot happen here. It belongs
 * wherever a calendar is what matters.
 *
 * The guard runs on WRITE only. Tightening it can never make stored data
 * unreadable — at worst an author re-enters a date the old path let through.
 */
export function isTimelineDate(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw);
}
