# Media, PR1 — creating images (B2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ariko a way to create images — a client-JS media picker on the admin capture bar and on `/admin/sprout/[slug]`, uploading through a new server action, plus an `/image` command in the prose editor.

**Architecture:** One pure `lib/` function per concern, sitting between a surface and `lib/botanical.ts`, exactly as `lib/content-edit.ts` and `lib/sprout-edit.ts` already do. A single client island (`MediaPicker`) serves both surfaces; it owns an ordered list of media and emits the **entire list** as repeated hidden JSON fields, so reorder and remove never cross the wire as operations. The picker renders nothing until it mounts, so script-off behaviour is unchanged.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript, MongoDB, Cloudinary, Tiptap 3.30.2, `node:test` + `tsx`.

**Spec:** [`../specs/2026-08-23-media-design.md`](../specs/2026-08-23-media-design.md) §4.

**Run the suite with:** `npm test` — a single test file with `node --import tsx --test lib/<name>.test.ts`.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/upload-input.ts` | **Create.** `MAX_UPLOAD_BYTES`, `checkUploadFile` — the one size/type guard, used by both upload doors |
| `lib/media-input.ts` | **Create.** `parseMediaField` — hidden-JSON fields → normalized `Media[]` |
| `lib/media-edit.ts` | **Create.** `buildMediaPatch` — pure, dirty-gated |
| `components/admin/media-picker.tsx` | **Create.** The client island |
| `lib/inbox.ts` | **Modify.** Extract `validateMediaEntry` so one definition serves both doors |
| `lib/storage.ts` | **Modify.** Stop deriving `public_id` from the filename (§4.6); folder from env |
| `lib/seed-form.ts` | **Modify.** Read the picker's `image` fields |
| `lib/botanical.ts` | **Modify.** Add `updateSproutMedia` — a sibling of `writeContent`, not a widening of `updateVersion` |
| `app/admin/actions.ts` | **Modify.** Add `uploadImageAction`, `editSproutMediaAction` |
| `app/api/upload/route.ts` | **Modify.** Adopt `checkUploadFile` |
| `app/admin/page.tsx` | **Modify.** Drop the picker into the capture form |
| `app/admin/sprout/[slug]/page.tsx` | **Modify.** Add the media card |
| `components/editor/editor-extensions.ts` | **Modify.** `buildBlocks(onInsertImage)`, `onInsertImage` option |
| `components/editor/prose-editor.tsx` | **Modify.** Hidden file input + upload + `setImage` |
| `next.config.ts` | **Modify.** `serverActions.bodySizeLimit` |
| `CLAUDE.md` | **Modify.** The second client-JS island and its rule |

---

## Task 1: The upload guard

**Files:**
- Create: `lib/upload-input.ts`
- Test: `lib/upload-input.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/upload-input.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_UPLOAD_BYTES, checkUploadFile } from "./upload-input";

test("accepts an ordinary image under the ceiling", () => {
  assert.deepEqual(checkUploadFile({ size: 1024, type: "image/png" }), { ok: true });
  assert.deepEqual(checkUploadFile({ size: 1024, type: "image/jpeg" }), { ok: true });
  assert.deepEqual(checkUploadFile({ size: 1024, type: "image/webp" }), { ok: true });
});

