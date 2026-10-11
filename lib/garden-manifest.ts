/**
 * The manifest a sibling repo writes, parsed and checked as a WHOLE before
 * anything is written.
 *
 * Pure on purpose: no `getDb`, no `node:fs`, no argv. What is wrong here is
 * wrong about the AUTHOR's file, and can be reported without a database
 * existing. `lib/garden-plan.ts` is the other half — what is surprising about
 * the GARDEN.
 */
import { load } from "js-yaml";
import { composeText, type Text } from "./data";
import { isTimelineDate } from "./sprout-date";
import { isSproutType } from "./sprout-type";
import { MAX_CONTENT_BYTES } from "./content-edit";

/**
 * Slugs become URL segments (`/pod/krabs`, `/bean/…`), so a capital or an
 * underscore round-trips through `encodeURIComponent` into something an
 * author cannot retype from the address bar.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `slug` at `where`, checked for kebab-case; a genuinely absent value is
 * reported as missing, and a present-but-wrong-typed one (an unquoted YAML
 * number, say) is reported with what was actually there — an author staring
 * at `slug: 123` and reading "is required" would not believe the message.
 */
function checkSlug(raw: unknown, where: string): string | null {
  if (raw === undefined || raw === "") return `${where}.slug is required`;
  if (typeof raw !== "string") {
    return `${where}.slug must be a string (got ${JSON.stringify(raw)})`;
  }
  if (!SLUG.test(raw)) return `${where}.slug must be kebab-case (got "${raw}")`;
  return null;
}

/**
 * Keys the PLANTING flow may never write, because each one belongs to a
 * decision the manifest cannot make on the author's behalf.
 *
 * `visibility`, `state`, `exhibited` and `order` are the PUBLISHING decision,
 * which the Ariko admin deliberately gates behind picking a named member of a
 * vocabulary and a Save button (see CLAUDE.md's "no enum writes on the click
 * that opens it"). A manifest key that appeared to publish and silently did
 * not would be worse than a refusal: the author believes the thing is live,
 * and nothing anywhere looks wrong.
 *
 * `relations` is DERIVED, never authored — `lib/articles-store.ts` mirrors it
 * from the body's entity refs (`mergeMirrored(undefined, extractRefs(...))`),
 * and planting will do the same; a manifest value here would just be
 * overwritten or drift from what the body actually references.
 *
 * `parents` is containment, and re-homing an entity across pods/plants is a
 * privacy-cascade decision that belongs to the admin, not a text file. The
 * only parentage a manifest states is `pod.plant`, at creation.
 */
const FORBIDDEN_KEYS = ["visibility", "state", "exhibited", "order", "relations", "parents"] as const;

/**
 * Image keys that exist on ONE tier only: `cover` is a bean's (`Bean.cover`),
 * `media` is a sprout's (`Sprout.media`). Named per tier so a cover on a
 * sprout is refused with where it belongs, rather than parsing, writing
 * nothing, and leaving the author sure their screenshot went somewhere.
 */
const MISPLACED_IMAGE_KEYS: Record<"pod" | "bean" | "sprout", Array<[string, string]>> = {
  pod: [["cover", "a pod has no cover — put it on a bean"], ["media", "a pod has no media — put it on a sprout"]],
  bean: [["media", "a bean has no media — put it on one of its sprouts; a bean takes one cover"]],
  sprout: [["cover", "a sprout has no cover — put it on its bean; a sprout takes media"]],
};

/** The first forbidden key present on `raw`, as a full "`${where}.key`" error, or null. */
function checkForbiddenKeys(raw: Record<string, unknown>, where: string, tier: "pod" | "bean" | "sprout"): string | null {
  for (const key of FORBIDDEN_KEYS) {
    if (raw[key] !== undefined) {
      return `${where}.${key} is not allowed in a manifest`;
    }
  }
  for (const [key, why] of MISPLACED_IMAGE_KEYS[tier]) {
    if (raw[key] !== undefined) return `${where}.${key}: ${why}`;
  }
  return null;
}

/**
 * `Text`'s two halves against `MAX_CONTENT_BYTES`, measured the way the
 * article door measures them (`lib/content-edit.ts`) so the two doors agree
 * on what fits.
 */
function checkContentSize(text: Text, where: string): string | null {
  const parts: Array<[string, string | undefined]> =
    typeof text === "string" ? [["en", text]] : [["en", text.en], ["fr", text.fr]];
  for (const [lang, part] of parts) {
    if (part === undefined) continue;
    if (new TextEncoder().encode(part).length > MAX_CONTENT_BYTES) {
      return `${where}.${lang} exceeds ${MAX_CONTENT_BYTES / 1024} KiB`;
    }
  }
  return null;
}

