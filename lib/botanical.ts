import type { UpdateFilter } from "mongodb";
import { getDb } from "./db";
import {
  resolveText,
  PLANT_PREFIX,
  type Bean,
  type Media,
  type MediaImage,
  type Plant,
  type PlantRole,
  type PlantStatus,
  type Pod,
  type Relation,
  type Screen,
  type Sprout,
  type Text,
  type Visibility,
} from "./data";
import type { SproutInput } from "./promote";
import type { SproutPatch } from "./sprout-edit";
import type { ContentPatch } from "./content-edit";
import { plantMetaUpdate, type PlantMetaPatch } from "./plant-meta";
import { screenMetaUpdate, type ScreenMetaPatch } from "./screen-edit";
import type { ExhibitionWrites } from "./exhibition";

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
  // The screen store's index is not decoration: it is the whole of
  // createScreen's collision behaviour. Without it a duplicate slug inserts a
  // second document instead of raising SlugExistsError, and the import script
  // that leans on "skip what is already there" would quietly grow doubles.
  await db.collection("screens").createIndex({ slug: 1 }, { unique: true });
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

export interface NewScreen {
  slug: string;
  name: Text;
  image: MediaImage;
  // The plant the screen belongs to, as a bare slug. createBean's shape, and
  // for its reason: the WRITER owns the prefixed-ref grammar, so no caller ever
  // hand-builds a "plant:" string and no caller can put a "bean:" one in a
  // field that means containment.
  plantSlug: string | null;
  legend?: Text;
  relations?: Relation[];
  tags?: string[];
  capturedAt?: string;
}

/**
 * Inserts a screen — createBean one species over, deliberately, down to the
 * two behaviours worth copying.
 *
 * The first is the slug collision: a duplicate raises SlugExistsError rather
 * than a 500, so a caller can say so in words. That path exists only because
 * ensureBotanicalIndexes gives `screens` a unique slug index.
 *
 * The second is the omission discipline. An optional field left blank is
 * ABSENT, never a stored "" or a materialized empty array — the invariant
 * updateBeanCover's test spells out at length: nothing MISDRAWS when it is
 * broken, but `Screen.legend` is declared optional rather than nullable, and
 * the reader who pays is the next one written to that declaration (a presence
 * check, an `Object.keys`, a "has a caption" filter on the gallery).
 *
 * Private at birth, exactly as createPod and createBean are. `Screen.visibility`
 * says "default treated as public", which is how an ABSENT field READS on the
 * way out — not what a writer stores on the way in; `Bean.visibility` carries
 * the same comment and createBean above stores "private" too. Storing a
 * hundred and seventy screens is not publishing them, and the flip is the
 * author's to make.
 *
 * So the import's hundred and seventy land PRIVATE BY DESIGN, and the gallery
 * slice should read that as a decision rather than as an accident to fix: the
 * flip it performs is a deliberate act on the screens it chooses to exhibit,
 * which is the cost of being fail-closed at birth and is the cheaper of the two
 * mistakes available here.
 */
export async function createScreen(input: NewScreen): Promise<Screen> {
  const db = await getDb();
  const doc: Screen = {
    slug: input.slug,
    name: input.name,
    image: input.image,
    parents: input.plantSlug ? [`plant:${input.plantSlug}`] : [],
    // resolveText rather than a truthiness check: a `{ en: "", fr: "" }` from a
    // paired form is a truthy OBJECT carrying no words at all.
    ...(input.legend && resolveText(input.legend).trim() ? { legend: input.legend } : {}),
    ...(input.relations?.length ? { relations: input.relations } : {}),
    ...(input.tags?.length ? { tags: input.tags } : {}),
    ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
    visibility: "private",
  };
  try {
    await db.collection<Screen>("screens").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("screen", input.slug);
    throw err;
  }
  return doc;
}

/**
 * One plant's screens — the read the exhibition actions work from.
 *
 * A real query on `parents` rather than `loadRawGarden()`, because the actions
 * want screens and nothing else and would otherwise load five collections to
 * reorder one strip. The plant PAGE does not call this: it already has the
 * garden loaded and reads the same narrowing off `buildDataset`'s
 * `exhibitionForPlant` instead, so this function has exactly one caller now —
 * `applyExhibition` in `app/admin/actions.ts`.
 *
 * It replaces `listScreens`, whose docblock said to delete it if the gallery
 * slice landed on a different read. It did.
 *
 * Slug-ordered, and that is not the strip's order: this is a stable READ, and
 * `exhibitionOrder` is what puts it in sequence at the point of use, from the
 * `order` field this returns.
 */
export async function listScreensForPlant(plantSlug: string): Promise<Screen[]> {
  const db = await getDb();
  return db
    .collection<Screen>("screens")
    .find({ parents: `${PLANT_PREFIX}${plantSlug}` }, { projection: { _id: 0 } })
    .sort({ slug: 1 })
    .toArray();
}