test("accepts a file exactly at the ceiling and rejects one byte over", () => {
  assert.equal(checkUploadFile({ size: MAX_UPLOAD_BYTES, type: "image/png" }).ok, true);
  const over = checkUploadFile({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" });
  assert.equal(over.ok, false);
  if (!over.ok) assert.match(over.error, /too large/);
});

test("rejects an empty file", () => {
  const empty = checkUploadFile({ size: 0, type: "image/png" });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /empty/);
});

test("rejects a non-image type", () => {
  const pdf = checkUploadFile({ size: 10, type: "application/pdf" });
  assert.equal(pdf.ok, false);
  if (!pdf.ok) assert.match(pdf.error, /not a supported image/);
});

// SVG is an image the browser will execute script from. Cloudinary serves it
// cross-origin so it cannot script into ariko.app, but there is no reason to
// accept an active format when every real capture is a raster.
test("rejects svg specifically", () => {
  assert.equal(checkUploadFile({ size: 10, type: "image/svg+xml" }).ok, false);
});

test("a missing type is rejected rather than assumed", () => {
  assert.equal(checkUploadFile({ size: 10, type: "" }).ok, false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/upload-input.test.ts`
Expected: FAIL — `Cannot find module './upload-input'`.

- [ ] **Step 3: Write the implementation**

Create `lib/upload-input.ts`:

```ts
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
```

> **Amended during execution.** `MAX_UPLOAD_BYTES`'s comment above says it "matches"
> `next.config.ts`'s `serverActions.bodySizeLimit`. It must not — see Task 5 Step 6. The
> shipped comment instead records that the config sits deliberately *above* this constant,
> and that this module must stay dependency-free because the config imports it.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/upload-input.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/upload-input.ts lib/upload-input.test.ts
git commit -m "Media: the shared upload size/type guard"
```

---

## Task 2: Extract `validateMediaEntry`

`lib/inbox.ts:78-104` validates media entries inline inside `validateInboxPayload`'s loop. The picker's hidden fields become a second place a client-supplied media entry enters the system, and two independent implementations of that shape would drift. Extract it — **behaviour and error strings must not change**, which the existing `lib/inbox.test.ts` already pins.

**Files:**
- Modify: `lib/inbox.ts`
- Test: `lib/inbox.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/inbox.test.ts` (and add `validateMediaEntry` to the existing import from `./inbox`):

```ts
test("validateMediaEntry accepts a bare embed, leaving provider for normalizeMedia", () => {
  const r = validateMediaEntry({ kind: "embed", url: "https://youtu.be/abc123" });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { kind: "embed", url: "https://youtu.be/abc123" });
});

test("validateMediaEntry accepts an image with its optional fields", () => {
  const r = validateMediaEntry({
    kind: "image",
    storageKey: "beanstalk/k",
    url: "https://res.cloudinary.com/x.jpg",
    alt: "a cat",
    width: 800,
    height: 600,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.kind, "image");
    if (r.value.kind === "image") {
      assert.equal(r.value.alt, "a cat");
      assert.equal(r.value.width, 800);
    }
  }
});

// The exact strings validateInboxPayload has always returned. They are part of
// /api/inbox's contract, so the extraction must not reword them.
test("validateMediaEntry returns the established error strings", () => {
  assert.deepEqual(validateMediaEntry(null), {
    ok: false,
    error: "each media entry must be an object",
  });
  assert.deepEqual(validateMediaEntry({ kind: "embed" }), {
    ok: false,
    error: "embed media requires a url",
  });
  assert.deepEqual(validateMediaEntry({ kind: "image", url: "https://x" }), {
    ok: false,
    error: "image media requires storageKey and url",
  });
  assert.deepEqual(validateMediaEntry({ kind: "video", url: "https://x" }), {
    ok: false,
    error: "media entry kind must be 'embed' or 'image'",
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/inbox.test.ts`
Expected: FAIL — `validateMediaEntry is not a function` (or a TS resolution error on the import).

- [ ] **Step 3: Extract the function**

In `lib/inbox.ts`, add this **above** `validateInboxPayload`:

```ts
export type MediaEntryResult =
  | { ok: true; value: InputMedia }
  | { ok: false; error: string };

// One definition of "a valid media entry", shared by /api/inbox
// (validateInboxPayload, below) and the admin media picker's hidden fields
// (lib/media-input.ts). An embed may still omit `provider` here —
// normalizeMedia derives it — which is why this returns InputMedia and not Media.
export function validateMediaEntry(m: unknown): MediaEntryResult {
  if (!isObject(m)) return { ok: false, error: "each media entry must be an object" };
  if (m.kind === "embed") {
    if (!nonEmptyString(m.url)) return { ok: false, error: "embed media requires a url" };
    return {
      ok: true,
      value: {
        kind: "embed",
        url: m.url,
        ...(nonEmptyString(m.provider) ? { provider: m.provider } : {}),
        ...(nonEmptyString(m.embedId) ? { embedId: m.embedId } : {}),
      },
    };
  }
  if (m.kind === "image") {
    if (!nonEmptyString(m.storageKey) || !nonEmptyString(m.url)) {
      return { ok: false, error: "image media requires storageKey and url" };
    }
    return {
      ok: true,
      value: {
        kind: "image",
        storageKey: m.storageKey,
        url: m.url,
        ...(nonEmptyString(m.alt) ? { alt: m.alt } : {}),
        ...(typeof m.width === "number" ? { width: m.width } : {}),
        ...(typeof m.height === "number" ? { height: m.height } : {}),
      },
    };
  }
  return { ok: false, error: "media entry kind must be 'embed' or 'image'" };
}
```

Then replace the whole media loop inside `validateInboxPayload` — the block that currently begins `for (const m of rawMedia) {` and ends with the closing brace of that loop — with:

```ts
  const inputMedia: InputMedia[] = [];
  for (const m of rawMedia) {
    const entry = validateMediaEntry(m);
    if (!entry.ok) return { ok: false, error: entry.error };
    inputMedia.push(entry.value);
  }
```

- [ ] **Step 4: Run the whole inbox suite**

Run: `node --import tsx --test lib/inbox.test.ts lib/inbox-route.test.ts`
Expected: PASS — the new tests plus every pre-existing one, unchanged.

- [ ] **Step 5: Commit**

```bash
git add lib/inbox.ts lib/inbox.test.ts
git commit -m "Media: extract validateMediaEntry so both doors share one definition"
```

---

## Task 3: `parseMediaField`

**Files:**
- Create: `lib/media-input.ts`
- Test: `lib/media-input.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/media-input.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMediaField } from "./media-input";

test("parses an image entry the picker emitted", () => {
  const out = parseMediaField([
    JSON.stringify({ kind: "image", storageKey: "beanstalk/k", url: "https://cdn/x.jpg", width: 8, height: 6 }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "image");
  if (out[0].kind === "image") assert.equal(out[0].storageKey, "beanstalk/k");
});

test("derives an embed's provider server-side from a bare entry", () => {
  const out = parseMediaField([JSON.stringify({ kind: "embed", url: "https://youtu.be/abc123" })]);
  assert.equal(out.length, 1);
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "youtube");
    assert.equal(out[0].embedId, "abc123");
  }
});

test("preserves order across a mixed list — the cover depends on it", () => {
  const out = parseMediaField([
    JSON.stringify({ kind: "embed", url: "https://example.com/a" }),
    JSON.stringify({ kind: "image", storageKey: "k1", url: "https://cdn/1.jpg" }),
    JSON.stringify({ kind: "image", storageKey: "k2", url: "https://cdn/2.jpg" }),
  ]);
  assert.deepEqual(out.map((m) => (m.kind === "image" ? m.storageKey : m.kind)), [
    "embed",
    "k1",
    "k2",
  ]);
});

// A hidden field is client-controlled. A malformed one must never take down a
// capture — it is dropped, and everything valid around it still lands.
test("drops malformed entries instead of throwing, keeping the valid ones", () => {
  const out = parseMediaField([
    "not json at all",
    "null",
    "[]",
    JSON.stringify({ kind: "image", url: "https://cdn/x.jpg" }), // no storageKey
    JSON.stringify({ kind: "video", url: "https://cdn/x.mp4" }),
    JSON.stringify({ kind: "image", storageKey: "k", url: "https://cdn/ok.jpg" }),
  ]);
  assert.equal(out.length, 1);
  if (out[0].kind === "image") assert.equal(out[0].storageKey, "k");
});

test("an empty field list is an empty media list", () => {
  assert.deepEqual(parseMediaField([]), []);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/media-input.test.ts`
Expected: FAIL — `Cannot find module './media-input'`.

- [ ] **Step 3: Write the implementation**

Create `lib/media-input.ts`:

```ts
import type { Media } from "./data";
import { normalizeMedia, validateMediaEntry, type InputMedia } from "./inbox";

/**
 * The admin media picker's wire format → normalized media.
 *
 * The picker (components/admin/media-picker.tsx) owns an ordered list and
 * emits the WHOLE list as repeated hidden fields, one JSON object each — so
 * reorder and remove never cross the wire as operations, and this function has
 * nothing to diff and no client-supplied intent to interpret.
 *
 * Malformed entries are DROPPED, not rejected: a hidden field is
 * client-controlled, and one bad entry must never cost a capture. That is the
 * opposite of validateInboxPayload's stance, deliberately — /api/inbox answers
 * a machine that can fix its payload and retry; this answers a person who is
 * mid-capture and cannot.
 *
 * Entries are shape-validated through the SAME validateMediaEntry /api/inbox
 * uses, and nothing more: there is no host allowlist on the stored URL. The
 * surface is admin-authenticated, and an arbitrary URL there is a hotlink, not
 * an injection — an <img src> cannot execute. Stated so the absence reads as a
 * decision (spec §3).
 */
export function parseMediaField(values: string[]): Media[] {
  const input: InputMedia[] = [];
  for (const raw of values) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const entry = validateMediaEntry(parsed);
    if (entry.ok) input.push(entry.value);
  }
  // Provider detection happens HERE, server-side, never in the browser.
  return normalizeMedia(input);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/media-input.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/media-input.ts lib/media-input.test.ts
git commit -m "Media: parse the picker's hidden fields into normalized media"
```

---

## Task 4: The Cloudinary collision fix

Spec §4.6. `lib/storage.ts:37` derives `public_id` from the uploaded filename. Cloudinary defaults signed uploads to `overwrite: true`, and supplying an explicit `public_id` disables its `unique_filename` behaviour — so two files named `Screenshot.png` silently replace each other, including one a published sprout already points at. Free to fix while the database holds zero images.

**Files:**
- Modify: `lib/storage.ts`
- Test: `lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/storage.test.ts` (add `uploadOptions` to the existing import from `./storage`):

```ts
test("upload options never derive an id from the filename (two same-named files must not collide)", () => {
  const a = uploadOptions("beanstalk", "Screenshot.png");
  const b = uploadOptions("beanstalk", "Screenshot.png");
  // The defect: an explicit public_id made these two the SAME asset, and
  // Cloudinary's signed-upload default of overwrite:true replaced the first.
  assert.ok(!("public_id" in a), `public_id must not be set: ${JSON.stringify(a)}`);
  assert.deepEqual(a, b);
});

test("upload options keep the original filename as context only", () => {
  const o = uploadOptions("beanstalk", "Screenshot.png");
  assert.deepEqual(o.context, { original_filename: "Screenshot.png" });
  assert.equal(o.resource_type, "image");
  assert.equal(o.folder, "beanstalk");
});

test("upload options omit context entirely when there is no filename", () => {
  const o = uploadOptions("beanstalk");
  assert.ok(!("context" in o));
});

test("the folder is caller-supplied, so verification can target a scratch folder", () => {
  assert.equal(uploadOptions("beanstalk/scratch").folder, "beanstalk/scratch");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/storage.test.ts`
Expected: FAIL — `uploadOptions is not a function`.

- [ ] **Step 3: Implement**

In `lib/storage.ts`, add above `cloudinaryStorage`:

```ts
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
```

Then replace the body of `cloudinaryStorage.uploadImage`'s `cloudinary.uploader.upload` call:

```ts
  async uploadImage(bytes: Buffer, filename?: string): Promise<MediaImage> {
    const dataUri = `data:application/octet-stream;base64,${bytes.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, uploadOptions(UPLOAD_FOLDER, filename));
    return toMediaImage(result as CloudinaryResult);
  },
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/storage.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "Media: stop deriving Cloudinary's public_id from the filename"
```

---

## Task 5: The upload action and the guarded route

**Files:**
- Modify: `app/admin/actions.ts`
- Modify: `app/api/upload/route.ts`
- Modify: `next.config.ts`
- Test: `lib/upload-route.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/upload-route.test.ts`:

```ts
test("400 when the file is not a supported image (guarded before any upload)", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const form = new FormData();
  form.set("file", new Blob([Buffer.from("%PDF-1.4")], { type: "application/pdf" }), "x.pdf");
  const res = await POST(
    new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { authorization: "Bearer tok_master" },
      body: form,
    }),
  );
  // 400, not 502: this must be refused by the guard, never attempted against
  // Cloudinary (there is no CLOUDINARY_URL in the test environment, so an
  // attempt would surface as a 502).
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not a supported image/);
});

