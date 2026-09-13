import { getDb } from "./db";
import {
  buildDataset,
  type Bean,
  type Bee,
  type Dataset,
  type Plant,
  type Pod,
  type RawGarden,
  type Screen,
  type Sprout,
} from "./data";

// LIVE — always hits Mongo. The admin and every server action read this one.
// The public zone reads `loadCachedGarden` in `lib/garden-cache.ts` instead:
// two names rather than one wrapped function, because `actions.ts` re-reads
// the garden after a write so the publish cascade sees the just-saved state,
// and a cached read there would compute it against the pre-write garden.
export async function loadRawGarden(): Promise<RawGarden> {
  const db = await getDb();
  const [plants, pods, beans, sprouts, bees, screens] = await Promise.all([
    db.collection<Plant>("plants").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Pod>("pods").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Bean>("beans").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Sprout>("sprouts").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Bee>("bees").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Screen>("screens").find({}, { projection: { _id: 0 } }).toArray(),
  ]);
  return { plants, pods, beans, sprouts, bees, screens };
}

// Admin (used by later plans): everything.
export async function getFullDataset(): Promise<Dataset> {
  return buildDataset(await loadRawGarden());
}

/**
 * The plant fields the chrome's switcher draws, and nothing else.
 *
 * LIVE, exactly as `loadRawGarden` is — CLAUDE.md's rule is that the admin
 * reads live, and this narrows WHAT is read, never WHEN. The chrome is still
 * the surface most likely to be looked at immediately after a rename.
 *
 * It exists because the layout above every admin page called `loadRawGarden`
 * for twelve avatars, and that call is not a cheap one made twelve times over —
 * it is six unfiltered collection scans returning the entire garden:
 *
 *     plants 12 · pods 14 · beans 73 · sprouts 55 · bees 7 · screens 170
 *     421 KB, ~130 ms warm — to compose 1.6 KB of marks
 *
 * Most of that weight is text no chrome can draw: 215 KB of sprout markdown
 * bodies and 101 KB of pod narrative, fetched on every navigation to render
 * twelve 24px squircles in the top-left corner. The projection below answers
 * the same question in ~10 ms.
 *
 * THE PROJECTION IS THE CONTRACT, so it is spelled as the four fields rather
 * than as an exclusion: a `{ _id: 0 }`-style negative would silently widen
 * every time a plant gains a field, which is how this read got heavy in the
 * first place. Adding a field to the switcher means adding it here, where the
 * cost is visible.
 *
 * `name` stays a `Text` — resolving is `resolveText`'s job and the language is
 * the reader's, not the query's.
 */
export type PlantFacts = Pick<Plant, "slug" | "name" | "visibility"> & {
  logo?: { url?: string };
};

export async function loadPlantMarks(): Promise<PlantFacts[]> {
  const db = await getDb();
  return db
    .collection<Plant>("plants")
    .find({}, { projection: { _id: 0, slug: 1, name: 1, "logo.url": 1, visibility: 1 } })
    .toArray() as Promise<PlantFacts[]>;
}
