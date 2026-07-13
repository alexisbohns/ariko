import { getDb, closeDb } from "../lib/db";
import { ensureCaptureIndexes } from "../lib/captures";

// Applies a $jsonSchema validator to a collection, creating it if absent.
// Idempotent: safe to re-run. validationLevel "moderate" only validates inserts
// and updates to already-valid docs, so existing data is never retroactively rejected.
async function applyValidator(name: string, schema: object): Promise<void> {
  const db = await getDb();
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name, {
      validator: { $jsonSchema: schema },
      validationLevel: "moderate",
    });
  } else {
    await db.command({
      collMod: name,
      validator: { $jsonSchema: schema },
      validationLevel: "moderate",
    });
  }
  console.log(`validator applied: ${name}`);
}

async function main() {
  await applyValidator("captures", {
    bsonType: "object",
    required: ["id", "title", "source", "status"],
    properties: {
      id: { bsonType: "string" },
      title: { bsonType: "string" },
      status: { enum: ["inbox", "promoted", "discarded"] },
      source: {
        bsonType: "object",
        required: ["kind"],
        properties: { kind: { bsonType: "string" } },
      },
    },
  });

  await applyValidator("versions", {
    bsonType: "object",
    properties: { state: { enum: ["draft", "private", "published"] } },
  });

  await applyValidator("molecules", {
    bsonType: "object",
    properties: { visibility: { enum: ["private", "public"] } },
  });

  await applyValidator("atoms", {
    bsonType: "object",
    properties: { visibility: { enum: ["private", "public"] } },
  });

  await ensureCaptureIndexes();
  console.log("capture indexes ensured");

  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
