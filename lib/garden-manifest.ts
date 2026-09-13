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

/** The first forbidden key present on `raw`, as a full "`${where}.key`" error, or null. */
function checkForbiddenKeys(raw: Record<string, unknown>, where: string): string | null {
  for (const key of FORBIDDEN_KEYS) {
    if (raw[key] !== undefined) {
      return `${where}.${key} is not allowed in a manifest`;
    }
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

export interface ManifestSprout {
  slug: string;
  type: string;
  date: string;
  name: Text;
  description: Text;
  content?: Text;
}

export interface ManifestBean {
  slug: string;
  name: Text;
  description: Text;
  sprouts: ManifestSprout[];
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

type PodResult = { ok: true; pod: ManifestPod } | { ok: false; error: string };

function buildPod(raw: Record<string, unknown>): PodResult {
  const name = readText(raw.name, "pod.name");
  if (!name.ok) return { ok: false, error: name.error };
  const description = readText(raw.description, "pod.description");
  if (!description.ok) return { ok: false, error: description.error };

  const slugError = checkSlug(raw.slug, "pod");
  if (slugError) return { ok: false, error: slugError };

  const forbiddenError = checkForbiddenKeys(raw, "pod");
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

  const forbiddenError = checkForbiddenKeys(raw, where);
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

  const forbiddenError = checkForbiddenKeys(raw, where);
  if (forbiddenError) return { ok: false, error: forbiddenError };

  // A `Bean` has no `content` field at all — only `Pod` and `Plant` carry
  // narrative markdown (see the `Bean` and `Pod` interfaces in lib/data.ts).
  // A bean's prose belongs in a SPROUT hanging from it. Without this check
  // the key would parse, write nothing, and lose the author's prose in
  // silence — the mistake this message exists to head off.
  if (raw.content !== undefined) {
    return {
      ok: false,
      error: `${where}.content: a bean has no content field — put this in one of its sprouts instead`,
    };
  }

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

  return {
    ok: true,
    bean: { slug: str(raw.slug), name: name.text, description: description.text, sprouts },
  };
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
