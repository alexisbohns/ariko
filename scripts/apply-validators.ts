import { getDb, closeDb } from "../lib/db";
import { ensureCaptureIndexes } from "../lib/captures";
import { ensureAtomicIndexes } from "../lib/atomic";

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
      // Text since C1: plain string or { en?, fr? } — mirrors lib/inbox.ts normalizeTextInput.
      title: {
        oneOf: [
          { bsonType: "string" },
          {
            bsonType: "object",
            properties: { en: { bsonType: "string" }, fr: { bsonType: "string" } },
            additionalProperties: false,
          },
        ],
      },
      status: { enum: ["inbox", "promoted", "discarded"] },
      source: {
        bsonType: "object",
        required: ["kind"],
        properties: { kind: { bsonType: "string" } },
      },
    },
  });

  // versions has a $jsonSchema, so G2 extends it: relations[] stays optional
  // (absent is valid), but every present entry must carry kind + ref strings.
  await applyValidator("versions", {
    bsonType: "object",
    properties: {
      state: { enum: ["draft", "private", "published"] },
      relations: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["kind", "ref"],
          properties: {
            kind: { bsonType: "string" },
            ref: { bsonType: "string" },
          },
        },
      },
    },
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

  await ensureAtomicIndexes();
  console.log("atomic indexes ensured");

  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
