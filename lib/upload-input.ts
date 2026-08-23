// The one size/type guard for image uploads, shared by both doors: the admin's
// uploadImageAction (app/admin/actions.ts) and the machine route
// (app/api/upload/route.ts), which had no size check at all before this.

// Matches next.config.ts's serverActions.bodySizeLimit. Vercel's own platform
// ceiling is 4.5MB for a route handler and a server action alike, so this is a
// floor set by the platform rather than a preference — it exists so an
// oversized file is refused with a real message instead of arriving as an
// opaque 413.
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
