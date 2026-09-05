import type { Plant, Visibility } from "./data";

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
 * `Plant.visibility` is optional and "absent ⇒ public" (lib/data.ts), the same
 * rule `filterPublic` reads with `!== "private"`.
 */
export function visibilityOf(plant: Pick<Plant, "visibility">): Visibility {
  return plant.visibility ?? "public";
}

export function isVisibility(raw: string): raw is Visibility {
  return (PLANT_VISIBILITIES as readonly string[]).includes(raw);
}
