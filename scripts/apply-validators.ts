import { getDb, closeDb } from "../lib/db";
import { ensureSeedIndexes } from "../lib/seeds";
import { ensureBotanicalIndexes } from "../lib/botanical";

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
  await applyValidator("seeds", {
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
  await applyValidator("sprouts", {
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

  await applyValidator("pods", {
    bsonType: "object",
    properties: { visibility: { enum: ["private", "public"] } },
  });

  await applyValidator("beans", {
    bsonType: "object",
    properties: { visibility: { enum: ["private", "public"] } },
  });

  await ensureSeedIndexes();
  console.log("capture indexes ensured");

  await ensureBotanicalIndexes();
  console.log("atomic indexes ensured");

  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
