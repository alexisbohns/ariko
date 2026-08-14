import { resolveText, type Bean, type Dataset, type Domain, type Sprout } from "./data";

export interface BeanDetailView {
  bean: Bean; // name resolved to a display string at build time (B1)
  domain: Domain | null;
  podParents: string[]; // bean.parents entries with the "pod:" prefix, as-is (incl. dangling)
  sprouts: Sprout[]; // newest-first (dataset.sproutsForBean is already sorted); name/description resolved at build time (B1)
}

// Pure. Returns the admin view model for a bean, or null when the slug doesn't
// exist. Localized name/description resolve to plain strings here (B1), so the
// page's scalar property dump keeps rendering them without Text handling.
export function beanDetail(dataset: Dataset, slug: string): BeanDetailView | null {
  const bean = dataset.getBean(slug);
  if (!bean) return null;
  return {
    bean: { ...bean, name: resolveText(bean.name) },
    domain: dataset.domainForBean(slug),
    podParents: (bean.parents ?? []).filter((p) => p.startsWith("pod:")),
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