test("400 when the file is empty", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const form = new FormData();
  form.set("file", new Blob([], { type: "image/png" }), "empty.png");
  const res = await POST(
    new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { authorization: "Bearer tok_master" },
      body: form,
    }),
  );
  assert.equal(res.status, 400);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/upload-route.test.ts`
Expected: FAIL — the PDF case returns 502 (it reached Cloudinary) instead of 400.

- [ ] **Step 3: Guard the route**

In `app/api/upload/route.ts`, add the import and the check immediately after the existing `file instanceof Blob` guard:

```ts
import { checkUploadFile } from "../../../lib/upload-input";
```

```ts
  const check = checkUploadFile({ size: file.size, type: file.type });
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/upload-route.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the server action**

In `app/admin/actions.ts`, add to the imports:

```ts
import type { Media, MediaImage } from "@/lib/data";
import { uploadImage } from "@/lib/storage";
import { checkUploadFile } from "@/lib/upload-input";
```

and add the action:

```ts
export type UploadResult = { ok: true; media: MediaImage } | { ok: false; error: string };

/**
 * The admin's upload door (spec §4.1). Called DIRECTLY by a client component
 * (components/admin/media-picker.tsx), not through a `<form action>`, so it
 * RETURNS a result rather than redirecting.
 *
 * It never throws to the client: a Cloudinary failure becomes { ok: false },
 * because a failed upload must not take the capture down with it. That is the
 * same stance app/api/upload/route.ts states as "upload failure never costs a
 * seed" — honoured here by construction, since the island uploads first and
 * captures second.
 *
 * /api/upload is deliberately NOT reused: its guarantee is "bearer or nothing",
 * and a browser cannot hold that token.
 */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  await requireSession();

  const file = formData.get("file");
  if (!(file instanceof Blob)) return { ok: false, error: "no file was sent" };

  const check = checkUploadFile({ size: file.size, type: file.type });
  if (!check.ok) return { ok: false, error: check.error };

  const filename = typeof (file as File).name === "string" ? (file as File).name : undefined;
  try {
    const media = await uploadImage(Buffer.from(await file.arrayBuffer()), filename);
    return { ok: true, media };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "upload failed" };
  }
}
```

- [ ] **Step 6: Raise the server-action body limit**

> **Amended during execution.** This step originally specified `bodySizeLimit: "4mb"`, which
> code review showed was wrong: Next parses `"4mb"` as exactly 4,194,304 bytes — *equal* to
> `MAX_UPLOAD_BYTES` — but the limit bounds the whole multipart body (boundaries, headers,
> framing), so a file of exactly `MAX_UPLOAD_BYTES` produced a body over the limit and was
> killed by the platform with the opaque 413 the guard exists to prevent, while
> `lib/upload-input.test.ts` explicitly asserts that file is accepted. The limit must sit
> *above* the guard so the guard always binds first.

In `next.config.ts`, add the import and the config:

```ts
import { MAX_UPLOAD_BYTES } from "./lib/upload-input";
```

