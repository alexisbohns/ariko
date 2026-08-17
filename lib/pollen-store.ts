import { createHash } from "node:crypto";
import type { UpdateFilter } from "mongodb";
import { getDb } from "./db";
import type { Bean } from "./data";
import type { PollenDoc, PollenSink, StoredRefusal } from "./pollen-sync";
import { deriveProjectedBeans } from "./projected-beans";

// Mongo glue for the read model (spec §3). The cache is disposable: every
// write here is derivable from the feeds; deleteFeedData + sync rebuilds it.

export interface CursorDoc {
  feedId: string;
  cursor: string | null;
  lastSyncAt: string;
  lastStatus: "ok" | "rebuilding" | "error";
  lastError?: string;
}

export interface RefusalDoc {
  feedId: string;
  at: string;
  reason: string;
  raw: string;
  rawHash: string; // sha256 hex of raw — the dedupe key (raw itself is too big to index)
}

export async function ensurePollenIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("pollen").createIndex({ id: 1 }, { unique: true });
  await db.collection("pollen").createIndex({ at: -1 });
  await db.collection("pollen").createIndex({ "anchors.plant": 1 });
  await db.collection("pollen_cursors").createIndex({ feedId: 1 }, { unique: true });
  await db.collection("pollen_refusals").createIndex({ feedId: 1, rawHash: 1 }, { unique: true });
  // projectBeans' race-safety rides this unique index; own it here instead of
  // inheriting it from the one-off migrate-garden script.
  await db.collection("beans").createIndex({ slug: 1 }, { unique: true });
}

export function makeSink(exhibit: string[]): PollenSink {
  return {
    async getCursor(feedId) {
      const db = await getDb();
      const doc = await db.collection<CursorDoc>("pollen_cursors").findOne({ feedId });
      return doc?.cursor ?? null;
    },
    async setCursor(feedId, cursor, status, error) {
      const db = await getDb();
      const update: UpdateFilter<CursorDoc> = {
        $set: {
          cursor,
          lastSyncAt: new Date().toISOString(),
          lastStatus: status,
          ...(error ? { lastError: error } : {}),
        },
        $setOnInsert: { feedId },
        // Clearing on recovery matters: without it a feed that errored once
        // would show a stale lastError in the admin forever.
        ...(error ? {} : { $unset: { lastError: "" } }),
      };
      await db.collection<CursorDoc>("pollen_cursors").updateOne({ feedId }, update, { upsert: true });
    },
    async insertNew(feedId, envelopes) {
      // Write-once by id ($setOnInsert): envelopes are immutable, a re-seen
      // id is a no-op — replay after a 410 rebuild converges instead of duping.
      const db = await getDb();
      const syncedAt = new Date().toISOString();
      const res = await db.collection<PollenDoc>("pollen").bulkWrite(
        envelopes.map((e) => ({
          updateOne: {
            filter: { id: e.id },
            update: { $setOnInsert: { ...e, feedId, syncedAt } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      return res.upsertedCount;
    },
    async recordRefusals(feedId, refusals: StoredRefusal[]) {
      // Deduped by content hash so a re-synced malformed line doesn't grow
      // the collection every run; surfaced on /admin/beanstalk, never fatal.
      const db = await getDb();
      const at = new Date().toISOString();
      await db.collection<RefusalDoc>("pollen_refusals").bulkWrite(
        refusals.map((r) => {
          const rawHash = createHash("sha256").update(r.raw).digest("hex");
          return {
            updateOne: {
              filter: { feedId, rawHash },
              update: { $setOnInsert: { feedId, at, reason: r.reason, raw: r.raw, rawHash } },
              upsert: true,
            },
          };
        }),
        { ordered: false },
      );
    },
    async projectBeans(feedId, envelopes) {
      const db = await getDb();
      // Full slug scan is deliberate: fresh per page, so page N sees page
      // N-1's projections and cross-page batches converge.
      const existing = new Set(
        (await db.collection<Bean>("beans").find({}, { projection: { _id: 0, slug: 1 } }).toArray()).map(
          (b) => b.slug,
        ),
      );
      const beans = deriveProjectedBeans(envelopes, existing, new Set(exhibit), feedId);
      if (beans.length === 0) return 0;
      // $setOnInsert on slug: authored-or-prior always wins, write-once.
      const res = await db.collection<Bean>("beans").bulkWrite(
        beans.map((b) => ({
          updateOne: { filter: { slug: b.slug }, update: { $setOnInsert: b }, upsert: true },
        })),
        { ordered: false },
      );
      return res.upsertedCount;
    },
  };
}

export async function listPollen(): Promise<PollenDoc[]> {
  const db = await getDb();
  return db.collection<PollenDoc>("pollen").find({}, { projection: { _id: 0 } }).sort({ at: -1 }).toArray();
}

export async function listCursors(): Promise<CursorDoc[]> {
  const db = await getDb();
  return db.collection<CursorDoc>("pollen_cursors").find({}, { projection: { _id: 0 } }).sort({ feedId: 1 }).toArray();
}

export async function listRefusals(limit = 20): Promise<RefusalDoc[]> {
  const db = await getDb();
  return db
    .collection<RefusalDoc>("pollen_refusals")
    .find({}, { projection: { _id: 0 } })
    .sort({ at: -1 })
    .limit(limit)
    .toArray();
}

// Full rebuild, step 1 (spec §3): wipe everything derived from one feed —
// envelopes, cursor, refusals, projected beans. Step 2 is an ordinary sync.
export async function deleteFeedData(feedId: string): Promise<void> {
  const db = await getDb();
  await db.collection("pollen").deleteMany({ feedId });
  await db.collection("pollen_cursors").deleteOne({ feedId });
  await db.collection("pollen_refusals").deleteMany({ feedId });
  await db.collection("beans").deleteMany({ "projected.feedId": feedId });
}
