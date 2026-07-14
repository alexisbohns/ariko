import { getDb } from "./db";
import type { Atom, Domain, Molecule, Version, Visibility } from "./data";
import type { VersionInput } from "./promote";
import type { VersionPatch } from "./version-edit";

// Thrown when a create hits the unique slug index. Lets the server action turn a
// collision into a friendly message instead of a 500.
export class SlugExistsError extends Error {
  constructor(
    public collection: string,
    public slug: string,
  ) {
    super(`${collection} slug already exists: ${slug}`);
    this.name = "SlugExistsError";
  }
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

// Idempotent — the Plan 1 migration already created these; making it explicit and
// re-runnable, and wiring it into scripts/apply-validators.ts.
export async function ensureAtomicIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("molecules").createIndex({ slug: 1 }, { unique: true });
  await db.collection("atoms").createIndex({ slug: 1 }, { unique: true });
  await db.collection("versions").createIndex({ slug: 1 }, { unique: true });
}

export async function listMolecules(): Promise<Molecule[]> {
  const db = await getDb();
  return db.collection<Molecule>("molecules").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export async function listAtoms(): Promise<Atom[]> {
  const db = await getDb();
  return db.collection<Atom>("atoms").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export interface NewMolecule {
  slug: string;
  name: string;
  domain: Domain;
  description: string;
}

export async function createMolecule(input: NewMolecule): Promise<Molecule> {
  const db = await getDb();
  const doc: Molecule = { ...input, visibility: "private" };
  try {
    await db.collection<Molecule>("molecules").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("molecule", input.slug);
    throw err;
  }
  return doc;
}

export interface NewAtom {
  slug: string;
  name: string;
  moleculeSlug: string | null;
}

export async function createAtom(input: NewAtom): Promise<Atom> {
  const db = await getDb();
  const doc: Atom = {
    slug: input.slug,
    name: input.name,
    parents: input.moleculeSlug ? [`molecule:${input.moleculeSlug}`] : [],
    visibility: "private",
  };
  try {
    await db.collection<Atom>("atoms").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("atom", input.slug);
    throw err;
  }
  return doc;
}

export async function createVersion(input: VersionInput): Promise<Version> {
  const db = await getDb();
  const doc: Version = { ...input };
  try {
    await db.collection<Version>("versions").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("version", input.slug);
    throw err;
  }
  return doc;
}

// Single-version read for the edit-page prefill (projection drops _id).
export async function getVersion(slug: string): Promise<Version | null> {
  const db = await getDb();
  return db.collection<Version>("versions").findOne({ slug }, { projection: { _id: 0 } });
}

// Updates ONLY the editable fields via $set. Never touches slug / parents / media /
// source / content, so an edit can never re-parent or drop carried media. slug is
// immutable, so there is no unique-index collision path here.
export async function updateVersion(slug: string, patch: VersionPatch): Promise<void> {
  const db = await getDb();
  await db.collection<Version>("versions").updateOne({ slug }, { $set: { ...patch } });
}

// Shared write half of the visibility cascades. No-op on empty arrays.
async function setVisibility(
  moleculeSlugs: string[],
  atomSlugs: string[],
  visibility: Visibility,
): Promise<void> {
  const db = await getDb();
  if (moleculeSlugs.length > 0) {
    await db.collection("molecules").updateMany({ slug: { $in: moleculeSlugs } }, { $set: { visibility } });
  }
  if (atomSlugs.length > 0) {
    await db.collection("atoms").updateMany({ slug: { $in: atomSlugs } }, { $set: { visibility } });
  }
}

// The write half of the publish cascade.
export async function setPublic(moleculeSlugs: string[], atomSlugs: string[]): Promise<void> {
  return setVisibility(moleculeSlugs, atomSlugs, "public");
}

// The write half of the un-publish cascade — the exact mirror of setPublic.
export async function setPrivate(moleculeSlugs: string[], atomSlugs: string[]): Promise<void> {
  return setVisibility(moleculeSlugs, atomSlugs, "private");
}
