import type { MediaImage } from "./data";

/**
 * The exhibition's arithmetic — everything the gallery decides that is not a
 * render or a write.
 *
 * NO VALUE IMPORTS, and that is load-bearing rather than tidy: `lib/data.ts`
 * imports `exhibitionOrder` below, so a value import back out of this file
 * would be a runtime cycle. The one `import type` above is erased at build and
 * is not one. This module works on slugs and on structural `{ slug, order? }`
 * shapes, never on a `Screen`, which is what keeps that true — and what lets
 * the admin (reading the raw garden) and the public page (reading a filtered
 * Dataset) share it.
 */

/** The four buttons a row can carry. A NAMED vocabulary, re-validated by the
 *  action rather than trusted, which is `lib/plant-status.ts`'s stance and for
 *  its reason: a stale page can then only ever name a member that exists. */
export const EXHIBITION_OPS = ["add", "remove", "up", "down"] as const;
export type ExhibitionOp = (typeof EXHIBITION_OPS)[number];

export function exhibitionOpOf(raw: string): ExhibitionOp | null {
  return (EXHIBITION_OPS as readonly string[]).includes(raw) ? (raw as ExhibitionOp) : null;
}

/** The least a thing needs to have a place in the strip. `Screen` satisfies it
 *  structurally, so no caller ever converts. */
export interface ExhibitionEntry {
  slug: string;
  order?: number;
  /** The editorial opt-in. Read by `exhibitionOf` and by nothing else here —
   *  the other three functions are handed a strip that has already been
   *  narrowed. */
  exhibited?: boolean;
}

/**
 * The strip's order: `order` ascending, an entry WITHOUT one last, slug as the
 * tie-break.
 *
 * Last, not first, and not dropped. An exhibited screen with no sort key can
 * only arrive by a hand-edit or a half-finished write, and the author's opt-in
 * is the thing to honour — so a missing key costs position and never presence.
 * `(a.order ?? 0)` would silently put it at the head of the strip instead.
 *
 * Plain `<` on the slug rather than `localeCompare`, matching `byDateDesc` in
 * lib/data.ts and the sorts in lib/screens.ts: slugs are ASCII kebab-case, and
 * one collation across the repo is what makes two surfaces agree.
 *
 * `Number.isFinite` rather than `typeof ... === "number"`, because
 * `typeof NaN === "number"` too — and a `NaN` order arrives by the same route
 * as a missing one (a hand-edit, a half-finished write). This folds it into
 * the same sorts-last bucket rather than handing `ao - bo` a `NaN` and letting
 * the sort's behaviour become implementation-defined, while still admitting
 * fractional and negative orders.
 */
export function exhibitionOrder(a: ExhibitionEntry, b: ExhibitionEntry): number {
  const ao = Number.isFinite(a.order) ? (a.order as number) : Number.MAX_SAFE_INTEGER;
  const bo = Number.isFinite(b.order) ? (b.order as number) : Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * The strip, out of a plant's screens: the exhibited ones, in order.
 *
 * A function rather than a `.filter().sort()` at each call site, and the reason
 * is `exhibitionWrites` below. That function's first argument must be the
 * exhibited entries AND NOTHING ELSE, because its `withdraw` half is a set
 * difference and withdrawal re-privatizes — so a caller that passed a plant's
 * whole screen list would make every unexhibited screen private on one press
 * of an arrow, silently. Naming the narrowing once is what keeps that from
 * being a rule two callers have to remember.
 *
 * Generic, so a caller keeps whatever else its rows carry (a resolved name, an
 * image) rather than being narrowed to `ExhibitionEntry`.
 *
 * `.filter()` already returns a new array, so the `.sort()` after it is sorting
 * a copy — the input is never reordered under its owner.
 */
export function exhibitionOf<T extends ExhibitionEntry>(screens: T[]): T[] {
  return screens.filter((screen) => screen.exhibited === true).sort(exhibitionOrder);
}

/**
 * Pure. One button press → the new ordered strip, or `null` for a no-op.
 *
 * `null` is the whole of the dirty gate. `up` at the head, `down` at the tail,
 * `add` for a screen already exhibited, and anything but `add` for a slug that
 * is not in the strip all mean "the author pressed something that changes
 * nothing" — and a no-op that returned the list unchanged would still write
 * every document in it.
 *
 * The input list is never mutated; the swap works on a copy.
 */
export function applyExhibitionOp(
  ordered: string[],
  slug: string,
  op: ExhibitionOp,
): string[] | null {
  const at = ordered.indexOf(slug);

  if (op === "add") return at === -1 ? [...ordered, slug] : null;
  if (at === -1) return null;
  if (op === "remove") return ordered.filter((s) => s !== slug);

  const to = op === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= ordered.length) return null;

  const next = [...ordered];
  next[at] = ordered[to];
  next[to] = ordered[at];
  return next;
}

export interface ExhibitionWrites {
  /** Screens to exhibit at a position — see lib/botanical.ts for the lockstep
   *  this half performs on `visibility`. */
  promote: { slug: string; order: number }[];
  /** Screens leaving the strip — and leaving costs `visibility` too, not just
   *  the two gallery fields. See `writeExhibition`. */
  withdraw: string[];
}

/**
 * Pure. The two lists of documents a press actually has to touch.
 *
 * `exhibited` carries the STORED order rather than bare slugs, and that is the
 * detail worth reading twice: a screen exhibited with no `order` at all sits at
 * some index in `exhibited`, and a diff that compared index-to-index would
 * decide it had not moved and never write it a sort key — so it would sort
 * last forever, however often the author pressed ↑. Comparing the stored value
 * against the new index is what closes that.
 *
 * A swap therefore writes two documents and not the whole strip.
 *
 * THE FIRST ARGUMENT IS THE EXHIBITED ENTRIES AND NOTHING ELSE — use
 * `exhibitionOf` to build it. `withdraw` below is a set difference, and
 * withdrawal is not free: `writeExhibition` sets `visibility: "private"` and
 * unsets both fields. Hand this a plant's whole screen list and every
 * unexhibited screen it owns is re-privatized by one press of an arrow, with
 * nothing on the page to say so.
 *
 * It is also what makes `promote` the carrier of `exhibited: true` rather than
 * of `order` alone: a screen absent from this list maps to `undefined`, which
 * differs from every index, so an addition is always written.
 */
export function exhibitionWrites(
  exhibited: ExhibitionEntry[],
  after: string[],
): ExhibitionWrites {
  const stored = new Map(exhibited.map((entry) => [entry.slug, entry.order]));
  const kept = new Set(after);

  return {
    promote: after
      .map((slug, order) => ({ slug, order }))
      .filter(({ slug, order }) => stored.get(slug) !== order),
    withdraw: exhibited.map((entry) => entry.slug).filter((slug) => !kept.has(slug)),
  };
}

/**
 * One screen as the strip draws it — the two `Text`s already resolved.
 *
 * Resolved by the PAGE rather than here, which is what keeps
 * `components/screen-strip.tsx` isomorphic instead of merely server-safe:
 * `resolveText` lives in lib/data.ts, which opens with `node:fs`, and a strip
 * that reached for it would be in the awkward state `components/bean-cover.tsx`
 * spends a paragraph explaining. It is also what lets PR 2's client island
 * share this type with a plain `import type`.
 */
export interface ExhibitionRow {
  slug: string;
  name: string;
  legend: string;
  image: MediaImage;
}
