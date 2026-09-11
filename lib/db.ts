import { MongoClient, type Db } from "mongodb";

// Cache the in-flight connect PROMISE on globalThis (not the resolved Db) so
// concurrent cold-start callers await the same connection instead of each
// opening — and orphaning — their own client. Next.js dev hot-reloads reuse
// the one promise; in production the module is evaluated once, so this behaves
// like a plain module singleton.
const globalForMongo = globalThis as unknown as {
  __mongoConn?: Promise<{ client: MongoClient; db: Db }>;
};

export async function getDb(): Promise<Db> {
  if (!globalForMongo.__mongoConn) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    // Both default to 30 s, which is how an outage came to hold a request for
    // half a minute before failing it. 5 s is the useful bound: with a warm
    // Data Cache the public zone never reaches this code at all — it renders
    // stale from the cached garden — so this applies only to a cold cache and
    // to the admin, where a fast error beats a long hang.
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
    });
    globalForMongo.__mongoConn = client
      .connect()
      .then((c) => ({ client: c, db: c.db(process.env.MONGODB_DB ?? "beanstalk") }))
      .catch((err) => {
        // Never cache a failed connection — let the next caller retry fresh.
        globalForMongo.__mongoConn = undefined;
        throw err;
      });
  }
  return (await globalForMongo.__mongoConn).db;
}

// Closes the cached connection so long-lived clients (e.g. test runners) can
// exit cleanly. No-op when nothing is connected.
export async function closeDb(): Promise<void> {
  const conn = globalForMongo.__mongoConn;
  if (conn) {
    globalForMongo.__mongoConn = undefined;
    const { client } = await conn;
    await client.close();
  }
}
