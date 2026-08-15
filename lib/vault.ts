import { resolveText, type TimelineEntry, type SproutState } from "./data";

const STATES: SproutState[] = ["draft", "private", "published"];

export interface VaultFilters {
  state?: string;
  plant?: string;
  tag?: string;
}

// Pure. Applies the active filters to timeline entries. An unrecognized state
// is ignored (falls back to "all"); plant and tag filter like membership — a
// blank value is ignored, a non-blank unknown value matches nothing (there is
// no plant enum to validate against). Surviving rows carry their sprout name
// resolved to a display string (B1).
export function filterVaultEntries(entries: TimelineEntry[], filters: VaultFilters): TimelineEntry[] {
  const state = STATES.includes(filters.state as SproutState) ? (filters.state as SproutState) : undefined;
  const plant = filters.plant && filters.plant.trim() ? filters.plant.trim() : undefined;
  const tag = filters.tag && filters.tag.trim() ? filters.tag.trim() : undefined;

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
