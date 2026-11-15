// lib/articles-assets.ts
//
// One image per request, uploaded server-side (spec 2026-11-14 §3.2). One per
// request because Vercel caps a request body at ~4.5 MB; server-side because
// the Cloudinary credential never leaves Ariko (CLAUDE.md, "Images upload
// through uploadImageAction, never from the browser to a third party" — the
// same rule, for a repo instead of a browser). The same checkUploadFile the
// admin picker uses: 4 MB, raster only. SVG is the one exception and takes its
// own branch: lib/svg-check.ts judges it (refuses, never strips) and what is
// stored is its re-serialized output, not the posted bytes. An SVG URL is
// usable only as a figure's image (lib/article-images.ts), never a cover or
// inline image.
//
// Not tied to an article: an asset uploaded for a draft that is never posted is
// an orphan, which `npm run check:orphans` sweeps. The skill uploads only after
// the maintainer approves, which keeps that rare.

import { checkSvg, MAX_SVG_BYTES } from "./svg-check";
import { checkUploadFile, uploadedFilename } from "./upload-input";
import type { MediaImage } from "./data";
import type { RepoAuth } from "./repo-token-store";

export interface AssetDeps {
  authorize: (header: string | null) => Promise<RepoAuth>;
  upload: (bytes: Buffer, filename?: string) => Promise<MediaImage>;
  uploadSvg: (svg: Buffer, filename?: string) => Promise<MediaImage>;
}

export async function handleAssetUpload(request: Request, deps: AssetDeps): Promise<Response> {
  const repo = await deps.authorize(request.headers.get("authorization"));
  if (!repo.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "body must be multipart/form-data with a file field" }, { status: 400 });
  }
  if (!(file instanceof Blob)) return Response.json({ error: "no file was sent (field name: file)" }, { status: 400 });

  if (file.type === "image/svg+xml") {
    // Size first, so a huge body is refused before it is read into memory.
    if (file.size > MAX_SVG_BYTES) {
      return Response.json({ error: `svg refused: too large (max ${MAX_SVG_BYTES / 1024 / 1024}MB)` }, { status: 400 });
    }
    const svg = checkSvg(Buffer.from(await file.arrayBuffer()));
    if (!svg.ok) return Response.json({ error: svg.error }, { status: 400 });
    try {
      const media = await deps.uploadSvg(Buffer.from(svg.svg), uploadedFilename(file));
      return Response.json({ url: media.url, width: media.width, height: media.height });
    } catch (err) {
      console.error(`[articles/assets] svg upload failed for plant ${repo.plant}`, err);
      return Response.json({ error: "upload failed" }, { status: 502 });
    }
  }

  const check = checkUploadFile({ size: file.size, type: file.type });
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  try {
    const media = await deps.upload(Buffer.from(await file.arrayBuffer()), uploadedFilename(file));
    return Response.json({ url: media.url, width: media.width, height: media.height });
  } catch (err) {
    console.error(`[articles/assets] upload failed for plant ${repo.plant}`, err);
    // The provider's message stays in the log: it can carry account detail.
    return Response.json({ error: "upload failed" }, { status: 502 });
  }
}
