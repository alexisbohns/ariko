import type { Media, MediaImage } from "./data";

/**
 * Which stored assets nothing points at any more (issue #76).
 *
 * lib/storage.ts deliberately refuses to derive a Cloudinary `public_id` from a
 * filename — deriving one once silently overwrote an asset a published sprout
 * pointed at. So every upload mints a fresh id, and REPLACING an image always
 * leaves the previous one behind rather than overwriting it. That is the right
 * trade; the cost is that superseded assets accumulate and need an explicit
 * sweep. This is the arithmetic of that sweep, kept pure so `npm test` reaches
 * it: scripts/check-orphan-assets.ts is the I/O around it.
 *
 * The four places a `storageKey` can live are enumerated in one function rather
 * than four call sites, because the failure mode of missing one is the worst
 * available: an asset something still renders, reported as unreferenced and
 * then deleted. A fifth home for an image must be added HERE the day it exists
 * — the type of `AssetHolders` is what makes that a compile error rather than a
 * silent omission.
 */

export interface AssetHolders {
  /** `screens.image` — one image per screen, required. */
  screens: { image?: MediaImage | null }[];
  /** `beans.cover` — at most one. */
  beans: { cover?: MediaImage | null }[];
  /** `plants.logo` — at most one. */
  plants: { logo?: MediaImage | null }[];
  /** `sprouts.media[]` — mixed images and embeds; only images carry a key. */
  sprouts: { media?: Media[] | null }[];
}

function key(image: MediaImage | null | undefined): string | undefined {
  const k = image?.storageKey;
  return typeof k === "string" && k.trim() ? k.trim() : undefined;
}

/** Every storage key the garden still points at, from all four homes. */
export function referencedStorageKeys(holders: AssetHolders): Set<string> {
  const keys = new Set<string>();
  const add = (k: string | undefined) => {
    if (k) keys.add(k);
  };

  for (const screen of holders.screens) add(key(screen.image));
  for (const bean of holders.beans) add(key(bean.cover));
  for (const plant of holders.plants) add(key(plant.logo));
  for (const sprout of holders.sprouts) {
    for (const item of sprout.media ?? []) {
      if (item && item.kind === "image") add(key(item));
    }
  }
  return keys;
}

export interface StoredAsset {
  /** The Cloudinary public_id — the same string a `storageKey` holds. */
  publicId: string;
  /** The uploader's filename, kept as non-identifying context. For the report
   *  only: two assets can share it, so it is never matched on. */
  originalFilename?: string;
  createdAt?: string;
  bytes?: number;
}

/**
 * The assets under the folder that no document references, in the order the
 * provider listed them.
 *
 * Matching is on `publicId` alone and never on the filename, for the reason
 * lib/storage.ts gives for not deriving ids from filenames in the first place:
 * a filename identifies nothing.
 */
export function orphanAssets(assets: StoredAsset[], referenced: Set<string>): StoredAsset[] {
  return assets.filter((asset) => !referenced.has(asset.publicId));
}
