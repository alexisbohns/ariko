import { BEAN_PREFIX, PLANT_PREFIX, type TimelineEntry } from "./data";
import type { PollenDoc } from "./pollen-sync";

// Pure beanstalk builders (spec §4, §6): the timeline is the union of
// authored material and feed events; growth over time is the page's meaning.

export type BeanstalkEntry =
  | { type: "sprout"; date: string; entry: TimelineEntry }
  | { type: "pollen"; date: string; pollen: PollenDoc; url?: string; beanSlug?: string };

// The exhibition rule (spec §4) — all three must hold, checked in order:
// envelope privacy is binding fail-closed; the plant must be exhibited (the
// per-plant human act in data/federation.yml); the plant must survive
// filterPublic (a private plant exhibits nothing).
export function exhibitedPollen(
  pollen: PollenDoc[],
  exhibit: string[],
  publicPlantSlugs: Set<string>,
): PollenDoc[] {
  const ex = new Set(exhibit);
  return pollen.filter(
    (p) =>
      (p.visibility === undefined || p.visibility === "public") &&
      ex.has(p.anchors.plant) &&
      publicPlantSlugs.has(p.anchors.plant.slice(PLANT_PREFIX.length)),
  );
}

// Newest first by DATE PART (sprout dates are date-only, pollen `at` is a
// full timestamp — comparing raw strings would sort date-only lines older).
// Ties put authored material first; further ties keep input order (stable sort).
export function mergeBeanstalk(
  sprouts: TimelineEntry[],
  pollen: PollenDoc[],
  keptBeanSlugs: Set<string>,
): BeanstalkEntry[] {
  const entries: BeanstalkEntry[] = [
    ...sprouts.map((entry): BeanstalkEntry => ({ type: "sprout", date: entry.sprout.date.slice(0, 10), entry })),
    ...pollen.map((p): BeanstalkEntry => {
      const beanSlug = p.anchors.bean?.slice(BEAN_PREFIX.length);
      const url = (p.refs ?? []).find((r) => r.url)?.url;
      return {
        type: "pollen",
        date: p.at.slice(0, 10),
        pollen: p,
        ...(url ? { url } : {}),
        ...(beanSlug && keptBeanSlugs.has(beanSlug) ? { beanSlug } : {}),
      };
    }),
  ];
  const rank = (e: BeanstalkEntry) => (e.type === "sprout" ? 0 : 1);
  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : rank(a) - rank(b)));
}

// The plant a line belongs to, for the ?plant= filter — resolved plant for
// sprouts, the anchor for pollen.
export function plantSlugOf(e: BeanstalkEntry): string | null {
  return e.type === "sprout"
    ? (e.entry.plant?.slug ?? null)
    : e.pollen.anchors.plant.slice(PLANT_PREFIX.length);
}
