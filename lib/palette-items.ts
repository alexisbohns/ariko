import { NAV_ITEMS, type NavId } from "./admin-nav";

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
 * So: the row type, the group order, the sections, and the grouping —
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
  /** A stored logo, for the kinds drawn as a mark rather than an icon (plants).
   *  Absent ⇒ `EntityAvatar` falls back to the initials, so a plant always has
   *  a mark and the row gutter never goes ragged. */
  logoUrl?: string;
  href: string;
  /** The group heading. Order is fixed by GROUPS, not by the client. */
  group: string;
}

/** The group headings, in the order the palette renders them. */
export const GROUPS = ["Go to", "Plants", "Pods", "Beans", "Sprouts", "Inbox"] as const;

/** A section row's id is this prefix plus its `NavId` — the one place that
 *  grammar is spelled, so `sectionItems()` and the palette's `iconFor` (which
 *  strips the prefix back off to look the icon up) cannot drift apart. */
export const SECTION_ID_PREFIX = "section:";

/**
 * The "Go to" rows — the sections, built from the rail's own model rather
 * than re-typed, so a new section appears in both places or in neither. The
 * UNSCOPED rail: the palette is a navigator, and Overview is a destination
 * that only means something relative to a scope the palette does not have.
 *
 * Called by `buildPaletteIndex` on the server AND used directly by the palette
 * as its starting index, which is the same function in both places by design:
 * it is what makes the palette impossible to open onto nothing. It touches no
 * garden and no network, so it cannot fail.
 */
export function sectionItems(): PaletteItem[] {
  return NAV_ITEMS.map((nav) => ({
    id: `${SECTION_ID_PREFIX}${nav.id}`,
    kind: "section" as const,
    label: nav.label,
    href: nav.href,
    group: "Go to",
  }));
}

/**
 * The other half of the id grammar `sectionItems()` writes: the `NavId` a
 * section row's id names, or null when the id was never one of these in the
 * first place. `iconFor` (command-palette.tsx) needs this rather than its own
 * `slice` + cast — an unchecked cast over a plain `string` is exactly the kind
 * of thing that slices garbage out of a malformed id and silently falls
 * through to the generic icon, which is the same "two sections draw the same
 * picture" bug `lib/section-icons.test.ts` exists to catch, arriving by the
 * one path that test cannot see.
 */
export function sectionNavId(item: PaletteItem): NavId | null {
  if (item.kind !== "section" || !item.id.startsWith(SECTION_ID_PREFIX)) return null;
  return item.id.slice(SECTION_ID_PREFIX.length) as NavId;
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
