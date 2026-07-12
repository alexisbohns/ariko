import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export type Domain = "music" | "design" | "podcast";

export interface Molecule {
  slug: string;
  name: string;
  domain: Domain;
  description: string;
}

export interface Atom {
  slug: string;
  name: string;
  parents: string[]; // e.g. ["molecule:republic-of-masquerade"]
}

export interface Version {
  slug: string;
  name: string;
  type: string;
  date: string;
  description: string;
  parents: string[]; // e.g. ["atom:rom-win"]
  [key: string]: unknown; // flexible per-type properties
}

export interface RawSeed {
  molecules?: Molecule[];
  atoms?: Atom[];
  versions?: Version[];
}

export interface TimelineEntry {
  version: Version;
  atom: Atom | null;
  domain: Domain | null;
}

export interface Dataset {
  getMolecules(): Molecule[];
  atomsForMolecule(slug: string): Atom[];
  standaloneAtoms(): Atom[];
  getAtom(slug: string): Atom | undefined;
  versionsForAtom(slug: string): Version[];
  timelineVersions(): TimelineEntry[];
  domainForAtom(slug: string): Domain | null;
}

const MOLECULE_PREFIX = "molecule:";
const ATOM_PREFIX = "atom:";

function parentsWithPrefix(parents: string[] | undefined, prefix: string): string[] {
  return (parents ?? []).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
}

// Newest first; ties keep input order (stable sort).
function byDateDesc(a: { date: string }, b: { date: string }): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}

export function buildDataset(raw: RawSeed): Dataset {
  const molecules = raw.molecules ?? [];
  const atoms = raw.atoms ?? [];
  const versions = raw.versions ?? [];

  const moleculeBySlug = new Map(molecules.map((m) => [m.slug, m]));
  const atomBySlug = new Map(atoms.map((a) => [a.slug, a]));

  // molecule slug -> atoms (in seed order); only resolvable molecule refs.
  const atomsByMolecule = new Map<string, Atom[]>();
  const standalone: Atom[] = [];
  for (const atom of atoms) {
    const moleculeSlugs = parentsWithPrefix(atom.parents, MOLECULE_PREFIX).filter((s) =>
      moleculeBySlug.has(s),
    );
    if (moleculeSlugs.length === 0) {
      standalone.push(atom); // no parent, or only dangling refs
      continue;
    }
    for (const m of moleculeSlugs) {
      const list = atomsByMolecule.get(m) ?? [];
      list.push(atom);
      atomsByMolecule.set(m, list);
    }
  }

  // atom slug -> versions, sorted newest first.
  const versionsByAtom = new Map<string, Version[]>();
  for (const version of versions) {
    for (const atomSlug of parentsWithPrefix(version.parents, ATOM_PREFIX)) {
      const list = versionsByAtom.get(atomSlug) ?? [];
      list.push(version);
      versionsByAtom.set(atomSlug, list);
    }
  }
  for (const list of versionsByAtom.values()) {
    list.sort(byDateDesc);
  }

  function domainForAtom(slug: string): Domain | null {
    const atom = atomBySlug.get(slug);
    if (!atom) return null;
    for (const moleculeSlug of parentsWithPrefix(atom.parents, MOLECULE_PREFIX)) {
      const molecule = moleculeBySlug.get(moleculeSlug);
      if (molecule) return molecule.domain; // first resolvable molecule parent wins
    }
    return null;
  }

  const timeline: TimelineEntry[] = versions
    .map((version) => {
      const atomSlug = parentsWithPrefix(version.parents, ATOM_PREFIX)[0];
      const atom = atomSlug ? (atomBySlug.get(atomSlug) ?? null) : null;
      return {
        version,
        atom,
        domain: atom ? domainForAtom(atom.slug) : null,
      };
    })
    .sort((a, b) => byDateDesc(a.version, b.version));

  return {
    getMolecules: () => molecules,
    atomsForMolecule: (slug) => atomsByMolecule.get(slug) ?? [],
    standaloneAtoms: () => standalone,
    getAtom: (slug) => atomBySlug.get(slug),
    versionsForAtom: (slug) => versionsByAtom.get(slug) ?? [],
    timelineVersions: () => timeline,
    domainForAtom,
  };
}

let cached: Dataset | null = null;

// Reads data/seed.yml once at first call (build time), then caches.
export function getDataset(): Dataset {
  if (!cached) {
    const file = readFileSync(join(process.cwd(), "data", "seed.yml"), "utf8");
    // CORE_SCHEMA omits js-yaml's !!timestamp type, so dates like `2025-09-28`
    // stay plain strings instead of becoming Date objects.
    const parsed = yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawSeed;
    cached = buildDataset(parsed ?? {});
  }
  return cached;
}
