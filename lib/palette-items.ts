import { NAV_ITEMS } from "./admin-nav";

/**
 * The half of the palette model the BROWSER is allowed to have.
 *
 * This is a real boundary, not tidiness: lib/data.ts opens with
 * `import { readFileSync } from "node:fs"`, so anything importing it is
 * server-only, and lib/palette.ts — which needs `resolveText` and the ref
 * prefixes — is therefore server-only too. The palette component is a client
 * component. Without this split, importing the index builder from the browser
 * drags `node:fs` into the bundle and the build fails outright.
 *
 * So: the row type, the group order, the four sections, and the grouping —
 * all of which the client needs and none of which touches the garden — live
 * here. lib/palette.ts imports this file and adds the part that reads Mongo.
 */

export type PaletteKind = "section" | "plant" | "pod" | "bean" | "sprout" | "seed";

export interface PaletteItem {
  /** Unique across kinds — the ref grammar where there is one, so two things
   *  that share a slug across tiers never collide. */
  id: string;
  kind: PaletteKind;
  /** Already resolved out of `Text` by the server. */
  label: string;
  /** The containing thing's name, where there is one; a note snippet for a seed. */
  sublabel?: string;
  href: string;
  /** The group heading. Order is fixed by GROUPS, not by the client. */
  group: string;
}

/** The group headings, in the order the palette renders them. */
export const GROUPS = ["Go to", "Garden", "Vault", "Inbox"] as const;

/**
 * The "Go to" rows — the four sections, built from the rail's own model rather
 * than re-typed, so a fifth section appears in both places or in neither.
 *
 * Called by `buildPaletteIndex` on the server AND used directly by the palette
 * as its starting index, which is the same function in both places by design:
 * it is what makes the palette impossible to open onto nothing. It touches no
 * garden and no network, so it cannot fail.
 */
export function sectionItems(): PaletteItem[] {
  return NAV_ITEMS.map((nav) => ({
    id: `section:${nav.href}`,
    kind: "section" as const,
    label: nav.label,
    href: nav.href,
    group: "Go to",
  }));
}

/** Group a flat index for rendering, dropping empty groups and preserving
 *  GROUPS order. The shape Base UI's Autocomplete wants for grouped items:
 *  an array of `{ value, items }`. */
export function groupPaletteItems(
  items: PaletteItem[],
): Array<{ value: string; items: PaletteItem[] }> {
  return GROUPS.map((value) => ({ value, items: items.filter((i) => i.group === value) })).filter(
    (g) => g.items.length > 0,
  );
}
