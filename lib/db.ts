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
    // serverSelectionTimeoutMS bounds CHOOSING a server (30 s by default,
    // which is how an outage came to hold a request for half a minute before
    // failing it) — kept aggressive at 5 s. connectTimeoutMS bounds the TCP +
    // TLS handshake to the server once chosen; 10 s gives a cold Vercel
    // container room for SRV + TLS + SCRAM against Atlas, where 5 s is the
    // tight end. socketTimeoutMS bounds an in-flight operation on an
    // ALREADY-selected connection — it defaults to infinite, so without it a
    // connection that blackholes mid-query (selection already having
    // succeeded) would hang forever regardless of the other two; set to match
    // connectTimeoutMS.
    //
    // None of this is airtight: `mongodb+srv://` DNS resolution happens
    // before server selection even starts, and isn't fully bounded by any of
    // these three. With a warm Data Cache the public zone never reaches this
    // code at all — it renders stale from the cached garden — so this mostly
    // applies to a cold cache and to the admin, where a fast error beats a
    // long hang.
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 10_000,
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
