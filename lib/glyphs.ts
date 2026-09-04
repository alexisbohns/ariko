/**
 * The vocabulary behind the admin tables' glyphs — the words, never the icons.
 *
 * The three tables (inbox, vault, garden) stopped spelling out `source.kind`,
 * `visibility` and `tier` and now draw them. A drawn value still has to say its
 * name somewhere: every glyph carries one of these labels in its tooltip and in
 * its accessible name, so this module is the single place a display form is
 * decided — the same rule `lib/plant-status.ts` and `lib/plant-role.ts` already
 * follow for their enums.
 *
 * Pure and icon-free on purpose: lucide routes every icon through a "use
 * client" module, and the icon MAP therefore lives beside the components in
 * `components/admin/glyphs.tsx`. Keeping the strings here is what lets them be
 * tested without rendering anything.
 */
import type { Visibility } from "./data";

/**
 * Two letters for an entity with no image — the avatar fallback everywhere a
 * plant, pod or seed source is drawn rather than named.
 *
 * Word-initials first ("Wait For The Sun" → "WF"), because that is what reads
 * as a monogram; a single word falls back to its own first two letters
 * ("pbbls" → "PB"), which is the case the garden is actually full of. Splits on
 * the separators slugs use as well as whitespace, so `initialsOf` gives the
 * same answer for a name and for its slug — `wait-for-the-sun` is "WF" too, and
 * an avatar does not change shape depending on which field reached it.
 *
 * Array.from, not slice: a name may open on an astral character, and half a
 * surrogate pair is not a letter.
 */
export function initialsOf(name: string): string {
  const words = name.split(/[\s._\-/–—]+/u).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length > 1
      ? words.slice(0, 2).map((w) => Array.from(w)[0] ?? "")
      : Array.from(words[0]).slice(0, 2);
  return letters.join("").toUpperCase() || "?";
}

/**
 * Display forms for the source kinds this repo actually issues or accepts.
 *
 * Deliberately NOT exhaustive, and `Source.kind` stays a free string:
 * `/api/inbox` takes whatever kind a token is scoped for, so a new sibling repo
 * can start posting before this table hears about it. An unknown kind keeps its
 * own raw value as its label (see `sourceLabel`) rather than being flattened
 * into "Other" — the point of the tooltip is to name the thing, and the raw
 * kind is a truer name than a guess.
 */
const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  github: "GitHub",
  changelog: "Changelog",
  pollen: "Pollen feed",
  arkaik: "Arkaik",
  api: "API",
};

export function sourceLabel(kind: string): string {
  return SOURCE_LABELS[kind] ?? (kind.trim() || "Unknown source");
}

const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Public",
  private: "Private",
};

export function visibilityLabel(visibility: Visibility): string {
  return VISIBILITY_LABELS[visibility];
}

export type Tier = "plant" | "pod";

const TIER_LABELS: Record<Tier, string> = {
  plant: "Plant",
  pod: "Pod",
};

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier];
}
