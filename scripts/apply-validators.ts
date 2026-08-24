import { getDb, closeDb } from "../lib/db";
import { ensureSeedIndexes } from "../lib/seeds";
import { ensureBotanicalIndexes } from "../lib/botanical";
import { ensurePollenIndexes } from "../lib/pollen-store";
import { PLANT_ROLE_KINDS } from "../lib/plant-role";
import { PLANT_STATUSES } from "../lib/plant-status";

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

  // `role` is REQUIRED here, not just in TypeScript — that is the whole point
  // of requiring it. Run scripts/backfill-plant-roles.ts BEFORE this, so no
  // write can be rejected mid-flight. `title` and `detail` stay unconstrained:
  // Text is `string | { en?, fr? }`, exactly how `name` and `description` are
  // (not) constrained today.
  await applyValidator("plants", {
    bsonType: "object",
    required: ["role"],
    properties: {
      visibility: { enum: ["private", "public"] },
      natures: { bsonType: "array", items: { enum: ["work", "tool"] } },
      role: {
        bsonType: "object",
        required: ["kind"],
        properties: { kind: { enum: [...PLANT_ROLE_KINDS] } },
      },
      // NOT added to `required` above, unlike `role` — absence is a valid and
      // meaningful state here (it reads as "active"), which is what lets this
      // ship with no backfill.
      status: { enum: [...PLANT_STATUSES] },
      // Constrained to an image, which is the whole reason `logo` is a single
      // MediaImage rather than a Media[]: the database refuses an embed here,
      // not just the picker.
      logo: {
        bsonType: "object",
        required: ["kind", "storageKey", "url"],
        properties: {
          kind: { enum: ["image"] },
          storageKey: { bsonType: "string" },
          url: { bsonType: "string" },
        },
      },
      relations: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["kind", "ref"],
          properties: { kind: { bsonType: "string" }, ref: { bsonType: "string" } },
        },
      },
    },
  });

  await applyValidator("bees", {
    bsonType: "object",
    required: ["slug", "kind", "status"],
    properties: {
      slug: { bsonType: "string" },
      kind: { enum: ["adapter", "routine", "workflow", "capability"] },
      status: { enum: ["planned", "live", "paused", "broken"] },
      visibility: { enum: ["private", "public"] },
      serves: { bsonType: "array", items: { bsonType: "string" } },
      levers: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["label"],
          properties: {
            label: { bsonType: "string" },
            url: { bsonType: "string" },
            ref: { bsonType: "string" },
          },
        },
      },
    },
  });

  // Read-model cache (slice 4). Moderate level, like everything else: the
  // cache is disposable, so a validator here is a tripwire, not a migration.
  await applyValidator("pollen", {
    bsonType: "object",
    required: ["v", "id", "at", "source", "kind", "title", "anchors", "feedId", "syncedAt"],
    properties: {
      v: { bsonType: "number" },
      id: { bsonType: "string" },
      at: { bsonType: "string" },
      source: { bsonType: "string" },
      kind: { bsonType: "string" },
      anchors: {
        bsonType: "object",
        required: ["plant"],
        properties: { plant: { bsonType: "string" } },
      },
      visibility: { enum: ["public", "private"] },
      feedId: { bsonType: "string" },
      syncedAt: { bsonType: "string" },
    },
  });
  await applyValidator("pollen_cursors", {
    bsonType: "object",
    required: ["feedId", "lastSyncAt", "lastStatus"],
    properties: {
      feedId: { bsonType: "string" },
      cursor: { bsonType: ["string", "null"] },
      lastSyncAt: { bsonType: "string" },
      lastStatus: { bsonType: "string" },
    },
  });
  await applyValidator("pollen_refusals", {
    bsonType: "object",
    required: ["feedId", "at", "reason", "raw", "rawHash"],
    properties: {
      feedId: { bsonType: "string" },
      at: { bsonType: "string" },
      reason: { bsonType: "string" },
      raw: { bsonType: "string" },
      rawHash: { bsonType: "string" },
    },
  });

  await ensureSeedIndexes();
  console.log("seed indexes ensured");

  await ensureBotanicalIndexes();
  console.log("botanical indexes ensured");

  await ensurePollenIndexes();
  console.log("pollen indexes ensured");

  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
