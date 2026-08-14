import { getDb } from "./db";
import type { Bean, Domain, Pod, Sprout, Visibility } from "./data";
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
  await db.collection("molecules").createIndex({ slug: 1 }, { unique: true });
  await db.collection("atoms").createIndex({ slug: 1 }, { unique: true });
  await db.collection("versions").createIndex({ slug: 1 }, { unique: true });
}

export async function listPods(): Promise<Pod[]> {
  const db = await getDb();
  return db.collection<Pod>("molecules").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export async function listBeans(): Promise<Bean[]> {
  const db = await getDb();
  return db.collection<Bean>("atoms").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export interface NewPod {
  slug: string;
  name: string;
  domain: Domain;
  description: string;
}

export async function createPod(input: NewPod): Promise<Pod> {
  const db = await getDb();
  const doc: Pod = { ...input, visibility: "private" };
  try {
    await db.collection<Pod>("molecules").insertOne({ ...doc });
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
}

export async function createBean(input: NewBean): Promise<Bean> {
  const db = await getDb();
  const doc: Bean = {
    slug: input.slug,
    name: input.name,
    parents: input.podSlug ? [`pod:${input.podSlug}`] : [],
    visibility: "private",
  };
  try {
    await db.collection<Bean>("atoms").insertOne({ ...doc });
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
    await db.collection<Sprout>("versions").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("sprout", input.slug);
    throw err;
  }
  return doc;
}

// Single-version read for the edit-page prefill (projection drops _id).
export async function getSprout(slug: string): Promise<Sprout | null> {
  const db = await getDb();
  return db.collection<Sprout>("versions").findOne({ slug }, { projection: { _id: 0 } });
}

// Updates ONLY the editable fields via $set. Never touches slug / parents / media /
// source / content, so an edit can never re-parent or drop carried media. slug is
// immutable, so there is no unique-index collision path here.
export async function updateVersion(slug: string, patch: SproutPatch): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("versions").updateOne({ slug }, { $set: { ...patch } });
}

// Hard delete (roadmap A2). Idempotent — deleting a missing slug is a no-op
// (deleteOne matches 0). Callers needing the visibility recompute must capture the
// version's atom parents and state BEFORE calling this; afterwards the version no
// longer exists for unpublishCascade to find. Dangling refs to the deleted slug
// (capture promotedTo, future relations[]) are tolerated on all read paths.
export async function deleteVersion(slug: string): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("versions").deleteOne({ slug });
}

// Shared write half of the visibility cascades. No-op on empty arrays.
async function setVisibility(
  podSlugs: string[],
  beanSlugs: string[],
  visibility: Visibility,
): Promise<void> {
  const db = await getDb();
  if (podSlugs.length > 0) {
    await db.collection("molecules").updateMany({ slug: { $in: podSlugs } }, { $set: { visibility } });
  }
  if (beanSlugs.length > 0) {
    await db.collection("atoms").updateMany({ slug: { $in: beanSlugs } }, { $set: { visibility } });
  }
}

// The write half of the publish cascade.
export async function setPublic(podSlugs: string[], beanSlugs: string[]): Promise<void> {
  return setVisibility(podSlugs, beanSlugs, "public");
}

// The write half of the un-publish cascade — the exact mirror of setPublic.
export async function setPrivate(podSlugs: string[], beanSlugs: string[]): Promise<void> {
  return setVisibility(podSlugs, beanSlugs, "private");
}
