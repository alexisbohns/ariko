import { getDb } from "./db";
import {
  buildDataset,
  filterPublic,
  type Atom,
  type Dataset,
  type Molecule,
  type RawSeed,
  type Version,
} from "./data";

export async function loadRawSeed(): Promise<RawSeed> {
  const db = await getDb();
  const [molecules, atoms, versions] = await Promise.all([
    db.collection<Molecule>("molecules").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Atom>("atoms").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Version>("versions").find({}, { projection: { _id: 0 } }).toArray(),
  ]);
  return { molecules, atoms, versions };
}

// Public site: published-only.
export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadRawSeed()));
}

// Admin (used by later plans): everything.
export async function getFullDataset(): Promise<Dataset> {
  return buildDataset(await loadRawSeed());
}
