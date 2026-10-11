import { BEAN_PREFIX, PLANT_PREFIX, type Sprout, type TimelineEntry } from "./data";
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

// The public address of a sprout, spelled ONCE. `lib/lineage.ts`'s PUBLIC_HREFS
// stops at the bean because a sprout is never a container; the journal lines
// and the sprout page's own doors read this instead.
export function publicSproutHref(slug: string): string {
  return `/sprout/${encodeURIComponent(slug)}`;
}

// The beanstalk lines for a page's OWN sprouts — a plant's, a pod's, a bean's —
// in the timeline's newest-first order. A pod or bean journal is therefore the
// beanstalk narrowed, drawn by the same component, rather than a second
// rendering of a `Sprout[]` that would drift from the first. A plant journal is
// the same narrowing plus the plant's exhibited pollen: the caller hands over
// what `exhibitedPollen` admitted and the kept-bean set its doors may name, and
// the merge is `mergeBeanstalk`'s, so the order and the bean doors are the
// beanstalk's own. The defaults are a pod's and a bean's: no pollen, no doors.
export function entriesAbout(
  timeline: TimelineEntry[],
  sprouts: Sprout[],
  pollen: PollenDoc[] = [],
  keptBeanSlugs: Set<string> = new Set(),
): BeanstalkEntry[] {
  const keep = new Set(sprouts.map((s) => s.slug));
  return mergeBeanstalk(
    timeline.filter((e) => keep.has(e.sprout.slug)),
    pollen,
    keptBeanSlugs,
  );
}
