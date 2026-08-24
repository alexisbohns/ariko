import type { UpdateFilter } from "mongodb";
import { getDb } from "./db";
import {
  resolveText,
  type Bean,
  type Media,
  type MediaImage,
  type Plant,
  type PlantRole,
  type Pod,
  type Sprout,
  type Text,
  type Visibility,
} from "./data";
import type { SproutInput } from "./promote";
import type { SproutPatch } from "./sprout-edit";
import type { ContentPatch } from "./content-edit";
import type { PlantMetaPatch } from "./plant-meta";

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
  name: Text;
  description: Text;
  podSlug: string | null;
  plantSlug: string | null; // used ONLY when podSlug is null — the pod carries the plant otherwise
}

export async function createBean(input: NewBean): Promise<Bean> {
  const db = await getDb();
  // A blank description is omitted rather than stored as "" — the field is
  // optional, and an empty one would render as a dangling line (slice 2).
  const described = resolveText(input.description).trim();
  const doc: Bean = {
    slug: input.slug,
    name: input.name,
    parents: input.podSlug ? [`pod:${input.podSlug}`] : input.plantSlug ? [`plant:${input.plantSlug}`] : [],
    ...(described ? { description: input.description } : {}),
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

/**
 * Writes prose and its mirrored relations — and nothing else.
 *
 * The two fields are named explicitly rather than spread, deliberately. This is
 * the mirror of updateVersion's `$set: { ...patch }`: because that one spreads,
 * `content` must never join SproutPatch (the metadata form has no content input
 * and would blank the prose on every save), and because this one does not
 * spread, a widened caller can never reach `state`, `media` or `source`.
 */
async function writeContent(collection: string, slug: string, patch: ContentPatch): Promise<void> {
  const db = await getDb();
  await db
    .collection(collection)
    .updateOne({ slug }, { $set: { content: patch.content, relations: patch.relations } });
}

export function updateSproutContent(slug: string, patch: ContentPatch): Promise<void> {
  return writeContent("sprouts", slug, patch);
}

export function updatePlantContent(slug: string, patch: ContentPatch): Promise<void> {
  return writeContent("plants", slug, patch);
}

export function updatePodContent(slug: string, patch: ContentPatch): Promise<void> {
  return writeContent("pods", slug, patch);
}

/**
 * Writes a plant's role — and nothing else.
 *
 * A SIBLING of writeContent and updateSproutMedia, not a widening of anything.
 * `role` is named explicitly rather than spread for the reason those two give:
 * a spread is what would let a later, widened caller reach `visibility` or
 * `natures` from a form that has no business touching them.
 */
export async function updatePlantRole(slug: string, role: PlantRole): Promise<void> {
  const db = await getDb();
  await db.collection<Plant>("plants").updateOne({ slug }, { $set: { role } });
}

/**
 * Writes a plant's name, description and status — and nothing else.
 *
 * A SIBLING of updatePlantRole, for the reason that one gives: the three
 * fields are named explicitly rather than spread, so a later, widened caller
 * cannot reach `visibility`, `natures`, `logo` or `content` from a form that
 * has no business touching them. `slug` is not among them either — it is what
 * every parents[] ref points at.
 *
 * A null description is an `$unset`, not a stored "": the Meta card must be
 * able to REMOVE a description, and a stored empty string renders as a
 * dangling line on the landing gallery.
 */
export async function updatePlantMeta(slug: string, patch: PlantMetaPatch): Promise<void> {
  const db = await getDb();
  await db.collection<Plant>("plants").updateOne({ slug }, {
    $set: { name: patch.name, status: patch.status },
    ...(patch.description === null
      ? { $unset: { description: "" } }
      : { $set: { description: patch.description } }),
  } as UpdateFilter<Plant>);
}

/**
 * Writes a plant's logo — and nothing else. `null` clears it.
 *
 * A SIBLING again. Clearing is an `$unset` rather than a stored null, so an
 * absent logo has ONE representation in the database and every read surface
 * only has to handle `logo === undefined`.
 */
export async function updatePlantLogo(slug: string, logo: MediaImage | null): Promise<void> {
  const db = await getDb();
  await db
    .collection<Plant>("plants")
    .updateOne({ slug }, (logo === null
      ? { $unset: { logo: "" } }
      : { $set: { logo } }) as UpdateFilter<Plant>);
}

/**
 * Writes a sprout's media — and nothing else.
 *
 * A SIBLING of writeContent, not a widening of updateVersion. updateVersion
 * writes `$set: { ...patch }` and its comment promises it "never touches slug /
 * parents / media / source / content"; that promise is what makes the metadata
 * form safe, so media gets its own narrow writer instead. `media` is named
 * explicitly rather than spread, for the same reason writeContent names its
 * two fields: a spread lets a widened caller reach `state` or `source`.
 */
export async function updateSproutMedia(slug: string, media: Media[]): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").updateOne({ slug }, { $set: { media } });
}
