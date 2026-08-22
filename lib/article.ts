import { resolveText, type Sprout } from "./data";

// Pure (spec §4). Given sprouts in the newest-first order the dataset already
// guarantees (stable byDateDesc), returns the first one carrying non-blank
// content — or null when none does, which is every bean in the garden today.
//
// State is NOT re-checked here: the public page passes the filterPublic-projected
// dataset, so "published" is already enforced upstream. One projection, one place.
export function articleFor(sprouts: Sprout[]): Sprout | null {
  return sprouts.find((s) => resolveText(s.content ?? "").trim() !== "") ?? null;
}
