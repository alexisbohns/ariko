import { DIGEST_TYPE } from "./synthesis";

/**
 * Pure gate for the publish→visibility cascade (final review C1). Digest
 * publication (spec §3) marks review sign-off, not public exhibition: the
 * digest beans/plants are curated private containers, and flipping them public
 * is a separate human act on the bean/plant itself. Every other sprout type
 * keeps cascading on publish.
 *
 * All that is left of this module. It used to carry `SproutPatch`,
 * `buildSproutPatch` and `validateSproutPatch` — the seam under
 * `editVersionAction`, which wrote a sprout's seven editable fields from one
 * form. The sprout's head put each field behind its own surface, so the patch
 * that carried all seven has no form to come from; `lib/sprout-meta.ts` is the
 * seam for the two that are still edited together, and the other three are
 * validated at their own one-field actions.
 */
export function shouldCascadePublish(type: string): boolean {
  return type !== DIGEST_TYPE;
}
