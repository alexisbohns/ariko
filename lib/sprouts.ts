import { filterValue } from "./admin-filters";
import { resolveText, type TimelineEntry, type SproutState } from "./data";

const STATES: SproutState[] = ["draft", "private", "published"];

export interface SproutFilters {
  state?: string;
  plant?: string;
  tag?: string;
}

/**
 * The section's dimensions, named for `filterHref` — the list that decides
 * which keys a filter URL may carry.
 *
 * Re-exported rather than declared: it lived in the page while the page was
 * the only caller, then here when the scope rule became the second, and it now
 * lives in `lib/section-keys.ts` because the scope CONTROL is a client
 * component and this file imports `lib/data.ts`. Kept exported from here so
 * the page that reads it still finds it where it has always looked.
 */
export { SPROUT_KEYS } from "./section-keys";

// Pure. Applies the active filters to timeline entries. An unrecognized state
// is ignored (falls back to "all"); plant and tag filter like membership — a
// blank value is ignored, a non-blank unknown value matches nothing (there is
// no plant enum to validate against). Surviving rows carry their sprout name
// resolved to a display string (B1).
//
// `filterValue` rather than a local trim, so "all" — the sentinel every filter
// control in the admin writes for "no filter" — is absence HERE too. This file
// used to compare it raw, which made `?plant=all` an empty table under a
// trigger reading "All"; see that function's docblock.
export function filterSproutEntries(entries: TimelineEntry[], filters: SproutFilters): TimelineEntry[] {
  const state = STATES.includes(filters.state as SproutState) ? (filters.state as SproutState) : undefined;
  const plant = filterValue(filters.plant);
  const tag = filterValue(filters.tag);

  return entries
    .filter((e) => {
      if (state && e.sprout.state !== state) return false;
      if (plant && e.plant?.slug !== plant) return false;
      if (tag && !(e.sprout.tags ?? []).includes(tag)) return false;
      return true;
    })
    .map((e) => ({ ...e, sprout: { ...e.sprout, name: resolveText(e.sprout.name) } }));
}

// Distinct plant slugs across all entries, sorted — for the plant filter row.
export function distinctPlants(entries: TimelineEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) if (e.plant) set.add(e.plant.slug);
  return [...set].sort();
}

// Distinct tags across all entries, sorted — for the tag filter row.
export function distinctTags(entries: TimelineEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) for (const t of e.sprout.tags ?? []) set.add(t);
  return [...set].sort();
}
