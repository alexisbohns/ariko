/**
 * A sprout's date as a SHAPE — the sibling of `lib/sprout-state.ts`, which does
 * the same job for a value that happens to have a vocabulary.
 *
 * **This module is client-safe for `lib/sprout-state.ts`'s reason**: the date
 * editor lives in the sprout head, and a value import from `lib/data.ts` (which
 * opens with `node:fs`) would fail `npm run build` four modules downstream. It
 * imports nothing at all.
 */

/**
 * Whether a stored date is one the public timeline can put in order.
 *
 * `mergeBeanstalk` (`lib/beanstalk.ts`) builds every Beanstalk line as
 * `entry.sprout.date.slice(0, 10)` and then sorts those strings against each
 * other. So the chronological order of the whole public Beanstalk — authored
 * sprouts and feed events interleaved — is the order of a sprout date's first
 * ten characters, and nothing else in the chain ever looks at them:
 * `validateSproutInput` and the old `validateSproutPatch` both only ask whether
 * the string is non-empty, and `<input type="date">` is a client control a
 * server must not trust anyway. A `09/12/2026` therefore reaches storage,
 * slices to `09/12/2026`, sorts above every `2…` line in the garden, and
 * silently misfiles the sprout on the public site with nothing failing
 * anywhere.
 *
 * A longer ISO timestamp passes. `lib/beanstalk.ts` records sprout dates as
 * date-only and pollen's `at` as a full timestamp, and slices BOTH so the two
 * compare — nothing enforces the date-only half, so a sprout date carrying a
 * time sorts correctly and is accepted here. The ten characters must be
 * followed by a separator or by nothing, which is what keeps a `2026-09-1234`
 * from slicing down to a day it never meant.
 *
 * Shape only: `2026-13-45` passes and is not a day. That is deliberate — the
 * invariant being protected is the SORT, and a nonsense month sorts perfectly
 * well. A calendar check belongs wherever a calendar is what matters.
 */
export function isTimelineDate(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(raw);
}
