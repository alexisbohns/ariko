import type { Atom, Dataset, Domain, Version } from "./data";

export interface AtomDetailView {
  atom: Atom;
  domain: Domain | null;
  moleculeParents: string[]; // atom.parents entries with the "molecule:" prefix, as-is (incl. dangling)
  versions: Version[]; // newest-first (dataset.versionsForAtom is already sorted)
}

// Pure. Returns the admin view model for an atom, or null when the slug doesn't exist.
export function atomDetail(dataset: Dataset, slug: string): AtomDetailView | null {
  const atom = dataset.getAtom(slug);
  if (!atom) return null;
  return {
    atom,
    domain: dataset.domainForAtom(slug),
    moleculeParents: (atom.parents ?? []).filter((p) => p.startsWith("molecule:")),
    versions: dataset.versionsForAtom(slug),
  };
}
