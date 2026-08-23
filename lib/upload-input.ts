// The one size/type guard for image uploads, shared by both doors: the admin's
// uploadImageAction (app/admin/actions.ts) and the machine route
// (app/api/upload/route.ts), which had no size check at all before this.
//
// KEEP THIS MODULE DEPENDENCY-FREE. next.config.ts imports MAX_UPLOAD_BYTES
// from here, so anything this file pulls in is loaded while Next reads its
// config — before the app exists. An import that needs a server runtime,
// `server-only`, or an environment variable would stop the config from loading
// AT ALL, in every environment at once, which is a far worse failure than the
// one the constant below prevents. Constants and pure functions only.

// next.config.ts's serverActions.bodySizeLimit is set ABOVE this, deliberately
// — it bounds the whole multipart body (boundaries, headers, framing), not
// just the file, so it must have headroom over this constant or the platform
// could reject, with an opaque 413, a file this check accepts. Kept below
// Vercel's own 4.5MB platform ceiling, which applies to a route handler and a
// server action alike — this exists so an oversized file is refused with a
// real message instead of arriving as an opaque error.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Raster formats only. SVG is deliberately absent: it is an image the browser
// executes script from, and every real capture here is a raster.
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

export type UploadCheck = { ok: true } | { ok: false; error: string };

// Pure. Takes only what both callers can supply from a Blob/File.
export function checkUploadFile(file: { size: number; type: string }): UploadCheck {
  if (file.size <= 0) return { ok: false, error: "the file is empty" };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `the file is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)` };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: `${file.type || "that file"} is not a supported image` };
  }
  return { ok: true };
}

// A Blob has no name; a File does. Both doors receive `Blob` from FormData and
// need the original filename when it is there — recovered in one place so the
// cast lives once rather than at each door.
export function uploadedFilename(file: Blob): string | undefined {
  const name = (file as File).name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}