/**
 * An image the manifest points at: a path RELATIVE TO THE MANIFEST FILE, and
 * an optional alt text. The manifest never carries a URL or a storage key —
 * those are minted by the upload at plant time (`lib/garden-assets.ts`), so a
 * file in a sibling repo can name a screenshot beside it and nothing else.
 * Written as a bare string (`cover: shots/import.png`) or a mapping
 * (`cover: { file: shots/import.png, alt: The import screen }`).
 */
export interface ManifestImage {
  file: string;
  alt?: string;
}

export interface ManifestSprout {
  slug: string;
  type: string;
  date: string;
  name: Text;
  description: Text;
  content?: Text;
  /** Images rendered in the sprout's body, in order. */
  media?: ManifestImage[];
}

export interface ManifestBean {
  slug: string;
  name: Text;
  description: Text;
  sprouts: ManifestSprout[];
  /** The bean's narrative — what it is now and how it got there — same rules as a pod's. */
  content?: Text;
  /** The one image on the bean's card and page head. */
  cover?: ManifestImage;
}

export interface ManifestPod {
  slug: string;
  name: Text;
  plant: string | null;
  description: Text;
  content?: Text;
}

export interface GardenManifest {
  pod: ManifestPod;
  beans: ManifestBean[];
}

export type ParseResult =
  | { ok: true; manifest: GardenManifest }
  | { ok: false; error: string };

/** A value that is a string, or "" — the coercion every slug/type field shares. */
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * A `{ en, fr }` pair from the file, composed into the garden's `Text`.
 *
 * Returns a tagged result rather than `Text | string`: `Text` itself can BE a
 * plain string (an en-only value, per `composeText`), so a bare string return
 * could not be told apart from a successfully composed one-language value.
 */
type TextResult = { ok: true; text: Text } | { ok: false; error: string };

function readText(value: unknown, where: string): TextResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: `${where} must be a mapping with an "en" key` };
  }
  const pair = value as Record<string, unknown>;
  const en = typeof pair.en === "string" ? pair.en : "";
  const fr = typeof pair.fr === "string" ? pair.fr : "";
  if (!en.trim()) return { ok: false, error: `${where}.en is required and must be non-blank` };
  return { ok: true, text: composeText(en, fr) };
}

/** Is `value` a plain mapping — object, non-null, non-array? */
function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Raster formats the upload door accepts (`lib/upload-input.ts`'s
 * ALLOWED_TYPES), keyed by extension so a manifest can be refused for a `.svg`
 * or a `.pdf` before any file is opened. SVG is absent on purpose there and
 * therefore here: it is an image the browser executes script from.
 */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

/** The MIME type a manifest image path implies, or null when the extension is not a raster we accept. */
export function imageMimeType(file: string): string | null {
  const ext = file.toLowerCase().split(".").pop() ?? "";
  return IMAGE_EXTENSIONS[ext] ?? null;
}

type ImageResult = { ok: true; image: ManifestImage } | { ok: false; error: string };

/**
 * `cover: path` or `cover: { file, alt }`. The path must be RELATIVE: an
 * absolute one names a file on the author's machine, which the maintainer
 * planting from another checkout does not have, and a `..` segment reaches
 * outside the repo the manifest describes. Both would fail later with an
 * ENOENT that says nothing about why; refusing here says it in the file's own
 * terms.
 */
function readImage(value: unknown, where: string): ImageResult {
  let file: unknown;
  let alt: unknown;
  if (typeof value === "string") {
    file = value;
  } else if (isMapping(value)) {
    file = value.file;
    alt = value.alt;
  } else {
    return { ok: false, error: `${where} must be a file path or a mapping with a "file" key` };
  }
  if (typeof file !== "string" || !file.trim()) {
    return { ok: false, error: `${where}.file is required` };
  }
  const path = file.trim();
  if (path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path) || path.split(/[\\/]/).includes("..")) {
    return { ok: false, error: `${where}.file must be a path relative to the manifest, inside the repo (got "${path}")` };
  }
  if (imageMimeType(path) === null) {
    return {
      ok: false,
      error: `${where}.file must be a raster image (${Object.keys(IMAGE_EXTENSIONS).join(", ")}) (got "${path}")`,
    };
  }
  if (alt !== undefined && typeof alt !== "string") {
    return { ok: false, error: `${where}.alt must be a string` };
  }
  const image: ManifestImage = { file: path };
  if (typeof alt === "string" && alt.trim()) image.alt = alt.trim();
  return { ok: true, image };
}

