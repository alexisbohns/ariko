/**
 * The Cloudinary sweep (issue #76).
 *
 * Lists every asset under the upload folder that NO document references — no
 * `screens.image.storageKey`, no `beans.cover.storageKey`, no
 * `plants.logo.storageKey`, no `sprouts.media[].storageKey` — and reports them.
 * It deletes nothing unless you pass --delete, because an unreferenced-LOOKING
 * asset is exactly the thing worth eyeballing before it stops existing.
 *
 * Usage:
 *   npm run check:orphans                 # report
 *   npm run check:orphans -- --delete     # report, then remove
 *   npm run check:orphans -- --folder beanstalk/scratch
 *
 * Exit codes: 0 nothing to do (or everything deleted), 1 orphans found and
 * left in place, 2 usage/connection error. The 1 is deliberate: this is a
 * CHECK, so "there is something here" is a non-zero answer.
 *
 * WHY THIS EXISTS AT ALL — lib/storage.ts refuses to derive a public_id from a
 * filename (deriving one once overwrote an asset a published sprout pointed
 * at), so every upload mints a fresh id and replacing an image leaves the
 * previous one behind rather than overwriting it. Orphans are the standing
 * cost of that trade, not a bug in it.
 *
 * The arithmetic is NOT here. lib/orphan-assets.ts owns the four homes a
 * storageKey can live in and the set difference, with unit tests, because the
 * failure mode of missing one home is an asset something still renders being
 * reported as unreferenced and then deleted. This file is the I/O around it.
 */

import { v2 as cloudinary } from "cloudinary";
import { getDb, closeDb } from "../lib/db";
import { UPLOAD_FOLDER } from "../lib/storage";
import {
  orphanAssets,
  referencedStorageKeys,
  type AssetHolders,
  type StoredAsset,
} from "../lib/orphan-assets";

const args = process.argv.slice(2);
const doDelete = args.includes("--delete");
const folderFlag = args.indexOf("--folder");
const folder = folderFlag >= 0 ? args[folderFlag + 1] : UPLOAD_FOLDER;

if (folderFlag >= 0 && !folder) {
  console.error("usage: check-orphan-assets [--folder <prefix>] [--delete]");
  process.exit(2);
}

interface CloudinaryResource {
  public_id: string;
  created_at?: string;
  bytes?: number;
  filename?: string;
  context?: { custom?: Record<string, string> };
}

/** Every asset under `prefix`, following Cloudinary's cursor to the end. */
async function listAssets(prefix: string): Promise<StoredAsset[]> {
  const assets: StoredAsset[] = [];
  let cursor: string | undefined;
  do {
    const page = (await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix,
      max_results: 500,
      context: true,
      ...(cursor ? { next_cursor: cursor } : {}),
    })) as { resources: CloudinaryResource[]; next_cursor?: string };

    for (const r of page.resources) {
      assets.push({
        publicId: r.public_id,
        // uploadOptions() stores the uploader's filename under context; a
        // hand-uploaded asset has only Cloudinary's own. Report context only —
        // lib/orphan-assets.ts never matches on it.
        originalFilename: r.context?.custom?.original_filename ?? r.filename,
        createdAt: r.created_at,
        bytes: r.bytes,
      });
    }
    cursor = page.next_cursor;
  } while (cursor);
  return assets;
}

/** The four collections that can hold a storage key, read whole but thin. */
async function loadHolders(): Promise<AssetHolders> {
  const db = await getDb();
  const [screens, beans, plants, sprouts] = await Promise.all([
    db.collection("screens").find({}, { projection: { image: 1, _id: 0 } }).toArray(),
    db.collection("beans").find({}, { projection: { cover: 1, _id: 0 } }).toArray(),
    db.collection("plants").find({}, { projection: { logo: 1, _id: 0 } }).toArray(),
    db.collection("sprouts").find({}, { projection: { media: 1, _id: 0 } }).toArray(),
  ]);
  return { screens, beans, plants, sprouts } as AssetHolders;
}

function human(bytes: number | undefined): string {
  if (typeof bytes !== "number") return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function main(): Promise<number> {
  if (!process.env.CLOUDINARY_URL) {
    console.error("CLOUDINARY_URL is not set");
    return 2;
  }

  const [assets, holders] = await Promise.all([listAssets(folder), loadHolders()]);
  const referenced = referencedStorageKeys(holders);
  const orphans = orphanAssets(assets, referenced);

  console.log(
    `${assets.length} asset(s) under ${folder}/ — ${referenced.size} key(s) referenced by the garden.`,
  );

  if (orphans.length === 0) {
    console.log("Nothing unreferenced. ✓");
    return 0;
  }

  console.log(`\n${orphans.length} unreferenced asset(s):`);
  for (const o of orphans) {
    const context = [o.originalFilename, o.createdAt?.slice(0, 10), human(o.bytes)]
      .filter(Boolean)
      .join("  ");
    console.log(`  ${o.publicId}${context ? `  (${context})` : ""}`);
  }

  if (!doDelete) {
    console.log("\nNothing deleted. Re-run with --delete to remove them.");
    return 1;
  }

  // Cloudinary's delete_resources takes at most 100 ids per call.
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += 100) {
    const batch = orphans.slice(i, i + 100).map((o) => o.publicId);
    const result = (await cloudinary.api.delete_resources(batch)) as {
      deleted?: Record<string, string>;
    };
    for (const [id, outcome] of Object.entries(result.deleted ?? {})) {
      if (outcome === "deleted") deleted += 1;
      else console.error(`  ${id}: ${outcome}`);
    }
  }
  console.log(`\nDeleted ${deleted} of ${orphans.length}.`);
  return deleted === orphans.length ? 0 : 1;
}

main()
  .then(async (code) => {
    await closeDb();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await closeDb();
    process.exit(2);
  });
