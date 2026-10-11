import { DIGEST_KIND, type SproutKind } from "./sprout-kind";

/**
 * Pure gate for the publish cascade (final review C1, re-keyed by the journal
 * model). Digest publication marks review sign-off, not public exhibition: the
 * digest beans and plants are curated private containers, and flipping them
 * public is a separate human act on the plant itself. Every other kind makes
 * its plant public on publish (spec 2026-10-10 §2).
 */
export function shouldCascadePublish(kind: SproutKind): boolean {
  return kind !== DIGEST_KIND;
}
