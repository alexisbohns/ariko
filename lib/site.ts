/**
 * What the app calls itself, in one place.
 *
 * Three consumers: `app/layout.tsx`'s `metadata` and `viewport` exports, and
 * `app/manifest.ts`. This is `READING_COLUMN`'s rule applied to a string — an
 * installed app whose window title disagrees with its page title is the version
 * of that drift nobody notices for a year, because only the author ever sees
 * both at once.
 */
export const SITE_NAME = "Ariko";

export const SITE_DESCRIPTION = "An atomic portfolio of creative and professional work.";

/**
 * `--background` written in the syntax the manifest format takes. The token is
 * `oklch(1 0 0)`; no manifest parser accepts oklch, so this is that colour, not
 * a second opinion about it. Light-only is honest: `.dark` is declared in
 * globals.css and nothing adds it.
 */
export const THEME_COLOR = "#ffffff";
