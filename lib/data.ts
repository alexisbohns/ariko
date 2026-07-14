import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export type Domain = "music" | "design" | "podcast";

export type Visibility = "private" | "public";
export type VersionState = "draft" | "private" | "published";

export interface LocalizedText {
  en?: string;
  fr?: string;
}
export type Text = string | LocalizedText;

export interface MediaEmbed {
  kind: "embed";
  provider: string; // soundcloud | spotify | deezer | ausha | youtube | vimeo | figma | ...
  url: string;
  embedId?: string;
}
export interface MediaImage {
  kind: "image";
  storageKey: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}
export type Media = MediaEmbed | MediaImage;

export interface Source {
  kind: string; // manual | github | changelog | arkaik | ...
  url?: string;
  externalId?: string;
  capturedAt?: string;
}

export interface Molecule {
  slug: string;
  name: string;
  domain: Domain;
  description: string;
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}

export interface Atom {
  slug: string;
  name: string;
  parents: string[]; // containment ONLY, e.g. ["molecule:republic-of-masquerade"] — non-containment links belong in a future relations[] (graph runway)
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}

export interface Version {
  slug: string;
  name: string;
  type: string;
  date: string;
  description: string;
  parents: string[]; // containment ONLY, e.g. ["atom:rom-win"] — drives the privacy cascades and timeline grouping; cross-links go in a future relations[]
  state?: VersionState; // absent => NOT published (safe default)
  content?: Text; // optional rich markdown, localizable
  media?: Media[];
  source?: Source;
  tags?: string[];
  [key: string]: unknown; // flexible per-type properties
}

export interface RawSeed {
  molecules?: Molecule[];
  atoms?: Atom[];
  versions?: Version[];
}

export type CaptureStatus = "inbox" | "promoted" | "discarded";

export interface CaptureSuggestion {
  moleculeSlug?: string;
  atomSlug?: string;
  type?: string;
  tags?: string[];
}

// Raw inbox item. Kept separate from the atomic model until triaged (spec §4.2).
export interface Capture {
  id: string; // crypto.randomUUID() at creation; captures are not slug-addressable
  title: string;
  body?: LocalizedText;
  content?: LocalizedText;
  media: Media[];
  source: Source;
  suggested?: CaptureSuggestion;
  status: CaptureStatus;
  promotedTo: string[]; // version slugs; empty until 2b triage
  createdAt: string; // ISO
  updatedAt: string; // ISO
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

// The containment-ref grammar, shared with the graph serializer (lib/graph.ts).
export const MOLECULE_PREFIX = "molecule:";
export const ATOM_PREFIX = "atom:";

export function parentsWithPrefix(parents: string[] | undefined, prefix: string): string[] {
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

export function resolveText(value: Text | undefined, lang: "en" | "fr" = "en"): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] ?? value.en ?? value.fr ?? "";
}

// Public projection of the vault. The security-sensitive rules live here:
//  - a Version is public ONLY when state === "published" (missing state hides it);
//  - a Molecule/Atom is visible unless explicitly visibility === "private";
//  - privacy cascades DOWNWARD, fail-closed: an Atom whose every EXISTING molecule
//    parent was filtered out is dropped, and a Version whose every EXISTING atom
//    parent was filtered out is dropped. Dangling (nonexistent) parent refs are
//    ignored, so standalone-by-dangling items are preserved (matches buildDataset).
export function filterPublic(raw: RawSeed): RawSeed {
  const rawMolecules = raw.molecules ?? [];
  const rawAtoms = raw.atoms ?? [];
  const rawVersions = raw.versions ?? [];

  const molecules = rawMolecules.filter((m) => m.visibility !== "private");
  const moleculeExists = new Set(rawMolecules.map((m) => m.slug));
  const moleculeKept = new Set(molecules.map((m) => m.slug));

  const atoms = rawAtoms.filter(
    (a) =>
      a.visibility !== "private" &&
      !allExistingParentsFiltered(a.parents, MOLECULE_PREFIX, moleculeExists, moleculeKept),
  );
  const atomExists = new Set(rawAtoms.map((a) => a.slug));
  const atomKept = new Set(atoms.map((a) => a.slug));

  const versions = rawVersions.filter(
    (v) =>
      v.state === "published" &&
      !allExistingParentsFiltered(v.parents, ATOM_PREFIX, atomExists, atomKept),
  );

  return { molecules, atoms, versions };
}

// True when the item has parent refs that EXIST in the dataset and ALL such
// existing parents were filtered out. Dangling/nonexistent refs are ignored.
function allExistingParentsFiltered(
  parents: string[] | undefined,
  prefix: string,
  exists: Set<string>,
  kept: Set<string>,
): boolean {
  const existingParents = parentsWithPrefix(parents, prefix).filter((s) => exists.has(s));
  return existingParents.length > 0 && existingParents.every((s) => !kept.has(s));
}

