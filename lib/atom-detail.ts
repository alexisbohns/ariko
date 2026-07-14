import { resolveText, type Atom, type Dataset, type Domain, type Version } from "./data";

export interface AtomDetailView {
  atom: Atom; // name resolved to a display string at build time (B1)
  domain: Domain | null;
  moleculeParents: string[]; // atom.parents entries with the "molecule:" prefix, as-is (incl. dangling)
  versions: Version[]; // newest-first (dataset.versionsForAtom is already sorted); name/description resolved at build time (B1)
}

// Pure. Returns the admin view model for an atom, or null when the slug doesn't
// exist. Localized name/description resolve to plain strings here (B1), so the
// page's scalar property dump keeps rendering them without Text handling.
export function atomDetail(dataset: Dataset, slug: string): AtomDetailView | null {
  const atom = dataset.getAtom(slug);
  if (!atom) return null;
  return {
    atom: { ...atom, name: resolveText(atom.name) },
    domain: dataset.domainForAtom(slug),
    moleculeParents: (atom.parents ?? []).filter((p) => p.startsWith("molecule:")),
    versions: dataset
      .versionsForAtom(slug)
      // Only resolve keys the doc actually has — materializing description: ""
      // would add a spurious empty row to the page's property dump.
      .map((v) => ({
        ...v,
        name: resolveText(v.name),
        ...(v.description != null ? { description: resolveText(v.description) } : {}),
      })),
  };
}