/**
 * The exhibition, written.
 *
 * EXHIBITING AND PUBLISHING ARE ONE ACT, and this function is where that is
 * true. Every screen is private at birth (createScreen, above), and
 * filterPublic drops a private screen — so `exhibited: true` on its own would
 * render nothing at all, and an author who had to flip visibility separately
 * would produce, as the commonest mistake, a screen marked for the strip and
 * stored private, showing nothing with nothing on any page to say why. This
 * function OWNS `visibility` on a screen for that reason: `screen-edit.ts`
 * keeps it out of the metadata form so there is exactly one writer of the
 * field, and this is it.
 *
 * Withdrawing is the exact mirror, down to the `$unset`: an absent optional
 * field has ONE representation in this database — `createScreen`'s omission
 * discipline — so a withdrawn screen carries no `exhibited: false` and no
 * stale `order` for the next reader to interpret.
 *
 * A loop of updateOne for the promote half rather than a bulkWrite, and NOT
 * because the rows differ: bulkWrite carries a separate update document per
 * operation, so differing `order` values are the ordinary case for it rather
 * than an obstacle. The honest trade is that this costs N + 1 round trips
 * where a single ordered bulkWrite would cost one, and it widens the window in
 * which a dying process leaves the two halves half-applied. It is taken
 * anyway, because a strip is a handful of screens rather than a hundred and
 * seventy, and a loop of updateOne is the plainest thing in this file to read.
 * If a strip ever grows to a size where N round trips are a cost, this is the
 * function to change and the reason to change it. The withdraw half is
 * uniform across every row, which is what lets it be a single updateMany —
 * setVisibility's shape, above.
 *
 * The two halves are NOT atomic with respect to each other, and what saves that
 * is that nothing strands. Each DOCUMENT is atomic — a screen is never
 * exhibited-and-private or public-and-unexhibited, because both facts are
 * written by one update — so a crash mid-loop leaves a strip that is merely
 * OVER-inclusive, possibly with two screens sharing an `order`. exhibitionOrder
 * tie-breaks a collision by slug deterministically, the next read shows the
 * author the state that actually exists, and the next press renormalizes the
 * whole strip to 0..n-1.
 *
 * Promote runs before withdraw, so a slug in both lists would end private —
 * the safe direction. `exhibitionWrites` produces disjoint lists by
 * construction, so that ordering is defence rather than a live requirement, and
 * this function does not re-check it: stated so the absence of a guard reads as
 * a conclusion rather than an oversight, which is the stance
 * buildScreenMetaPatch takes about unvalidated refs.
 *
 * A JOINING row's filter is bare `{ slug }`, but a RENUMBERING row's filter is
 * `{ slug, exhibited: true }`, and that qualifier closes a real race rather
 * than decorating one. `after` in `exhibitionWrites` is computed from whatever
 * strip its caller last read, and two admin tabs open on the same plant can
 * have read two different strips: withdraw a screen in tab B, then press ↑ on
 * its neighbour in tab A — tab A's stale list still contains the withdrawn
 * slug, so `exhibitionWrites` reports it as a renumbering row (`joining:
 * false`) at its new index. A bare `{ slug }` filter would match that document
 * regardless of tab B's write and set `exhibited: true, visibility: "public"`
 * right back over it, silently resurrecting a screen the author deliberately
 * took down. The `exhibited: true` qualifier makes that update match nothing
 * once tab B's withdrawal has landed, so the stale renumber is a no-op on that
 * row instead of an undo of someone else's decision. A joining row carries no
 * such risk — it is not yet exhibited, so there is no state for a stale read
 * to have gotten wrong — and needs no filter beyond identity.
 *
 * Empty lists write nothing, which is what makes lib/exhibition.ts's `null`
 * no-op cheap all the way down.
 */
export async function writeExhibition(writes: ExhibitionWrites): Promise<void> {
  const db = await getDb();
  const screens = db.collection<Screen>("screens");

  for (const { slug, order, joining } of writes.promote) {
    await screens.updateOne(
      joining ? { slug } : { slug, exhibited: true },
      { $set: { exhibited: true, visibility: "public", order } },
    );
  }

  if (writes.withdraw.length > 0) {
    await screens.updateMany(
      { slug: { $in: writes.withdraw } },
      { $set: { visibility: "private" }, $unset: { exhibited: "", order: "" } },
    );
  }
}

/** Single read for the edit page's prefill (projection drops _id) —
 *  `getSprout`'s shape, one species over. */
export async function getScreen(slug: string): Promise<Screen | null> {
  const db = await getDb();
  return db.collection<Screen>("screens").findOne({ slug }, { projection: { _id: 0 } });
}

/**
 * Writes a screen's name, legend, tags, parents and relations — and nothing
 * else.
 *
 * A SIBLING of updatePlantMeta, down to the reason its update document is built
 * elsewhere: `screenMetaUpdate` is pure and tested because composing `$set` and
 * `$unset` inline with a spread silently drops fields (see `plantMetaUpdate`'s
 * comment, which is that bug's headstone).
 *
 * `image` is NOT among the fields, and that is the whole safety of the arrangement:
 * the Meta form and the picker form are separate forms on the same page, so a
 * metadata save can never blank an image and an image save can never blank a name.
 */
