import { resolveText, type Atom, type Dataset, type Domain, type Version } from "./data";

export interface AtomDetailView {
  bean: Atom; // name resolved to a display string at build time (B1)
  domain: Domain | null;
  moleculeParents: string[]; // atom.parents entries with the "pod:" prefix, as-is (incl. dangling)
  sprouts: Version[]; // newest-first (dataset.sproutsForBean is already sorted); name/description resolved at build time (B1)
}

// Pure. Returns the admin view model for an atom, or null when the slug doesn't
// exist. Localized name/description resolve to plain strings here (B1), so the
// page's scalar property dump keeps rendering them without Text handling.
export function atomDetail(dataset: Dataset, slug: string): AtomDetailView | null {
  const atom = dataset.getBean(slug);
  if (!atom) return null;
  return {
    bean: { ...atom, name: resolveText(atom.name) },
    domain: dataset.domainForBean(slug),
    moleculeParents: (atom.parents ?? []).filter((p) => p.startsWith("pod:")),
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
