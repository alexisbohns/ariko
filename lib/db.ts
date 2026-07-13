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
    const client = new MongoClient(uri);
    globalForMongo.__mongoConn = client
      .connect()
      .then((c) => ({ client: c, db: c.db(process.env.MONGODB_DB ?? "beanstalk") }));
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
