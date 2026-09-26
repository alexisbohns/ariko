/**
 * The images a manifest points at, checked before anything is written and
 * uploaded only for the entities the plan will actually give them to.
 *
 * Kept apart from `lib/garden-manifest.ts` for the same reason that file is
 * apart from `lib/garden-plan.ts`: the manifest validator is pure and reports
 * what is wrong with the AUTHOR's text; this module is the first thing in the
 * planting flow that looks at the DISK and the first that talks to storage.
 * Both dependencies are injected — a `stat`-and-`read` pair and an uploader —
 * so the decisions here (which files, which entities, in what order) are
 * tested with two fakes and no Cloudinary.
 *
 * TWO RULES, each of which typechecks while becoming false:
 *
 *  - EVERY FILE IS CHECKED BEFORE ANY UPLOAD. A manifest naming twelve images
 *    of which the ninth is missing must fail with nothing minted in storage
 *    and nothing written in Mongo — the same "whole file first" promise the
 *    validator makes, extended to the disk. `checkAssets` runs to completion
 *    over every path before `uploadAssets` sees one.
 *  - AN IMAGE IS NEVER REPLACED ON `--update`. A cover the maintainer chose
 *    in the admin is a decision; a re-plant that overwrote it with the
 *    manifest's would undo it silently, on a routine run. So an update writes
 *    an image only where the entity has NONE, and `assetsNeeded` is what
 *    decides that — the applier only ever asks the map for what it was told
 *    is needed.
 */
import type { MediaImage, Bean, Sprout } from "./data";
import type { GardenManifest, ManifestImage } from "./garden-manifest";
import { imageMimeType } from "./garden-manifest";
import type { GardenSlugs, PlanAction } from "./garden-plan";
import { checkUploadFile } from "./upload-input";

/** What this module needs from the disk: enough to size a file and read it. */
export interface AssetFs {
  /** Byte size, or null when the file does not exist or is not a regular file. */
  size(path: string): number | null;
  read(path: string): Buffer;
}

export interface AssetUploader {
  uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage>;
}

/** Every image path a manifest names, de-duplicated, in first-mention order. */
export function collectAssets(manifest: GardenManifest): ManifestImage[] {
  const seen = new Map<string, ManifestImage>();
  for (const bean of manifest.beans) {
    if (bean.cover && !seen.has(bean.cover.file)) seen.set(bean.cover.file, bean.cover);
    for (const sprout of bean.sprouts) {
      for (const image of sprout.media ?? []) {
        if (!seen.has(image.file)) seen.set(image.file, image);
      }
    }
  }
  return [...seen.values()];
}

/**
 * Resolve a manifest-relative path against the manifest's directory. Written
 * with plain string joining rather than `node:path` so the module stays
 * importable where `node:path` is not (the validator's tests run it too).
 */
export function resolveAsset(baseDir: string, file: string): string {
  const base = baseDir.replace(/[\\/]+$/, "");
  return base ? `${base}/${file}` : file;
}

export type AssetCheck = { ok: true } | { ok: false; error: string };

/**
 * Every named file exists, is a raster we accept, and fits the upload door's
 * size limit — the SAME `checkUploadFile` the admin picker and the machine
 * route use, so the three doors agree on what an image is.
 */
export function checkAssets(manifest: GardenManifest, baseDir: string, fs: AssetFs): AssetCheck {
  for (const image of collectAssets(manifest)) {
    const path = resolveAsset(baseDir, image.file);
    const size = fs.size(path);
    if (size === null) return { ok: false, error: `image not found: ${image.file} (looked at ${path})` };
    const type = imageMimeType(image.file) ?? "";
    const check = checkUploadFile({ size, type });
    if (!check.ok) return { ok: false, error: `image ${image.file}: ${check.error}` };
  }
  return { ok: true };
}

/**
 * The files the applier will actually need, given the plan and the garden it
 * was planned against: a cover for a bean being CREATED, or being updated
 * while it has no cover; media for a sprout being created, or updated while
 * it has none. A `skip` needs nothing, and an entity that already carries an
 * image keeps it.
 */
export function assetsNeeded(plan: PlanAction[], garden: GardenSlugs): ManifestImage[] {
  const beanBySlug = new Map<string, Bean>(garden.beans.map((b) => [b.slug, b]));
  const sproutBySlug = new Map<string, Sprout>(garden.sprouts.map((s) => [s.slug, s]));
  const seen = new Map<string, ManifestImage>();
  const want = (image: ManifestImage) => {
    if (!seen.has(image.file)) seen.set(image.file, image);
  };

  for (const action of plan) {
    if (action.action === "skip") continue;
    if (action.tier === "bean" && action.entry.cover) {
      const existing = beanBySlug.get(action.slug);
      if (action.action === "create" || !existing?.cover) want(action.entry.cover);
    }
    if (action.tier === "sprout" && action.entry.media?.length) {
      const existing = sproutBySlug.get(action.slug);
      if (action.action === "create" || !(existing?.media?.length)) {
        for (const image of action.entry.media) want(image);
      }
    }
  }
  return [...seen.values()];
}

/** Uploaded images keyed by the manifest's own path, so the applier can look one up by what the author wrote. */
export type UploadedAssets = Map<string, MediaImage>;

/**
 * Upload each needed file once. Sequential on purpose: a manifest names a
 * handful of screenshots, not a gallery, and one failure mid-way should leave
 * a short, legible list of what was minted rather than a burst of parallel
 * half-results.
 */
export async function uploadAssets(
  images: ManifestImage[],
  baseDir: string,
  fs: AssetFs,
  uploader: AssetUploader,
): Promise<UploadedAssets> {
  const out: UploadedAssets = new Map();
  for (const image of images) {
    const path = resolveAsset(baseDir, image.file);
    const filename = image.file.split(/[\\/]/).pop();
    const uploaded = await uploader.uploadImage(fs.read(path), filename);
    out.set(image.file, image.alt ? { ...uploaded, alt: image.alt } : uploaded);
  }
  return out;
}

/** The uploaded image for a manifest path, or a loud failure — a miss here is a bug in the flow, not the author's file. */
export function uploadedFor(assets: UploadedAssets, image: ManifestImage): MediaImage {
  const found = assets.get(image.file);
  if (!found) throw new Error(`no uploaded asset for ${image.file} — was it in assetsNeeded()?`);
  return found;
}
