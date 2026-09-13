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

  const pod: ManifestPod = {
    slug: str(raw.slug),
    name: name.text,
    plant: typeof raw.plant === "string" && raw.plant.trim() ? raw.plant.trim() : null,
    description: description.text,
  };
  if (raw.content !== undefined) {
    const content = readText(raw.content, "pod.content");
    if (!content.ok) return { ok: false, error: content.error };
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

  const sprout: ManifestSprout = {
    slug: str(raw.slug),
    type: str(raw.type),
    // A YAML date scalar parses to a Date; force the authored text back.
    date: raw.date instanceof Date ? raw.date.toISOString().slice(0, 10) : String(raw.date ?? ""),
    name: name.text,
    description: description.text,
  };
  if (raw.content !== undefined) {
    const content = readText(raw.content, `${where}.content`);
    if (!content.ok) return { ok: false, error: content.error };
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

  return { ok: true, manifest: { pod: podResult.pod, beans } };
}
