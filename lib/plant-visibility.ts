import type { Bean, Plant, Visibility } from "./data";

/**
 * A plant's visibility as a vocabulary — the sibling of `lib/plant-status.ts`,
 * written when the plant page grew a privacy control of its own.
 *
 * The WORDS are not here: `visibilityLabel` already lives in `lib/glyphs.ts`,
 * which is the one place a display form is decided for the value the admin
 * tables draw. This module owns the members and the default, and deliberately
 * nothing else — the plant header renders the members as a LIST and posts the
 * one the author picked, so nothing anywhere needs "the other one".
 */
export const PLANT_VISIBILITIES: readonly Visibility[] = ["public", "private"];

/**
 * The one place absence becomes a value, exactly as `statusOf` is for status.
 * `visibility` is optional on both `Plant` and `Bean` and "absent ⇒ public"
 * (lib/data.ts), the same rule `filterPublic` reads with `!== "private"`.
 *
 * Widened to the bean when the bean's head grew a visibility control. A
 * `lib/bean-visibility.ts` twin would have been a second copy of one rule, and a
 * copy of a default is a copy that drifts. `PLANT_VISIBILITIES` keeps its name:
 * the vocabulary is the same two members either way, and renaming the constant
 * would move every plant call site for no gain.
 */
export function visibilityOf(entity: Pick<Bean | Plant, "visibility">): Visibility {
  return entity.visibility ?? "public";
}

export function isVisibility(raw: string): raw is Visibility {
  return (PLANT_VISIBILITIES as readonly string[]).includes(raw);
}
