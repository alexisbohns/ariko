import type { Domain, TimelineEntry, VersionState } from "./data";

const STATES: VersionState[] = ["draft", "private", "published"];
const DOMAINS: Domain[] = ["music", "design", "podcast"];

export interface VaultFilters {
  state?: string;
  domain?: string;
  tag?: string;
}

// Pure. Applies the active filters to timeline entries. An unrecognized state or
// domain value is ignored (that dimension falls back to "all"); a blank tag is
// ignored, while a non-blank tag filters by membership (an unmatched tag → none).
export function filterVaultEntries(entries: TimelineEntry[], filters: VaultFilters): TimelineEntry[] {
  const state = STATES.includes(filters.state as VersionState) ? (filters.state as VersionState) : undefined;
  const domain = DOMAINS.includes(filters.domain as Domain) ? (filters.domain as Domain) : undefined;
  const tag = filters.tag && filters.tag.trim() ? filters.tag.trim() : undefined;

  return entries.filter((e) => {
    if (state && e.version.state !== state) return false;
    if (domain && e.domain !== domain) return false;
    if (tag && !(e.version.tags ?? []).includes(tag)) return false;
    return true;
  });
}

// Distinct tags across all entries, sorted — for the tag filter row.
export function distinctTags(entries: TimelineEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) for (const t of e.version.tags ?? []) set.add(t);
  return [...set].sort();
}
