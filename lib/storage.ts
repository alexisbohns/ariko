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

export const cloudinaryStorage: Storage = {
  async uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage> {
    const dataUri = `data:application/octet-stream;base64,${bytes.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "beanstalk",
      resource_type: "image",
      ...(filename ? { public_id: filename.replace(/\.[^.]+$/, "") } : {}),
    });
    return toMediaImage(result as CloudinaryResult);
  },
};

// Convenience for route handlers; swappable in tests by importing cloudinaryStorage directly.
export function uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage> {
  return cloudinaryStorage.uploadImage(bytes, filename);
}
