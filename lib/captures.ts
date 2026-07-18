import { getDb } from "./db";
import type { Capture } from "./data";
import type { InboxInput } from "./inbox";

function captures() {
  return getDb().then((db) => db.collection<Capture>("captures"));
}

// Unique only when externalId exists, so manual captures never collide on null.
export async function ensureCaptureIndexes(): Promise<void> {
  const col = await captures();
  await col.createIndex(
    { "source.kind": 1, "source.externalId": 1 },
    { unique: true, partialFilterExpression: { "source.externalId": { $exists: true } } },
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

// One retry converges after a lost upsert race: the winner's document exists by
// the time the loser retries, so the second attempt takes the update path.
// Anything but a duplicate-key error (code 11000) — and a second consecutive
// 11000 — propagates unchanged.
export async function withDuplicateKeyRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return fn();
    throw err;
  }
}

export async function createOrUpdateCapture(
  input: InboxInput,
): Promise<{ capture: Capture; created: boolean }> {
  const col = await captures();
  const now = nowIso();

  // Dedup path: a connector re-post updates the existing capture in place.
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
    return { capture: res.value as Capture, created };
  }

  // Manual path: always a new document.
  const capture: Capture = {
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
  await col.insertOne(capture);
  return { capture, created: true };
}

export async function listCaptures(
  filter: Partial<Pick<Capture, "status">> = {},
): Promise<Capture[]> {
  const col = await captures();
  return col
    .find(filter, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getCapture(id: string): Promise<Capture | null> {
  const col = await captures();
  return col.findOne({ id }, { projection: { _id: 0 } });
}

// Triage: a capture becomes a Version. Status flips to "promoted" and the version
// slug is appended ($addToSet keeps it idempotent across re-promotes of the same slug).
export async function markCapturePromoted(id: string, versionSlug: string): Promise<void> {
  const col = await captures();
  await col.updateOne(
    { id },
    { $set: { status: "promoted", updatedAt: nowIso() }, $addToSet: { promotedTo: versionSlug } },
  );
}

// Triage: explicitly drop a capture from the inbox.
export async function discardCapture(id: string): Promise<void> {
  const col = await captures();
  await col.updateOne({ id }, { $set: { status: "discarded", updatedAt: nowIso() } });
}
