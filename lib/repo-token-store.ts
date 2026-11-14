// lib/repo-token-store.ts
//
// Mongo half of the per-repo tokens (spec 2026-11-14 §2). One live token per
// pod: minting revokes the previous one in the same call. The collection holds
// hashes only — a lost token is re-minted, never recovered.
//
// authorizeRepo answers every refusal identically ({ ok: false } → 401 with
// one body), so a caller cannot tell a revoked token from a mistyped one. A
// bearer that does not look like a repo token is refused WITHOUT a database
// read: the legacy ARTICLES_TOKEN path in app/api/articles/route.ts falls
// through to its own check, and must keep working with no database at all.

import { getDb } from "./db";
import { generateToken, hashToken, looksLikeRepoToken } from "./repo-token";

export interface RepoToken {
  pod: string;
  hash: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

// Indexes are ensured once per process; a rejection resets so the next call retries.
let indexes: Promise<void> | null = null;

async function tokens() {
  const db = await getDb();
  const col = db.collection<RepoToken>("tokens");
  indexes ??= Promise.all([
    col.createIndex({ hash: 1 }, { unique: true }),
    col.createIndex({ pod: 1 }),
  ]).then(
    () => undefined,
    (err) => {
      indexes = null;
      throw err;
    },
  );
  await indexes;
  return { db, col };
}

// Concurrent mints for one pod can race and leave two live tokens; minting is
// CLI-only, so that is accepted.
export async function mintToken(pod: string, label: string): Promise<string> {
  const { db, col } = await tokens();
  const exists = await db.collection("pods").findOne({ slug: pod }, { projection: { _id: 1 } });
  if (!exists) throw new Error(`unknown pod: ${pod}`);
  const now = new Date().toISOString();
  await col.updateMany({ pod, revokedAt: { $exists: false } }, { $set: { revokedAt: now } });
  const token = generateToken(pod);
  await col.insertOne({ pod, hash: hashToken(token), label, createdAt: now });
  return token;
}

export async function revokePod(pod: string): Promise<number> {
  const { col } = await tokens();
  const res = await col.updateMany(
    { pod, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date().toISOString() } },
  );
  return res.modifiedCount;
}

export async function listTokens(): Promise<Omit<RepoToken, "hash">[]> {
  const { col } = await tokens();
  return col
    .find({}, { projection: { _id: 0, hash: 0 } })
    .sort({ pod: 1, createdAt: -1 })
    .toArray() as Promise<Omit<RepoToken, "hash">[]>;
}

export type RepoAuth = { ok: true; pod: string } | { ok: false };

export async function authorizeRepo(header: string | null): Promise<RepoAuth> {
  if (!header?.startsWith("Bearer ")) return { ok: false };
  const token = header.slice("Bearer ".length).trim();
  if (!looksLikeRepoToken(token)) return { ok: false };
  const { col } = await tokens();
  const doc = await col.findOne({ hash: hashToken(token), revokedAt: { $exists: false } });
  if (!doc) return { ok: false };
  // Best effort: a failed timestamp must not refuse an authorized request, and
  // the write may be lost when a serverless instance freezes after responding.
  col.updateOne({ hash: doc.hash }, { $set: { lastUsedAt: new Date().toISOString() } }).catch(() => {});
  return { ok: true, pod: doc.pod };
}