```ts
  // Server actions default to a 1MB request body; uploadImageAction carries an
  // image. This is deliberately ABOVE lib/upload-input.ts's MAX_UPLOAD_BYTES
  // rather than equal to it: bodySizeLimit bounds the WHOLE multipart body
  // (boundaries, Content-Disposition headers, field framing), so a file of
  // exactly MAX_UPLOAD_BYTES yields a body slightly larger than that. Equal
  // limits would let the platform reject — with an opaque 413, before the
  // action runs — a file checkUploadFile explicitly accepts, which is the very
  // failure that guard exists to prevent. The headroom keeps the app-level
  // guard the binding constraint. Still well under Vercel's own 4.5MB ceiling,
  // which applies to a route handler and a server action alike.
  experimental: {
    serverActions: { bodySizeLimit: MAX_UPLOAD_BYTES + 64 * 1024 },
  },
```

**Verified during execution:** Next's config loader *does* resolve a relative import of a
project `lib/` module at config-load time. In exchange, `lib/upload-input.ts` must stay
dependency-free — an import needing a server runtime or an env var would stop the config
loading in every environment at once. A comment in that file records the constraint.

- [ ] **Step 7: Consolidate the filename recovery**

> **Added during execution**, on review: `typeof (file as File).name === "string" ? … : undefined`
> was duplicated verbatim at both doors, in the one slice whose `lib/upload-input.ts` exists
> precisely to be what both doors share.

Add to `lib/upload-input.ts` and use at both call sites:

```ts
// A Blob has no name; a File does. Both doors receive `Blob` from FormData and
// need the original filename when it is there — recovered in one place so the
// cast lives once rather than at each door.
export function uploadedFilename(file: Blob): string | undefined {
  const name = (file as File).name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}
```

