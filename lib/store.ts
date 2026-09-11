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
