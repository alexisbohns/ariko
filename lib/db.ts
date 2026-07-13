import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

// Cached across hot reloads / requests. Throws clearly if the URI is missing.
export async function getDb(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB ?? "beanstalk");
  return db;
}

// Closes the cached connection so long-lived clients (e.g. test runners) can
// exit cleanly. No-op when nothing is connected.
export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
