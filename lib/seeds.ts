import { getDb } from "./db";
import type { Seed } from "./data";
import type { InboxInput } from "./inbox";

function seedsCol() {
  return getDb().then((db) => db.collection<Seed>("seeds"));
}

// Unique only when externalId exists, so manual seeds never collide on null.
export async function ensureSeedIndexes(): Promise<void> {
  const col = await seedsCol();
  await col.createIndex(
    { "source.kind": 1, "source.externalId": 1 },
    { unique: true, partialFilterExpression: { "source.externalId": { $exists: true } } },
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

// Retries fn exactly once when it rejects with a Mongo duplicate-key error
// (code 11000); anything else — and a second consecutive 11000 — propagates
// unchanged. Safe for the dedup upsert below because one retry converges: the
// winner's document exists by the time the loser retries, so the second
// attempt takes the update path. (A plain insert would NOT converge this way.)
export async function withDuplicateKeyRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) return fn();
    throw err;
  }
}

export async function createOrUpdateSeed(
  input: InboxInput,
): Promise<{ seed: Seed; created: boolean }> {
  const col = await seedsCol();
  const now = nowIso();

  // Dedup path: a connector re-post updates the existing seed in place.
  if (input.source.externalId) {
    const set: Record<string, unknown> = {
      title: input.title,
      media: input.media,
      updatedAt: now,
      "source.kind": input.source.kind,
      "source.externalId": input.source.externalId,
    };
    if (input.source.url !== undefined) set["source.url"] = input.source.url;
    if (input.body !== undefined) set.body = input.body;
    if (input.content !== undefined) set.content = input.content;
    if (input.suggested !== undefined) set.suggested = input.suggested;

    const res = await withDuplicateKeyRetry(() =>
      col.findOneAndUpdate(
        { "source.kind": input.source.kind, "source.externalId": input.source.externalId },
        {
          $set: set,
          $setOnInsert: {
            id: crypto.randomUUID(),
            status: "inbox",
            promotedTo: [],
            createdAt: now,
            "source.capturedAt": input.source.capturedAt ?? now,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          includeResultMetadata: true,
          projection: { _id: 0 },
        },
      ),
    );
    const created = !res.lastErrorObject?.updatedExisting;
    return { seed: res.value as Seed, created };
  }

  // Manual path: always a new document.
  const seed: Seed = {
    id: crypto.randomUUID(),
    title: input.title,
    media: input.media,
    source: { ...input.source, capturedAt: input.source.capturedAt ?? now },
    status: "inbox",
    promotedTo: [],
    createdAt: now,
    updatedAt: now,
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.suggested !== undefined ? { suggested: input.suggested } : {}),
  };
  await col.insertOne(seed);
  return { seed, created: true };
}

export async function listSeeds(
  filter: Partial<Pick<Seed, "status">> = {},
): Promise<Seed[]> {
  const col = await seedsCol();
  return col
    .find(filter, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getSeed(id: string): Promise<Seed | null> {
  const col = await seedsCol();
  return col.findOne({ id }, { projection: { _id: 0 } });
}

// Triage: a seed becomes a Version. Status flips to "promoted" and the version
// slug is appended ($addToSet keeps it idempotent across re-promotes of the same slug).
export async function markSeedPromoted(id: string, versionSlug: string): Promise<void> {
  const col = await seedsCol();
  await col.updateOne(
    { id },
    { $set: { status: "promoted", updatedAt: nowIso() }, $addToSet: { promotedTo: versionSlug } },
  );
}

// Triage: explicitly drop a seed from the inbox.
export async function discardSeed(id: string): Promise<void> {
  const col = await seedsCol();
  await col.updateOne({ id }, { $set: { status: "discarded", updatedAt: nowIso() } });
}
