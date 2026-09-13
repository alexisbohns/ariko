import { resolveText, type Bean, type Dataset, type Sprout } from "./data";

export interface BeanDetailView {
  bean: Bean; // name resolved to a display string at build time (B1)
  plant: string | null; // resolved plant slug (direct parent wins, then via pod)
  sprouts: Sprout[]; // newest-first (dataset.sproutsForBean is already sorted); name/description resolved at build time (B1)
}

// Pure. Returns the admin view model for a bean, or null when the slug doesn't
// exist. Localized name/description resolve to plain strings here (B1), which is
// what `SproutTable` wants and what a FORM must not have: the bean page reads
// the stored bean straight from the garden for every write surface, because an
// fr-only name resolved to a display string would prefill the en box and save
// back as en. `podParents` left with the property dump that was its only reader
// — the lineage chrome above the page has said the same thing since the
// parenting slice, and it reads `bean.parents` itself.
export function beanDetail(dataset: Dataset, slug: string): BeanDetailView | null {
  const bean = dataset.getBean(slug);
  if (!bean) return null;
  return {
    bean: { ...bean, name: resolveText(bean.name) },
    plant: dataset.plantForBean(slug)?.slug ?? null,
    sprouts: dataset
      .sproutsForBean(slug)
      // Only resolve keys the doc actually has — materializing description: ""
      // would add a spurious empty row to the page's property dump.
      .map((v) => ({
        ...v,
        name: resolveText(v.name),
        ...(v.description != null ? { description: resolveText(v.description) } : {}),
      })),
  };
}
