/**
 * A sprout's type as a SHAPE — the sibling of `lib/sprout-date.ts`, which does
 * the same job for the other free-form field on the sprout's head.
 *
 * **This module is client-safe for `lib/sprout-state.ts`'s reason**: the type
 * editor lives in the sprout head, and a value import from `lib/data.ts` (which
 * opens with `node:fs`) would fail `npm run build` four modules downstream. It
 * imports nothing at all.
 *
 * THIS FILE IS WHERE THE TYPE ARGUMENT LIVES. `setSproutTypeAction` applies it
 * and `updateSproutType` is protected by it; neither restates it. One fact told
 * in three files is three files that drift.
 */

/**
 * Whether a stored type is one the garden can render and compare.
 *
 * NOT a vocabulary, and deliberately not one: nothing in the garden validates a
 * sprout's type against a list, because there isn't one — `lib/sprouts.ts`
 * filters by state, plant and tag and never by type, and the seed-promotion
 * path writes whatever the source carried. This is the other kind of rule, the
 * one `lib/sprout-date.ts` makes for the date: a shape every stored value must
 * have, whatever the word inside it turns out to be.
 *
 * Two things read a type, and they want different halves of it. It is RENDERED
 * raw — a `<Badge>` on the public beanstalk, a `<span>` on the admin one, the
 * `type` on every sprout node `lib/graph.ts` hands to `/api/graph` — so a blank
 * one is an empty badge and a typeless node, the same silent bad output
 * `setSproutDateAction` rejects a blank date to avoid. And it is COMPARED with
 * `===` against a literal, in three places that decide something: the digest
 * exemption in `shouldCascadePublish` (`type !== DIGEST_TYPE`), the digest skip
 * in `lib/synthesis.ts`, and the milestone match in `lib/pbbls-legacy.ts`. None
 * of the three trims.
 *
 * That second half is why surrounding whitespace is rejected rather than
 * quietly tolerated, and it is the sharper of the two reasons. `"digest "`
 * draws identically to `"digest"` in every badge that renders it and matches
 * `DIGEST_TYPE` in none of the three comparisons — so a digest stored with one
 * stray space is not exempt, and publishing it flips the curated private bean
 * and plant public, which is the exact act the exemption exists to prevent.
 * Nothing would look wrong anywhere.
 *
 * The action trims before asking, so this guard normally sees an already-clean
 * string. Rejecting the untrimmed form is what makes that `.trim()` a
 * convenience rather than the only thing standing between a pasted type and a
 * literal it silently fails to equal.
 *
 * The guard runs on WRITE only, `lib/sprout-date.ts`'s closing caveat and for
 * its reason: tightening it can never make stored data unreadable — at worst an
 * author re-enters a type the old path let through.
 */
export function isSproutType(raw: string): boolean {
  return raw.length > 0 && raw.trim() === raw;
}
