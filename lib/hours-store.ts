import { getDb } from "./db";
import type { HoursSnapshot } from "./hours";

// One document, replaced whole on every ingest (spec §6): a rebuildable read
// model — the next hours-sync recreates it from git. Public pages must not
// import this module; they read lib/hours-cache.ts.

const ID = "current";

interface HoursDoc extends HoursSnapshot {
  _id: string;
  receivedAt: string;
}

export async function loadHoursSnapshot(): Promise<HoursSnapshot | null> {
  const doc = await (await getDb()).collection<HoursDoc>("hours").findOne({ _id: ID });
  if (!doc) return null;
  const { _id, receivedAt, ...snapshot } = doc;
  void _id;
  void receivedAt;
  return snapshot;
}

export async function saveHoursSnapshot(snapshot: HoursSnapshot): Promise<void> {
  await (await getDb())
    .collection<HoursDoc>("hours")
    .replaceOne({ _id: ID }, { ...snapshot, receivedAt: new Date().toISOString() }, { upsert: true });
}
