import { getDb } from "./db";
import {
  buildDataset,
  filterPublic,
  type Bean,
  type Bee,
  type Dataset,
  type Plant,
  type Pod,
  type RawGarden,
  type Sprout,
} from "./data";

export async function loadRawGarden(): Promise<RawGarden> {
  const db = await getDb();
  const [plants, pods, beans, sprouts, bees] = await Promise.all([
    db.collection<Plant>("plants").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Pod>("pods").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Bean>("beans").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Sprout>("sprouts").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Bee>("bees").find({}, { projection: { _id: 0 } }).toArray(),
  ]);
  return { plants, pods, beans, sprouts, bees };
}

// Public site: published-only.
export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadRawGarden()));
}

// Admin (used by later plans): everything.
export async function getFullDataset(): Promise<Dataset> {
  return buildDataset(await loadRawGarden());
}