export async function updateScreenMeta(slug: string, patch: ScreenMetaPatch): Promise<void> {
  const db = await getDb();
  await db
    .collection<Screen>("screens")
    .updateOne({ slug }, screenMetaUpdate(patch) as UpdateFilter<Screen>);
}

/**
 * Writes a screen's image — and nothing else.
 *
 * A plain `$set` with no `$unset` twin, unlike `updateBeanCover` and
 * `updatePlantLogo`: `Screen.image` is required, so there is no clear to
 * express. That is also why this is not the fourth copy of the `$set`/`$unset`
 * shape `updateBeanCover`'s comment warns about — it is half of it.
 */
export async function updateScreenImage(slug: string, image: MediaImage): Promise<void> {
  const db = await getDb();
  await db.collection<Screen>("screens").updateOne({ slug }, { $set: { image } });
}

/**
 * Hard delete. Idempotent — deleting a missing slug matches 0 and is a no-op.
 *
 * The DOCUMENT only. The Cloudinary asset stays, deliberately: until covers
 * become screen references, a bean's `cover` holds its own inline copy of the
 * same asset, so deleting the bytes here would break the landing row. An asset
 * nothing points at any more is `npm run check:orphans`'s to sweep, and
 * lib/orphan-assets.ts already counts `screens.image` among the four homes a
 * storageKey can have — so an asset a bean still uses is correctly reported as
 * referenced and left alone.
 */
export async function deleteScreen(slug: string): Promise<void> {
  const db = await getDb();
  await db.collection<Screen>("screens").deleteOne({ slug });
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
  // The update document is built by plantMetaUpdate, not inline: composing it
  // here with a spread produced two `$set` keys and silently dropped two of the
  // three fields (see that function's comment). Pure, so it is pinned by a test.
  await db
    .collection<Plant>("plants")
    .updateOne({ slug }, plantMetaUpdate(patch) as UpdateFilter<Plant>);
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
 * Writes a bean's cover — and nothing else. `null` clears it.
 *
 * The first bean FIELD writer in this file — `createBean` above already writes
 * beans, but whole ones. Narrow rather than an `updateBeanMeta` that could
 * take several fields: `updateBeanCover` and `updateBeanKeyword` duplicate the
 * same five-line `$set`/`$unset` shape rather than sharing a helper, because a
 * helper generic over both document type and field key would land back at a
 * cast to escape it — and each copy naming its one field
 * literally is what makes a typo visible on sight. If a FOURTH copy of this
 * shape appears, the move is `lib/plant-meta.ts`'s: extract a pure, tested
 * update-doc builder, which is what that file did after a duplicate-`$set` bug
 * shipped silently (see `plantMetaUpdate`'s comment).
 *
 * No `as UpdateFilter<Bean>` cast here, unlike `updatePlantLogo` above:
 * `plantMetaUpdate`'s cast earns its keep because that function returns
 * `Record<string, unknown>`, but on a literal `$set`/`$unset` object the same
 * cast silences `$set`'s value-type checking for no reason — `{ $set: { cover:
 * "oops" } }` compiles clean with the cast and fails `tsc` without it.
 *
 * Clearing is an `$unset` rather than a stored null, so an absent cover has ONE
 * representation and lib/bean-cover.ts only has to handle `cover === undefined`.
 */
export async function updateBeanCover(slug: string, cover: MediaImage | null): Promise<void> {
  const db = await getDb();
  await db
    .collection<Bean>("beans")
    .updateOne({ slug }, cover === null
      ? { $unset: { cover: "" } }
      : { $set: { cover } });
}

/**
 * Writes a bean's keyword — and nothing else. `null` clears it, as above. No
 * cast, for the same reason `updateBeanCover` gives.
 */
export async function updateBeanKeyword(slug: string, keyword: Text | null): Promise<void> {
  const db = await getDb();
  await db
    .collection<Bean>("beans")
    .updateOne({ slug }, keyword === null
      ? { $unset: { keyword: "" } }
      : { $set: { keyword } });
}

/**
 * Writes a plant's status — and nothing else.
 *
 * A SIBLING again, and a narrower one than updatePlantMeta on purpose: the
 * plant page's zap toggle is a single click that writes a single field, so it
 * must not travel through a patch that also carries `name` and `description`.
 * A toggle that could blank a name is a toggle nobody should press.
 */
export async function updatePlantStatus(slug: string, status: PlantStatus): Promise<void> {
  const db = await getDb();
  await db.collection<Plant>("plants").updateOne({ slug }, { $set: { status } });
}

/**
 * Writes a plant's visibility — and nothing else.
 *
 * Deliberately NOT setPublic/setPrivate: those two are the write halves of the
 * sprout-driven cascades and take three tiers of slugs. This flips one plant
 * and touches nothing beneath it, which is correct in both directions.
 * Downward privacy is a READ-time projection (filterPublic drops a private
 * plant's whole subtree), so going private needs no cascade; and going public
 * must not silently republish pods and beans that were made private on their
 * own terms.
 */
export async function updatePlantVisibility(slug: string, visibility: Visibility): Promise<void> {
  const db = await getDb();
  await db.collection<Plant>("plants").updateOne({ slug }, { $set: { visibility } });
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
