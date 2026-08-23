import { v2 as cloudinary } from "cloudinary";
import type { MediaImage } from "./data";

export interface Storage {
  uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage>;
}

// Shape of the subset of the Cloudinary upload response we consume.
export interface CloudinaryResult {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
}

// Pure mapping — unit-tested without any network.
export function toMediaImage(result: CloudinaryResult): MediaImage {
  return {
    kind: "image",
    storageKey: result.public_id,
    url: result.secure_url,
    ...(typeof result.width === "number" ? { width: result.width } : {}),
    ...(typeof result.height === "number" ? { height: result.height } : {}),
  };
}

// Cloudinary reads CLOUDINARY_URL from the environment automatically; we opt
// into HTTPS URLs explicitly.
cloudinary.config({ secure: true });

// The folder uploads land in. Env-overridable so hands-on verification can
// target "beanstalk/scratch" and delete it afterwards (spec §7) — there is no
// scratch Cloudinary the way there is a scratch Mongo database.
export const UPLOAD_FOLDER = process.env.CLOUDINARY_FOLDER || "beanstalk";

/**
 * Pure. The options object handed to Cloudinary's uploader — extracted so the
 * one thing worth pinning here is testable without a network call.
 *
 * There is deliberately NO `public_id`. Deriving one from the filename (which
 * this did until 2026-08-23) is a silent data-loss bug: Cloudinary defaults
 * signed uploads to `overwrite: true`, and supplying an explicit public_id also
 * disables its `unique_filename` behaviour — so uploading a second
 * "Screenshot.png" replaced the first, including one a published sprout already
 * pointed at, leaving the stored URL resolving to different bytes. Letting
 * Cloudinary mint the id makes every upload a distinct asset. The original
 * name survives as non-identifying context.
 */
export function uploadOptions(folder: string, filename?: string): Record<string, unknown> {
  return {
    folder,
    resource_type: "image",
    ...(filename ? { context: { original_filename: filename } } : {}),
  };
}

export const cloudinaryStorage: Storage = {
  async uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage> {
    const dataUri = `data:application/octet-stream;base64,${bytes.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, uploadOptions(UPLOAD_FOLDER, filename));
    return toMediaImage(result as CloudinaryResult);
  },
};

// Convenience for route handlers; swappable in tests by importing cloudinaryStorage directly.
export function uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage> {
  return cloudinaryStorage.uploadImage(bytes, filename);
}
