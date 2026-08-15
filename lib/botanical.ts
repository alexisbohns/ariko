import { getDb } from "./db";
import type { Bean, Plant, Pod, Sprout, Visibility } from "./data";
import type { SproutInput } from "./promote";
import type { SproutPatch } from "./sprout-edit";

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
export async function ensureBotanicalIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("pods").createIndex({ slug: 1 }, { unique: true });
  await db.collection("beans").createIndex({ slug: 1 }, { unique: true });
  await db.collection("sprouts").createIndex({ slug: 1 }, { unique: true });
  await db.collection("plants").createIndex({ slug: 1 }, { unique: true });
  await db.collection("bees").createIndex({ slug: 1 }, { unique: true });
}

export async function listPlants(): Promise<Plant[]> {
  const db = await getDb();
  return db.collection<Plant>("plants").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export async function listPods(): Promise<Pod[]> {
  const db = await getDb();
  return db.collection<Pod>("pods").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export async function listBeans(): Promise<Bean[]> {
  const db = await getDb();
  return db.collection<Bean>("beans").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export interface NewPod {
  slug: string;
  name: string;
  plantSlug: string | null;
  description: string;
}

export async function createPod(input: NewPod): Promise<Pod> {
  const db = await getDb();
  const doc: Pod = {
    slug: input.slug,
    name: input.name,
    parents: input.plantSlug ? [`plant:${input.plantSlug}`] : [],
    description: input.description,
    visibility: "private",
  };
  try {
    await db.collection<Pod>("pods").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("pod", input.slug);
    throw err;
  }
  return doc;
}

export interface NewBean {
  slug: string;
  name: string;
  podSlug: string | null;
  plantSlug: string | null; // used ONLY when podSlug is null — the pod carries the plant otherwise
}

export async function createBean(input: NewBean): Promise<Bean> {
  const db = await getDb();
  const doc: Bean = {
    slug: input.slug,
    name: input.name,
    parents: input.podSlug ? [`pod:${input.podSlug}`] : input.plantSlug ? [`plant:${input.plantSlug}`] : [],
    visibility: "private",
  };
  try {
    await db.collection<Bean>("beans").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("bean", input.slug);
    throw err;
  }
  return doc;
}

export async function createSprout(input: SproutInput): Promise<Sprout> {
  const db = await getDb();
  const doc: Sprout = { ...input };
  try {
    await db.collection<Sprout>("sprouts").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("sprout", input.slug);
    throw err;
  }
  return doc;
}

// Single-version read for the edit-page prefill (projection drops _id).
export async function getSprout(slug: string): Promise<Sprout | null> {
  const db = await getDb();
  return db.collection<Sprout>("sprouts").findOne({ slug }, { projection: { _id: 0 } });
}

// Updates ONLY the editable fields via $set. Never touches slug / parents / media /
// source / content, so an edit can never re-parent or drop carried media. slug is
// immutable, so there is no unique-index collision path here.
export async function updateVersion(slug: string, patch: SproutPatch): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").updateOne({ slug }, { $set: { ...patch } });
}

// Hard delete (roadmap A2). Idempotent — deleting a missing slug is a no-op
// (deleteOne matches 0). Callers needing the visibility recompute must seed the
// sprout's bean parents and state BEFORE calling this; afterwards the sprout no
// longer exists for unpublishCascade to find. Dangling refs to the deleted slug
// (seed promotedTo, future relations[]) are tolerated on all read paths.
export async function deleteVersion(slug: string): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").deleteOne({ slug });
}

// Shared write half of the visibility cascades. No-op on empty arrays.
async function setVisibility(
  plantSlugs: string[],
  podSlugs: string[],
  beanSlugs: string[],
  visibility: Visibility,
): Promise<void> {
  const db = await getDb();
  if (plantSlugs.length > 0) {
    await db.collection("plants").updateMany({ slug: { $in: plantSlugs } }, { $set: { visibility } });
  }
  if (podSlugs.length > 0) {
    await db.collection("pods").updateMany({ slug: { $in: podSlugs } }, { $set: { visibility } });
  }
  if (beanSlugs.length > 0) {
    await db.collection("beans").updateMany({ slug: { $in: beanSlugs } }, { $set: { visibility } });
  }
}

// The write half of the publish cascade — spans all three content tiers (plants included).
export async function setPublic(plantSlugs: string[], podSlugs: string[], beanSlugs: string[]): Promise<void> {
  return setVisibility(plantSlugs, podSlugs, beanSlugs, "public");
}

// The write half of the un-publish cascade — the exact mirror of setPublic.
export async function setPrivate(plantSlugs: string[], podSlugs: string[], beanSlugs: string[]): Promise<void> {
  return setVisibility(plantSlugs, podSlugs, beanSlugs, "private");
}