type PodResult = { ok: true; pod: ManifestPod } | { ok: false; error: string };

function buildPod(raw: Record<string, unknown>): PodResult {
  const name = readText(raw.name, "pod.name");
  if (!name.ok) return { ok: false, error: name.error };
  const description = readText(raw.description, "pod.description");
  if (!description.ok) return { ok: false, error: description.error };

  const slugError = checkSlug(raw.slug, "pod");
  if (slugError) return { ok: false, error: slugError };

  const forbiddenError = checkForbiddenKeys(raw, "pod", "pod");
  if (forbiddenError) return { ok: false, error: forbiddenError };

  const pod: ManifestPod = {
    slug: str(raw.slug),
    name: name.text,
    plant: typeof raw.plant === "string" && raw.plant.trim() ? raw.plant.trim() : null,
    description: description.text,
  };
  if (raw.content !== undefined) {
    const content = readText(raw.content, "pod.content");
    if (!content.ok) return { ok: false, error: content.error };
    const sizeError = checkContentSize(content.text, "pod.content");
    if (sizeError) return { ok: false, error: sizeError };
    pod.content = content.text;
  }
  return { ok: true, pod };
}

type SproutResult = { ok: true; sprout: ManifestSprout } | { ok: false; error: string };

function buildSprout(raw: Record<string, unknown>, where: string): SproutResult {
  const name = readText(raw.name, `${where}.name`);
  if (!name.ok) return { ok: false, error: name.error };
  const description = readText(raw.description, `${where}.description`);
  if (!description.ok) return { ok: false, error: description.error };

  const slugError = checkSlug(raw.slug, where);
  if (slugError) return { ok: false, error: slugError };

  const forbiddenError = checkForbiddenKeys(raw, where, "sprout");
  if (forbiddenError) return { ok: false, error: forbiddenError };

  const type = str(raw.type);
  if (!isSproutType(type)) {
    return { ok: false, error: `${where}.type must be non-blank with no surrounding whitespace (got "${type}")` };
  }

  // A YAML date scalar parses to a Date; force the authored text back.
  const date = raw.date instanceof Date ? raw.date.toISOString().slice(0, 10) : String(raw.date ?? "");
  if (!isTimelineDate(date)) {
    return { ok: false, error: `${where}.date must be YYYY-MM-DD (got "${date}")` };
  }

  const sprout: ManifestSprout = {
    slug: str(raw.slug),
    type,
    date,
    name: name.text,
    description: description.text,
  };
  if (raw.content !== undefined) {
    const content = readText(raw.content, `${where}.content`);
    if (!content.ok) return { ok: false, error: content.error };
    const sizeError = checkContentSize(content.text, `${where}.content`);
    if (sizeError) return { ok: false, error: sizeError };
    sprout.content = content.text;
  }
  if (raw.media !== undefined) {
    if (!Array.isArray(raw.media)) return { ok: false, error: `${where}.media must be a list of image paths` };
    const media: ManifestImage[] = [];
    for (let k = 0; k < raw.media.length; k += 1) {
      const image = readImage(raw.media[k], `${where}.media[${k}]`);
      if (!image.ok) return { ok: false, error: image.error };
      media.push(image.image);
    }
    sprout.media = media;
  }
  return { ok: true, sprout };
}

type BeanResult = { ok: true; bean: ManifestBean } | { ok: false; error: string };