Test it in `lib/upload-input.test.ts`: a `File` returns its name, a bare `Blob` returns
`undefined`, an empty name returns `undefined`. (The `length > 0` condition is new; it is a
no-op at both doors, since `uploadOptions` already gated on a truthy filename — it just makes
the helper's contract match its declared return type at the source.)

- [ ] **Step 8: Typecheck**

Run: `npm run build`
Expected: compiles with no type errors. (If `CLOUDINARY_URL` is unset the build still succeeds — nothing uploads at build time.)

- [ ] **Step 9: Commit**

```bash
git add app/admin/actions.ts app/api/upload/route.ts next.config.ts lib/upload-input.ts lib/upload-input.test.ts lib/upload-route.test.ts
git commit -m "Media: the admin upload action, and a size/type guard on the machine door"
```

---

## Task 6: `MediaPicker` — the client island

No unit test: this is a React client component, and the repo has no component-test harness (the one jsdom file exists to mount a real Tiptap `Editor`, which is a different problem). Everything it decides that is worth pinning — parsing, normalization, dirty-gating — already lives in the pure functions of Tasks 3 and 8. It is verified by `npm run build` and by the hands-on pass in Task 12.

**Files:**
- Create: `components/admin/media-picker.tsx`

- [ ] **Step 1: Write the component**

Create `components/admin/media-picker.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import type { Media } from "@/lib/data";
import { uploadImageAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The admin's media island (spec §4.2) — the SECOND deliberate client-JS
 * exception in this codebase, after the prose editor, and bounded by one rule
 * recorded in CLAUDE.md:
 *
 *   The picker renders NOTHING until it mounts. Without script the form around
 *   it is byte-for-byte what it was, and no capture or edit ever depends on it.
 *
 * It owns one ORDERED list holding stored entries and newly uploaded ones
 * alike, and emits the whole list as repeated hidden fields — so reorder and
 * remove never cross the wire as operations (lib/media-input.ts).
 *
 * It never blocks a submit. In-flight and failed rows simply emit nothing;
 * the surrounding form posts without them. That is the whole of "media
 * pending": the capture survives, and the file is still on disk.
 */

type Row =
  | { key: string; state: "settled"; media: Media }
  | { key: string; state: "uploading"; file: File }
  | { key: string; state: "failed"; file: File; error: string };

export function MediaPicker({
  name,
  initial = [],
  links = false,
}: {
  /** The hidden field name — "image" on the capture bar, "media" on a sprout. */
  name: string;
  /** Stored entries to open with. Empty on the capture bar. */
  initial?: Media[];
  /** Offer an "add link" input, which joins the same ordered list. */
  links?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((media, i) => ({ key: `initial-${i}`, state: "settled" as const, media })),
  );
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);

  // The rule above. A client component still server-renders its initial HTML,
  // so without this a script-off browser would be shown a file input that
  // cannot do anything.
  useEffect(() => setMounted(true), []);

  const patch = (key: string, next: Row) =>
    setRows((rs) => rs.map((r) => (r.key === key ? next : r)));

  const upload = async (key: string, file: File): Promise<void> => {
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadImageAction(formData);
      patch(
        key,
        result.ok
          ? { key, state: "settled", media: result.media }
          : { key, state: "failed", file, error: result.error },
      );
    } catch (e) {
      // A server action invoked directly from a client component returns its
      // redirect() as a REJECTED promise — see the long comment in
      // components/editor/prose-editor.tsx. uploadImageAction does not redirect
      // on success, but requireSession() does when the session has expired, and
      // presenting an expired session as an upload error would be wrong.
      unstable_rethrow(e);
      patch(key, { key, state: "failed", file, error: e instanceof Error ? e.message : "upload failed" });
    }
  };

  const addFiles = (files: FileList | null): void => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const key = `row-${nextKey.current++}`;
      setRows((rs) => [...rs, { key, state: "uploading", file }]);
      void upload(key, file);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const addLink = (): void => {
    const url = link.trim();
    if (!url) return;
    // Bare — no provider. detectEmbed runs SERVER-side (lib/media-input.ts), so
    // the browser never declares what a URL is.
    setRows((rs) => [
      ...rs,
      { key: `row-${nextKey.current++}`, state: "settled", media: { kind: "embed", provider: "", url } },
    ]);
    setLink("");
  };

  const move = (index: number, delta: number): void =>
    setRows((rs) => {
      const to = index + delta;
      if (to < 0 || to >= rs.length) return rs;
      const next = [...rs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const remove = (key: string): void => setRows((rs) => rs.filter((r) => r.key !== key));

  const setAlt = (key: string, alt: string): void =>
    setRows((rs) =>
      rs.map((r) =>
        r.key === key && r.state === "settled" && r.media.kind === "image"
          ? { ...r, media: { ...r.media, alt } }
          : r,
      ),
    );

  if (!mounted) return null;

  const pending = rows.filter((r) => r.state !== "settled").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${name}-file`}>Images</Label>
        <input
          id={`${name}-file`}
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1 file:text-sm"
        />
      </div>

      {links ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`${name}-link`}>Add a link</Label>
            <Input
              id={`${name}-link`}
              type="url"
              value={link}
              placeholder="paste a URL"
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <Button type="button" variant="secondary" onClick={addLink}>
            Add
          </Button>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-start gap-3 rounded-lg border p-2">
              <div className="flex flex-col gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0}>
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                >
                  ↓
                </Button>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {row.state === "settled" && row.media.kind === "image" ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={row.media.url} alt="" className="h-20 w-20 rounded object-cover" />
                    <Input
                      type="text"
                      value={row.media.alt ?? ""}
                      placeholder="alt text (describe the image)"
                      onChange={(e) => setAlt(row.key, e.target.value)}
                    />
                  </>
                ) : row.state === "settled" ? (
                  <span className="min-w-0 break-all font-heading text-xs">{row.media.url}</span>
                ) : row.state === "uploading" ? (
                  <span className="font-heading text-xs text-muted-foreground">
                    Uploading {row.file.name}…
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-destructive">
                    {row.file.name}: {row.error}
                    <Button type="button" size="sm" variant="secondary" onClick={() => {
                      patch(row.key, { key: row.key, state: "uploading", file: row.file });
                      void upload(row.key, row.file);
                    }}>
                      Retry
                    </Button>
                  </span>
                )}
              </div>

              <Button type="button" size="sm" variant="ghost" onClick={() => remove(row.key)}>
                Remove
              </Button>

              {/* Only SETTLED rows reach the server. An in-flight or failed row
                  emits nothing, which is what lets the form submit without it. */}
              {row.state === "settled" ? (
                <input type="hidden" name={name} value={JSON.stringify(row.media)} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {pending > 0 ? (
        <p className="font-heading text-xs text-muted-foreground">
          {pending} not ready — saving now will leave {pending === 1 ? "it" : "them"} out. Nothing
          here blocks the save.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/media-picker.tsx
git commit -m "Media: the admin media picker island"
```

---

## Task 7: Wire the capture bar

**Files:**
- Modify: `lib/seed-form.ts`
- Modify: `app/admin/page.tsx`
- Test: `lib/seed-form.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/seed-form.test.ts`:

```ts
test("an image field from the picker becomes an image media entry", () => {
  const form = new FormData();
  form.set("title", "A capture");
  form.append(
    "image",
    JSON.stringify({ kind: "image", storageKey: "beanstalk/k", url: "https://cdn/x.jpg", alt: "a cat" }),
  );
  const body = buildSeedBody(form);
  assert.equal(body.media.length, 1);
  assert.equal(body.media[0].kind, "image");
});

test("links come first, then images, in declaration order", () => {
  const form = new FormData();
  form.set("title", "A capture");
  form.append("link", "https://example.com/a");
  form.append("image", JSON.stringify({ kind: "image", storageKey: "k1", url: "https://cdn/1.jpg" }));
  form.append("image", JSON.stringify({ kind: "image", storageKey: "k2", url: "https://cdn/2.jpg" }));
  const body = buildSeedBody(form);
  assert.deepEqual(
    body.media.map((m) => (m.kind === "image" ? m.storageKey : m.url)),
    ["https://example.com/a", "k1", "k2"],
  );
});

// The picker's fields are client-controlled. One bad entry must not cost the capture.
test("a malformed image field is dropped, and the capture survives", () => {
  const form = new FormData();
  form.set("title", "A capture");
  form.append("image", "}{not json");
  form.append("image", JSON.stringify({ kind: "image", storageKey: "k", url: "https://cdn/ok.jpg" }));
  const body = buildSeedBody(form);
  assert.equal(body.title, "A capture");
  assert.equal(body.media.length, 1);
});

test("a capture with no images is unchanged", () => {
  const form = new FormData();
  form.set("title", "A capture");
  form.append("link", "https://example.com/a");
  assert.equal(buildSeedBody(form).media.length, 1);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/seed-form.test.ts`
Expected: FAIL — the image entry is missing; `body.media.length` is 0.

- [ ] **Step 3: Read the picker's fields**

Rewrite `lib/seed-form.ts`:

```ts
import type { LocalizedText } from "./data";
import type { InputMedia } from "./inbox";
import { parseMediaField } from "./media-input";

// The raw body shape /api/inbox accepts. Embeds may be bare (no provider) —
// provider detection happens in validateInboxPayload → normalizeMedia →
// detectEmbed. Images arrive already-formed from the media picker, which
// uploaded them through uploadImageAction before this form was ever submitted.
export interface RawGardenBody {
  title: string;
  body?: LocalizedText;
  media: InputMedia[];
  source: { kind: "manual" };
}

// Pure. Maps the admin seed <form> into the raw ingestion body. Empty note ⇒
// no body; blank link fields dropped; title trimmed (may be "" — the downstream
// validateInboxPayload guard rejects an empty title).
//
// Links first, then images, both in declaration order. Order matters: a bean's
// cover is the FIRST MediaImage in its newest sprout's media[] (spec §5.5), and
// image order here is the picker's order.
export function buildSeedBody(form: FormData): RawGardenBody {
  const title = String(form.get("title") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  const lang = form.get("lang") === "fr" ? "fr" : "en";
  const links = form
    .getAll("link")
    .map((v) => String(v).trim())
    .filter((url) => url.length > 0)
    .map((url) => ({ kind: "embed" as const, url }));
  const images = parseMediaField(form.getAll("image").map((v) => String(v)));

  return {
    title,
    ...(note ? { body: { [lang]: note } as LocalizedText } : {}),
    media: [...links, ...images],
    source: { kind: "manual" },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/seed-form.test.ts`
Expected: PASS — the new tests plus every pre-existing one.

- [ ] **Step 5: Drop the picker into the capture form**

In `app/admin/page.tsx`, add the import:

```ts
import { MediaPicker } from "@/components/admin/media-picker";
```

and insert this immediately **after** the second link field's closing `</div>` and **before** the `<div><Button type="submit">…` block:

```tsx
              {/* The one client-JS island in this otherwise zero-JS form
                  (CLAUDE.md). It renders nothing until it mounts, so without
                  script this form is exactly what it was, and a capture never
                  waits on an upload. */}
              <MediaPicker name="image" />
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/seed-form.ts lib/seed-form.test.ts app/admin/page.tsx
git commit -m "Media: the capture bar can attach images"
```

---

## Task 8: `buildMediaPatch`

**Files:**
- Create: `lib/media-edit.ts`
- Test: `lib/media-edit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/media-edit.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Media } from "./data";
import { buildMediaPatch } from "./media-edit";

const IMG_A: Media = { kind: "image", storageKey: "k1", url: "https://cdn/1.jpg" };
const IMG_B: Media = { kind: "image", storageKey: "k2", url: "https://cdn/2.jpg" };

function formOf(entries: unknown[]): FormData {
  const form = new FormData();
  for (const e of entries) form.append("media", JSON.stringify(e));
  return form;
}

test("an untouched list writes nothing", () => {
  const result = buildMediaPatch({ media: [IMG_A, IMG_B] }, formOf([IMG_A, IMG_B]));
  assert.equal(result.dirty, false);
});

test("a reorder is a change", () => {
  const result = buildMediaPatch({ media: [IMG_A, IMG_B] }, formOf([IMG_B, IMG_A]));
  assert.equal(result.dirty, true);
  if (result.dirty) {
    assert.deepEqual(result.media.map((m) => (m.kind === "image" ? m.storageKey : "")), ["k2", "k1"]);
  }
});

test("a removal is a change", () => {
  const result = buildMediaPatch({ media: [IMG_A, IMG_B] }, formOf([IMG_A]));
  assert.equal(result.dirty, true);
  if (result.dirty) assert.equal(result.media.length, 1);
});

test("editing alt text is a change", () => {
  const result = buildMediaPatch({ media: [IMG_A] }, formOf([{ ...IMG_A, alt: "a cat" }]));
  assert.equal(result.dirty, true);
  if (result.dirty && result.media[0].kind === "image") {
    assert.equal(result.media[0].alt, "a cat");
  }
});

test("a newly added bare link gets its provider derived server-side", () => {
  const result = buildMediaPatch({ media: [] }, formOf([{ kind: "embed", url: "https://youtu.be/abc123" }]));
  assert.equal(result.dirty, true);
  if (result.dirty && result.media[0].kind === "embed") {
    assert.equal(result.media[0].provider, "youtube");
    assert.equal(result.media[0].embedId, "abc123");
  }
});

test("a sprout with no stored media compares against an empty list", () => {
  assert.equal(buildMediaPatch({}, formOf([])).dirty, false);
  assert.equal(buildMediaPatch({}, formOf([IMG_A])).dirty, true);
});

test("clearing every entry is a change, not a no-op", () => {
  const result = buildMediaPatch({ media: [IMG_A] }, formOf([]));
  assert.equal(result.dirty, true);
  if (result.dirty) assert.deepEqual(result.media, []);
});

// A stored entry arrives from Mongo and a submitted one is rebuilt by the
// browser; their JSON key ORDER can differ while the entries are identical.
// The comparison must not mistake that for an edit and rewrite the document.
test("key order does not make an unchanged list look dirty", () => {
  const stored: Media = { kind: "image", storageKey: "k", url: "https://cdn/x.jpg", alt: "a" };
  const submitted = { alt: "a", url: "https://cdn/x.jpg", storageKey: "k", kind: "image" };
  assert.equal(buildMediaPatch({ media: [stored] }, formOf([submitted])).dirty, false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/media-edit.test.ts`
Expected: FAIL — `Cannot find module './media-edit'`.

- [ ] **Step 3: Write the implementation**

Create `lib/media-edit.ts`:

```ts
import type { Media } from "./data";
import { parseMediaField } from "./media-input";

/** The slice of a Sprout this module cares about. */
export interface MediaOwner {
  media?: Media[];
}

/**
 * Two cases, not three. buildContentPatch (lib/content-edit.ts) has an error
 * case because content carries a size cap; a media list has no comparable
 * failure — a malformed entry is dropped by parseMediaField rather than
 * failing the save (see its doc-comment for why). Inventing an unreachable
 * error case to match the sibling's shape would be worse than differing.
 */
export type MediaPatchResult = { dirty: false } | { dirty: true; media: Media[] };

// Order-sensitive canonical form. A reorder IS a change, so this compares
// position by position. Field order is fixed here rather than relying on
// JSON.stringify: a stored entry comes back from Mongo and a submitted one is
// rebuilt by the browser, so their key order can differ while the entries are
// identical — and that must not read as an edit.
function canonical(m: Media): string {
  return m.kind === "image"
    ? `image|${m.storageKey}|${m.url}|${m.alt ?? ""}|${m.width ?? ""}|${m.height ?? ""}`
    : `embed|${m.provider}|${m.url}|${m.embedId ?? ""}`;
}

function same(a: Media[], b: Media[]): boolean {
  return a.length === b.length && a.every((m, i) => canonical(m) === canonical(b[i]));
}

/**
 * Pure. The submitted list IS the new media[] — the picker owns ordering and
 * posts the whole thing, so there is nothing to diff and no client-supplied
 * intent to interpret (spec §4.4).
 *
 * Dirty-gated for the same reason buildContentPatch is: opening a sprout and
 * saving it untouched must write nothing at all.
 */
export function buildMediaPatch(current: MediaOwner, form: FormData): MediaPatchResult {
  const next = parseMediaField(form.getAll("media").map((v) => String(v)));
  const stored = current.media ?? [];
  return same(stored, next) ? { dirty: false } : { dirty: true, media: next };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/media-edit.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/media-edit.ts lib/media-edit.test.ts
git commit -m "Media: the sprout media patch builder, dirty-gated"
```

---

## Task 9: Sprout media editing

**Files:**
- Modify: `lib/botanical.ts`
- Modify: `app/admin/actions.ts`
- Modify: `app/admin/sprout/[slug]/page.tsx`

- [ ] **Step 1: Add the narrow writer**

In `lib/botanical.ts`, add immediately **after** `updateSproutContent` / `updatePlantContent` / `updatePodContent`:

```ts
/**
 * Writes a sprout's media — and nothing else.
 *
 * A SIBLING of writeContent, not a widening of updateVersion. updateVersion
 * writes `$set: { ...patch }` and its comment promises it "never touches slug /
 * parents / media / source / content"; that promise is what makes the metadata
 * form safe, so media gets its own narrow writer instead. `media` is named
 * explicitly rather than spread, for the same reason writeContent names its
 * two fields: a spread lets a widened caller reach `state` or `source`.
 */
export async function updateSproutMedia(slug: string, media: Media[]): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").updateOne({ slug }, { $set: { media } });
}
```

Add `Media` to the existing `import type { … } from "./data";` in that file if it is not already imported.

- [ ] **Step 2: Add the action**

In `app/admin/actions.ts`, add to the imports:

```ts
import { buildMediaPatch } from "@/lib/media-edit";
```

and add `updateSproutMedia` to the existing `@/lib/botanical` import list. Then add the action next to `editContentAction`:

```ts
// A sprout's media[] — its own form, its own action, its own narrow writer.
// Separate from BOTH the metadata form and the prose editor, which is what
// keeps each surface's blast radius to its own fields (spec §4.4).
export async function editSproutMediaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/vault");

  const result = buildMediaPatch(existing, formData);
  // Dirty-gated, same rule as editContentAction: opening a sprout and saving
  // it untouched writes nothing at all.
  if (result.dirty) await updateSproutMedia(slug, result.media);

  revalidatePath("/admin");
  redirect(`/admin/sprout/${encodeURIComponent(slug)}`);
}
```

- [ ] **Step 3: Add the card to the sprout page**

In `app/admin/sprout/[slug]/page.tsx`, add to the imports:

```ts
import { MediaPicker } from "@/components/admin/media-picker";
```

and add `editSproutMediaAction` to the existing `../../actions` import. Then insert this **after** the `<ContentCard … />` element and **before** the `{content ? ( … Source … )}` block:

```tsx
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">Media</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Its own form — not part of the metadata form below, and not part
                of the content form above. A bean's cover is the FIRST image in
                this list (spec §5.5), so the order here is an authoring act. */}
            <form action={editSproutMediaAction} className="flex flex-col gap-4">
              <input type="hidden" name="slug" value={version.slug} />
              <MediaPicker name="media" initial={version.media ?? []} links />
              <div>
                <Button type="submit">Save media</Button>
              </div>
            </form>
          </CardContent>
        </Card>
```

- [ ] **Step 4: Typecheck and run the full suite**

Run: `npm run build && npm test`
Expected: build clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/botanical.ts app/admin/actions.ts "app/admin/sprout/[slug]/page.tsx"
git commit -m "Media: a sprout's media[] becomes editable"
```

---

## Task 10: The editor's `/image` command

**Files:**
- Modify: `components/editor/editor-extensions.ts`
- Modify: `components/editor/prose-editor.tsx`
- Test: `lib/editor-mount.test.ts`

The handoff's trap: `lib/editor-mount.test.ts` is the only thing that constructs a real `Editor`, and static checks previously missed a defect that made the editor fail to mount on every page. Extend it; do not bypass it.

- [ ] **Step 1: Write the failing test**

In `lib/editor-mount.test.ts`, add `buildBlocks` to the existing `require` of the extensions module:

```ts
const { buildEditorExtensions, buildBlocks } = require("../components/editor/editor-extensions.js") as typeof import("../components/editor/editor-extensions.js");
```

Update `makeEditor` to pass the new option:

```ts
function makeEditor(opts: { content?: string; contentType?: "markdown"; entities?: EntityOption[] } = {}) {
  const extensions = buildEditorExtensions({
    entities: opts.entities ?? ENTITIES,
    // No-op menu wiring: this file never opens the `@`/`/` picker, it only
    // needs the plugins registered — see BuildEditorExtensionsOptions'
    // doc-comment in components/editor/editor-extensions.ts.
    onMenu: () => {},
    getMenu: () => null,
    onInsertImage: () => {},
  });
  return new Editor({
    extensions,
    content: opts.content ?? "",
    ...(opts.contentType ? { contentType: opts.contentType } : {}),
  });
}
```

and append these tests:

```ts
test("6. the / menu offers Image, and running it clears the typed command and asks the host to pick a file", () => {
  let asked = 0;
  const blocks = buildBlocks(() => {
    asked++;
  });
  const image = blocks.find((b) => b.id === "image");
  assert.ok(image, `no image block in: ${blocks.map((b) => b.id).join(", ")}`);

  const editor = makeEditor({ content: "/image", contentType: "markdown" });
  // The suggestion range for "/image" typed at the start of the only paragraph:
  // position 1 is inside that paragraph, before the "/".
  image!.run(editor, { from: 1, to: 1 + "/image".length });

  assert.equal(asked, 1, "running the block must ask the host to open a file picker");
  assert.ok(
    !editor.getText().includes("/image"),
    `the typed command must be deleted, got: ${JSON.stringify(editor.getText())}`,
  );
  editor.destroy();
});

test("7. setImage inserts a node that serializes back to markdown (the /image insert path)", () => {
  const editor = makeEditor({ content: "before", contentType: "markdown" });
  editor.chain().focus().setImage({ src: "https://cdn/x.jpg", alt: "a cat" }).run();
  const markdown = editor.getMarkdown();
  assert.match(markdown, /!\[a cat\]\(https:\/\/cdn\/x\.jpg\)/);
  // And it survives a reload — the failure mode baseExtensions' doc-comment
  // warns about is a node that vanishes on the NEXT save, not the first.
  const reloaded = makeEditor({ content: markdown, contentType: "markdown" });
  assert.ok(JSON.stringify(reloaded.getJSON()).includes('"image"'));
  assert.equal(render(reloaded.getMarkdown()), render(markdown));
  reloaded.destroy();
  editor.destroy();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/editor-mount.test.ts`
Expected: FAIL — `buildBlocks is not a function`.

- [ ] **Step 3: Add `buildBlocks` and the option**

In `components/editor/editor-extensions.ts`:

Rename the module-level `const BLOCKS` to `const STATIC_BLOCKS` (leave its rows exactly as they are), and add below it:

```ts
/** A `/` command row. */
export interface BlockCommand {
  id: string;
  label: string;
  run: (e: Editor, r: Range) => void;
}

/**
 * The `/` menu's block rows. A function rather than a constant because the
 * Image row needs the host's file picker: the command deletes the typed
 * text and hands off, and the ASYNC half (open a picker, upload, insert)
 * lives in components/editor/prose-editor.tsx where it can hold React state.
 *
 * Exported so lib/editor-mount.test.ts can run a row against a real Editor
 * without a DOM file dialog.
 */
export function buildBlocks(onInsertImage: () => void): BlockCommand[] {
  return [
    ...STATIC_BLOCKS,
    {
      id: "image",
      label: "Image",
      run: (e, r) => {
        // Delete the typed "/image" NOW, before the file dialog takes focus,
        // so the insertion later lands at a clean cursor.
        e.chain().focus().deleteRange(r).run();
        onInsertImage();
      },
    },
  ];
}
```

Add to `BuildEditorExtensionsOptions`:

```ts
  /**
   * Ask the host to pick an image file and insert it. Called by the `/image`
   * command AFTER the typed text is deleted. A headless caller
   * (lib/editor-mount.test.ts) can pass a no-op.
   */
  onInsertImage: () => void;
```

Change the function signature:

```ts
export function buildEditorExtensions({ entities, onMenu, getMenu, onInsertImage }: BuildEditorExtensionsOptions) {
```

Immediately inside the function body, add:

```ts
  const blocks = buildBlocks(onInsertImage);
```

Then, in the `/` suggestion's items callback and its run handler, replace both references to `BLOCKS` with `blocks`:

```ts
        ...blocks.filter((b) => matches(b.label, query)).map((b) => ({ id: b.id, label: b.label })),
```

```ts
        const block = blocks.find((b) => b.id === item.id);
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/editor-mount.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Wire the host half**

In `components/editor/prose-editor.tsx`:

Add to the imports:

```ts
import { uploadImageAction } from "@/app/admin/actions";
```

Add these alongside the other hooks, after `const baselineRef = …`:

```ts
  // The `/image` command's async half. The extension deletes the typed text
  // and calls onInsertImage; this opens the picker, uploads through the same
  // server action the media picker uses, and inserts at the cursor the
  // deletion left behind.
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);
```

Change the `extensions` memo to pass the callback:

```ts
  const extensions = useMemo(
    () =>
      buildEditorExtensions({
        entities,
        onMenu: show,
        getMenu: () => menuRef.current,
        onInsertImage: () => imageInputRef.current?.click(),
      }),
    [entities],
  );
```

Add the upload handler after `save`:

```ts
  const insertImage = async (file: File): Promise<void> => {
    setImageError(null);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadImageAction(formData);
      if (!result.ok) {
        setImageError(result.error);
        return;
      }
      editor?.chain().focus().setImage({ src: result.media.url, alt: result.media.alt ?? "" }).run();
    } catch (e) {
      // Same rejection semantics as `save` above — see its comment.
      unstable_rethrow(e);
      setImageError(e instanceof Error ? e.message : "could not upload image");
    }
  };
```

Add the hidden input and the error line inside the returned JSX, immediately after the `<div className="rounded-lg border p-3">…</div>` block:

```tsx
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void insertImage(file);
        }}
      />
      {imageError ? (
        <p className="font-heading text-xs text-destructive">Could not add image: {imageError}</p>
      ) : null}
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npm run build && npm test`
Expected: build clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/editor/editor-extensions.ts components/editor/prose-editor.tsx lib/editor-mount.test.ts
git commit -m "Media: /image inserts a picture into an article"
```

---

## Task 11: `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Amend the exception**

In `CLAUDE.md`, replace the bullet beginning **"The prose editor is the one deliberate exception"** with these two bullets:

```markdown
- **The prose editor is the first deliberate exception** (`components/editor/`,
  slice 5). The content forms on `/admin/sprout/[slug]`, `/admin/plant/[slug]`
  and `/admin/pod/[slug]` are client components and do not work without script.
  They still invoke the same server actions, and they are *separate forms* from
  the metadata ones on the same page — which is what keeps the exception
  contained.
- **The media picker is the second** (`components/admin/media-picker.tsx`, the
  media slice). It carries its own rule, which is what makes it an island
  rather than a slope:

  > The picker renders **nothing until it mounts**. Without script, the form
  > around it is byte-for-byte what it was, and **no capture or edit ever
  > depends on it**.

  So the capture bar still submits without script, and a submit is never
  blocked by an upload: an in-flight or failed image simply is not in the
  payload. Images upload through `uploadImageAction`, never from the browser to
  a third party, and a pasted link's `provider` is always derived server-side.

  Widening this to any *further* form is a decision, not a convenience.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Docs: the media picker is the second client-JS island, and its rule"
```

---

## Task 12: Verification and the PR

- [ ] **Step 1: Full gate**

Run: `npm test && npm run build`
Expected: all tests pass, build clean. **Record the actual counts** — do not claim a pass you have not read.

- [ ] **Step 2: Hands-on, against a scratch database**

`.env.local` points at the **production** database. Never write to `beanstalk`.

```bash
MONGODB_DB=media_scratch \
ADMIN_PASSWORD=scratch-pass \
ADMIN_SESSION_SECRET=scratch-secret-scratch-secret \
CLOUDINARY_FOLDER=beanstalk/scratch \
npx next dev
```

`CLOUDINARY_FOLDER` matters: there is no scratch Cloudinary, so uploads land in the real account. Sending them to `beanstalk/scratch` keeps them together for deletion.

Walk through:
1. `/admin` — attach two images and a link, submit. Confirm the seed lands with all three.
2. Reload with JavaScript disabled. Confirm the capture bar shows **no** file input and a capture still submits.
3. Attach an image, then submit **while it is still uploading**. Confirm the seed is created without it.
4. Force a failure (stop the network, or set `CLOUDINARY_URL` to nonsense) and confirm the row shows an error, the capture still submits, and **Retry** works once the network is back.
5. Promote the seed; confirm `media[]` arrived on the sprout verbatim.
6. `/admin/sprout/<slug>` — reorder, edit alt text, add a link, remove an entry, save. Re-open and save again untouched; confirm the second save writes nothing (the dirty gate).
7. In the prose editor, type `/image`, pick a file, confirm it appears and survives a save-and-reload.

- [ ] **Step 3: Clean up**

Drop the scratch database, and delete the `beanstalk/scratch` folder from Cloudinary. Both, not just the first.

- [ ] **Step 4: Open the PR**

Requires a Lab Note (`CLAUDE.md`) — this is user-facing. Suggested body section:

````markdown
## Lab Note

```yaml
en:
  title: Pictures, at last
  summary: The capture bar can take images now, not just links — drop a screenshot in and it comes along for the ride. You can also reorder a piece's images, or drop one straight into an article as you write.
fr:
  title: Enfin des images
  summary: Tu peux maintenant joindre des images à une capture, pas seulement des liens. Réorganise-les comme tu veux, ou glisse-en une directement dans un article pendant que tu écris.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```
````

---

## Notes for the implementer

- **Every `lib/` function here is pure and synchronous** except the actions. If you find yourself wanting a database or a network call inside one, the seam is in the wrong place.
- **`parseMediaField` drops, `validateInboxPayload` rejects.** That asymmetry is deliberate and documented at the function. Do not "fix" it into consistency.
- **Do not add `content` to `SproutPatch`, or `media` to it either.** `updateVersion` spreads its patch; both fields have their own narrow writers for exactly that reason.
- **The picker is the only client component you should add.** If a task seems to need a second one, re-read the rule in Task 11 before writing it.