// Upward publish cascade — the write-time mirror of filterPublic's downward
// projection (spec §6.2). For the given version, returns the EXISTING atom parents
// and their EXISTING molecule parents that must be made public so a published
// version never dangles under a private parent. Dangling refs are ignored, exactly
// as filterPublic ignores them. Pure; visibility is not consulted (idempotent flip).
export function publishCascade(
  raw: RawSeed,
  versionSlug: string,
): { moleculeSlugs: string[]; atomSlugs: string[] } {
  const molecules = raw.molecules ?? [];
  const atoms = raw.atoms ?? [];
  const versions = raw.versions ?? [];

  const version = versions.find((v) => v.slug === versionSlug);
  if (!version) return { moleculeSlugs: [], atomSlugs: [] };

  const atomBySlug = new Map(atoms.map((a) => [a.slug, a]));
  const moleculeExists = new Set(molecules.map((m) => m.slug));

  const atomSlugs = [
    ...new Set(parentsWithPrefix(version.parents, ATOM_PREFIX).filter((s) => atomBySlug.has(s))),
  ];

  const moleculeSlugs = new Set<string>();
  for (const atomSlug of atomSlugs) {
    const atom = atomBySlug.get(atomSlug)!;
    for (const m of parentsWithPrefix(atom.parents, MOLECULE_PREFIX)) {
      if (moleculeExists.has(m)) moleculeSlugs.add(m);
    }
  }

  return { moleculeSlugs: [...moleculeSlugs], atomSlugs };
}

// Atom-level core of the downward recompute (roadmap A1/A2). Given candidate atom
// slugs, returns the EXISTING atoms left with NO published version, and their
// EXISTING molecule parents left with NO public atom once those atoms flip. Callers
// that still have the version (un-publish) adapt via unpublishCascade; callers that
// no longer do (delete) pass the atom parents they captured BEFORE the write and
// evaluate against the post-write dataset. Dangling/unknown slugs are ignored and
// flip-target visibility is not consulted (idempotent flip), exactly as publishCascade.
export function unpublishCascadeForAtoms(
  raw: RawSeed,
  atomSlugs: string[],
): { moleculeSlugs: string[]; atomSlugs: string[] } {
  const molecules = raw.molecules ?? [];
  const atoms = raw.atoms ?? [];
  const versions = raw.versions ?? [];

  const atomBySlug = new Map(atoms.map((a) => [a.slug, a]));
  const moleculeExists = new Set(molecules.map((m) => m.slug));

  // An atom is sheltered while ANY published version still points at it.
  const shelteredAtoms = new Set<string>();
  for (const v of versions) {
    if (v.state !== "published") continue;
    for (const s of parentsWithPrefix(v.parents, ATOM_PREFIX)) shelteredAtoms.add(s);
  }

  const flipping = new Set(
    atomSlugs.filter((s) => atomBySlug.has(s) && !shelteredAtoms.has(s)),
  );

  const moleculeCandidates = new Set<string>();
  for (const atomSlug of flipping) {
    for (const m of parentsWithPrefix(atomBySlug.get(atomSlug)!.parents, MOLECULE_PREFIX)) {
      if (moleculeExists.has(m)) moleculeCandidates.add(m);
    }
  }

  // A molecule is sheltered while any surviving public atom still points at it —
  // the same "public unless explicitly private" rule filterPublic reads by.
  const shelteredMolecules = new Set<string>();
  for (const a of atoms) {
    if (flipping.has(a.slug) || a.visibility === "private") continue;
    for (const m of parentsWithPrefix(a.parents, MOLECULE_PREFIX)) shelteredMolecules.add(m);
  }

  return {
    moleculeSlugs: [...moleculeCandidates].filter((m) => !shelteredMolecules.has(m)),
    atomSlugs: [...flipping],
  };
}

// Downward un-publish recompute — the inverse of publishCascade (roadmap A1). Thin
// adapter over unpublishCascadeForAtoms keyed by the version's atom parents, read
// from the dataset (unknown version slug → no-op). Evaluate against a dataset loaded
// AFTER the version's state was saved, so its own state counts (still-published → no-op).
export function unpublishCascade(
  raw: RawSeed,
  versionSlug: string,
): { moleculeSlugs: string[]; atomSlugs: string[] } {
  const version = (raw.versions ?? []).find((v) => v.slug === versionSlug);
  if (!version) return { moleculeSlugs: [], atomSlugs: [] };
  return unpublishCascadeForAtoms(raw, parentsWithPrefix(version.parents, ATOM_PREFIX));
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
