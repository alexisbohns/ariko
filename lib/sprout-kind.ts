/**
 * A sprout's kind as a VOCABULARY — the closed list the journal model gives the
 * field that used to be the free string `type` (spec 2026-10-10 §1.2).
 *
 * **Client-safe, and imports nothing**, for `lib/sprout-state.ts`'s reason: the
 * kind popover lives in `app/admin/_components/sprout-hero.tsx`, a client
 * island, and a value import from `lib/data.ts` (which opens with `node:fs`)
 * would fail `npm run build` four modules downstream. `lib/data.ts` imports the
 * TYPE from here, never the other way round.
 *
 * The WORDS are in `lib/glyphs.ts` (`sproutKindLabel`) and the ICONS in
 * `components/admin/glyphs.tsx` (`SPROUT_KIND_ICONS`), the split every admin
 * enum makes. Sub-species — retrospective, learning, experiment — are TAGS, not
 * members: the vocabulary names what an entry IS, tags name what it is about.
 */
export const SPROUT_KINDS = ["log", "milestone", "release", "essay", "decision", "digest"] as const;
export type SproutKind = (typeof SPROUT_KINDS)[number];

/** A dated note on work done — what an entry is unless it says otherwise. */
export const DEFAULT_KIND: SproutKind = "log";
/** The machine-written weekly wrap. The one member with behaviour: publishing a
 *  digest marks review sign-off, not exhibition, so it is exempt from the
 *  publish cascade (`shouldCascadePublish`) and `bucketWeek` never narrates one. */
export const DIGEST_KIND: SproutKind = "digest";

export function isSproutKind(raw: string): raw is SproutKind {
  return (SPROUT_KINDS as readonly string[]).includes(raw);
}

/**
 * A lab note's `suggested.type` (feature | improvement | fix | announcement —
 * the Lab Note wire contract, unchanged) onto the vocabulary. A hint for the
 * triage form's default radio, never a commitment; a value that already names a
 * kind passes through, anything unknown is a log.
 */
export function kindForSuggestion(type: string | undefined): SproutKind {
  if (type !== undefined && isSproutKind(type)) return type;
  switch (type) {
    case "feature":
    case "improvement":
      return "milestone";
    case "announcement":
      return "release";
    default:
      return DEFAULT_KIND;
  }
}
