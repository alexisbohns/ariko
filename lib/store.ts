import { getDb } from "./db";
import {
  buildDataset,
  filterPublic,
  type Bean,
  type Dataset,
  type Pod,
  type RawSeed,
  type Sprout,
} from "./data";

export async function loadRawGarden(): Promise<RawSeed> {
  const db = await getDb();
  const [pods, beans, sprouts] = await Promise.all([
    db.collection<Pod>("molecules").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Bean>("atoms").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Sprout>("versions").find({}, { projection: { _id: 0 } }).toArray(),
  ]);
  return { pods, beans, sprouts };
}

// Public site: published-only.
export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadRawGarden()));
}

// Admin (used by later plans): everything.
export async function getFullDataset(): Promise<Dataset> {
  return buildDataset(await loadRawGarden());
}
