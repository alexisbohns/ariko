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

// Non-containment edge (G2): the version that declares it points —kind→ ref.
// ref reuses the prefixed grammar (version:/atom:/molecule:); kind is a free
// string ("evolves-from", "featured-in", …) — vocabulary curation is a later
// concern. No referential integrity by design: the filterPublic scrub and the
// graph serializer's both-ends prune hide edges whose target is gone or hidden.
export interface Relation {
  kind: string;
  ref: string;
}

export interface Molecule {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  domain: Domain;
  description: Text;
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}

export interface Atom {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  parents: string[]; // containment ONLY, e.g. ["molecule:republic-of-masquerade"] — non-containment links belong in a future relations[] (graph runway)
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}

export interface Version {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  type: string;
  date: string;
  description: Text;
  parents: string[]; // containment ONLY, e.g. ["atom:rom-win"] — drives the privacy cascades and timeline grouping; cross-links go in relations[]
  relations?: Relation[]; // non-containment edges (G2); scrubbed by filterPublic
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
  title: Text; // bilingual since C1; plain strings remain valid (no migration)
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

// The prefixed-ref grammar, shared with the graph serializer (lib/graph.ts).
// parents[] uses molecule:/atom: only; version: appears in relations[] refs
// (and as graph node ids) — nothing is ever contained BY a version.
export const MOLECULE_PREFIX = "molecule:";
export const ATOM_PREFIX = "atom:";
export const VERSION_PREFIX = "version:";

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

// Blank parts fall through (|| not ??): a hand-authored { en: "", fr: "Nom" }
// resolves to "Nom" instead of rendering blank and failing name validation.
export function resolveText(value: Text | undefined, lang: "en" | "fr" = "en"): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || value.fr || "";
}

// Strict single-part access — the form-prefill path (B1). Unlike resolveText it
// NEVER falls back across languages: prefilling the fr box with a fallback would
// silently copy en into it and corrupt the data on save. A plain string counts as
// the en part; the other part is empty.
export function textPart(value: Text | undefined, lang: "en" | "fr"): string {
  if (value == null) return "";
  if (typeof value === "string") return lang === "en" ? value : "";
  return value[lang] ?? "";
}

// Inverse of the paired form inputs (B1): both blank → "", fr blank → a plain
// string (keeps simple content simple), otherwise { en?, fr } with a blank en
// omitted. Trims both parts.
export function composeText(en: string, fr: string): Text {
  const e = en.trim();
  const f = fr.trim();
  if (!f) return e;
  return e ? { en: e, fr: f } : { fr: f };
}

// Public projection of the vault. The security-sensitive rules live here:
//  - a Version is public ONLY when state === "published" (missing state hides it);
//  - a Molecule/Atom is visible unless explicitly visibility === "private";
//  - privacy cascades DOWNWARD, fail-closed: an Atom whose every EXISTING molecule
//    parent was filtered out is dropped, and a Version whose every EXISTING atom
//    parent was filtered out is dropped. Dangling (nonexistent) parent refs are
//    ignored, so standalone-by-dangling items are preserved (matches buildDataset);
//  - each kept Version's relations[] is scrubbed to refs whose TARGET survives
//    this same projection (kept version/atom/molecule) — draft, private,
//    cascaded-out, dangling, and unknown-prefix targets all drop, so a hidden
//    slug can never leak through a property dump or the graph endpoint.
// Pure: input objects are never mutated; scrubbing yields a fresh version object.
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

  const keptVersions = rawVersions.filter(
    (v) =>
      v.state === "published" &&
      !allExistingParentsFiltered(v.parents, ATOM_PREFIX, atomExists, atomKept),
  );

  // Relations may point at versions, so the kept-version set must exist BEFORE
  // any relation is judged — a version ref survives iff its target survived the
  // filter above.
  const versionKept = new Set(keptVersions.map((v) => v.slug));
  const refSurvives = (ref: string): boolean =>
    ref.startsWith(VERSION_PREFIX)
      ? versionKept.has(ref.slice(VERSION_PREFIX.length))
      : ref.startsWith(ATOM_PREFIX)
        ? atomKept.has(ref.slice(ATOM_PREFIX.length))
        : ref.startsWith(MOLECULE_PREFIX) && moleculeKept.has(ref.slice(MOLECULE_PREFIX.length));

  const versions = keptVersions.map((v) => {
    if (!v.relations) return v; // absent stays absent — never materialize []
    // Tolerate malformed shapes from direct DB writes (the validator's
    // "moderate" level never re-checks pre-existing docs): a non-array field
    // and non-{kind,ref}-string entries drop fail-closed instead of throwing —
    // one bad doc must not 500 every public read.
    if (!Array.isArray(v.relations)) return { ...v, relations: [] };
    const scrubbed = v.relations.filter(
      (rel) =>
        rel != null &&
        typeof rel.kind === "string" &&
        typeof rel.ref === "string" &&
        refSurvives(rel.ref),
    );
    return scrubbed.length === v.relations.length ? v : { ...v, relations: scrubbed };
  });

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
