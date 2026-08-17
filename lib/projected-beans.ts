import { BEAN_PREFIX, type Bean } from "./data";
import type { Pollen } from "./pollen";

// Pure derivation of projected beans (spec §5): envelopes carrying a bean
// anchor whose slug does not exist yet materialize a read-only, rebuildable
// bean. Authored-or-prior always wins (the caller passes every existing slug);
// visibility derives from the exhibition list at projection time, so a rebuild
// after flipping the list re-derives consistently. Pods are NOT projected in
// v1 — a dangling pod anchor is the reader's problem, ignored fail-closed.
export function deriveProjectedBeans(
  envelopes: Pollen[],
  existingBeanSlugs: Set<string>,
  exhibit: Set<string>, // "plant:<slug>" refs
  feedId: string,
): Bean[] {
  const out: Bean[] = [];
  const claimed = new Set<string>();
  for (const p of envelopes) {
    if (!p.anchors.bean) continue;
    const slug = p.anchors.bean.slice(BEAN_PREFIX.length);
    if (existingBeanSlugs.has(slug) || claimed.has(slug)) continue;
    claimed.add(slug);
    out.push({
      slug,
      name: slug,
      parents: [p.anchors.plant, ...(p.anchors.pod ? [p.anchors.pod] : [])],
      visibility: exhibit.has(p.anchors.plant) ? "public" : "private",
      projected: { source: p.source, feedId, firstPollenId: p.id },
    });
  }
  return out;
}
