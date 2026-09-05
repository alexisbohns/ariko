import type { Plant, Visibility } from "./data";

/**
 * A plant's visibility as a vocabulary — the sibling of `lib/plant-status.ts`,
 * written when the plant page grew a one-click privacy toggle.
 *
 * The WORDS are not here: `visibilityLabel` already lives in `lib/glyphs.ts`,
 * which is the one place a display form is decided for the value the admin
 * tables draw. This module owns the members, the default and the flip, so a
 * toggle never has to spell `visibility === "public" ? "private" : "public"`
 * inline — the expression that is easiest to get backwards.
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

/** The other one. A toggle posts the RESULT of this, never a bare "flip it". */
export function nextVisibility(visibility: Visibility): Visibility {
  return visibility === "public" ? "private" : "public";
}

export class InvalidVisibilityError extends Error {
  constructor(public received: string) {
    super(`unknown visibility: ${received || "(blank)"}`);
    this.name = "InvalidVisibilityError";
  }
}