function buildBean(raw: Record<string, unknown>, where: string): BeanResult {
  const name = readText(raw.name, `${where}.name`);
  if (!name.ok) return { ok: false, error: name.error };
  const description = readText(raw.description, `${where}.description`);
  if (!description.ok) return { ok: false, error: description.error };

  const slugError = checkSlug(raw.slug, where);
  if (slugError) return { ok: false, error: slugError };

  const forbiddenError = checkForbiddenKeys(raw, where, "bean");
  if (forbiddenError) return { ok: false, error: forbiddenError };

  const sproutsRaw = raw.sprouts ?? [];
  if (!Array.isArray(sproutsRaw)) return { ok: false, error: `${where}.sprouts must be a list` };

  const sprouts: ManifestSprout[] = [];
  for (let j = 0; j < sproutsRaw.length; j += 1) {
    const s = sproutsRaw[j];
    const swhere = `${where}.sprouts[${j}]`;
    if (!isMapping(s)) return { ok: false, error: `${swhere} must be a mapping` };
    const result = buildSprout(s, swhere);
    if (!result.ok) return { ok: false, error: result.error };
    sprouts.push(result.sprout);
  }

  const bean: ManifestBean = { slug: str(raw.slug), name: name.text, description: description.text, sprouts };
  // A bean's narrative is read exactly as a pod's: what the feature is now and
  // how it got there, rewritten in place. A dated piece of work is a sprout.
  if (raw.content !== undefined) {
    const content = readText(raw.content, `${where}.content`);
    if (!content.ok) return { ok: false, error: content.error };
    const sizeError = checkContentSize(content.text, `${where}.content`);
    if (sizeError) return { ok: false, error: sizeError };
    bean.content = content.text;
  }
  if (raw.cover !== undefined) {
    const cover = readImage(raw.cover, `${where}.cover`);
    if (!cover.ok) return { ok: false, error: cover.error };
    bean.cover = cover.image;
  }
  return { ok: true, bean };
}

export function parseManifest(yamlText: string): ParseResult {
  let doc: unknown;
  try {
    doc = load(yamlText);
  } catch (err) {
    return { ok: false, error: `YAML parse failed: ${(err as Error).message}` };
  }
  return buildManifest(doc);
}

function buildManifest(doc: unknown): ParseResult {
  if (typeof doc !== "object" || doc === null) {
    return { ok: false, error: "manifest must be a mapping with pod: and beans:" };
  }
  const root = doc as Record<string, unknown>;

  if (!isMapping(root.pod)) {
    return { ok: false, error: "pod must be a mapping" };
  }
  const podResult = buildPod(root.pod);
  if (!podResult.ok) return { ok: false, error: podResult.error };

  const beansRaw = root.beans ?? [];
  if (!Array.isArray(beansRaw)) return { ok: false, error: "beans must be a list" };

  const beans: ManifestBean[] = [];
  for (let i = 0; i < beansRaw.length; i += 1) {
    const b = beansRaw[i];
    const where = `beans[${i}]`;
    if (!isMapping(b)) return { ok: false, error: `${where} must be a mapping` };
    const result = buildBean(b, where);
    if (!result.ok) return { ok: false, error: result.error };
    beans.push(result.bean);
  }

  const dupError = findDuplicateSlug(podResult.pod, beans);
  if (dupError) return { ok: false, error: dupError };

  return { ok: true, manifest: { pod: podResult.pod, beans } };
}

/**
 * Pod, beans and sprouts share ONE slug namespace here — an AUTHORING guard,
 * not a database constraint. Mongo would accept it: `ensureBotanicalIndexes`
 * (`lib/botanical.ts`) creates a SEPARATE unique `{ slug: 1 }` index on each of
 * `pods`, `beans` and `sprouts`, so a pod `krabs` and a bean `krabs` insert
 * side by side and collide with nothing. Nothing downstream is ambiguous
 * either: every entity ref is tier-prefixed and `resolveEntity`
 * (`lib/entity-resolve.ts`) dispatches on that prefix, and the routes are
 * distinct (`/pod/[slug]`, `/bean/[id]`).
 *
 * It is refused because the confusion is the AUTHOR's, and it is expensive
 * where it lands: a manifest is prose plus refs, and a human — or an agent —
 * writing `pod:krabs` in a body while a bean named `krabs` sits three lines
 * below has no way to see which one they meant, and the resulting card points
 * at a real, wrong entity rather than rendering nothing. One slug namespace per
 * file makes every bare mention of a name unambiguous to read. The cost of the
 * rule is a rename in a text file before anything is written; the cost of not
 * having it is a wrong link nothing anywhere reports.
 */
function findDuplicateSlug(pod: ManifestPod, beans: ManifestBean[]): string | null {
  const seen = new Map<string, string>();
  const claim = (slug: string, where: string): string | null => {
    const prior = seen.get(slug);
    if (prior) return `duplicate slug "${slug}" at ${where} (first seen at ${prior})`;
    seen.set(slug, where);
    return null;
  };

  let error = claim(pod.slug, "pod");
  if (error) return error;

  for (let i = 0; i < beans.length; i += 1) {
    const bwhere = `beans[${i}]`;
    error = claim(beans[i].slug, bwhere);
    if (error) return error;
    for (let j = 0; j < beans[i].sprouts.length; j += 1) {
      error = claim(beans[i].sprouts[j].slug, `${bwhere}.sprouts[${j}]`);
      if (error) return error;
    }
  }
  return null;
}
