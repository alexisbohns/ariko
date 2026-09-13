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

  const podRaw = root.pod;
  if (typeof podRaw !== "object" || podRaw === null) {
    return { ok: false, error: "pod: is required" };
  }
  const p = podRaw as Record<string, unknown>;

  const podName = readText(p.name, "pod.name");
  if (!podName.ok) return { ok: false, error: podName.error };
  const podDescription = readText(p.description, "pod.description");
  if (!podDescription.ok) return { ok: false, error: podDescription.error };

  const pod: ManifestPod = {
    slug: typeof p.slug === "string" ? p.slug : "",
    name: podName.text,
    plant: typeof p.plant === "string" && p.plant.trim() ? p.plant.trim() : null,
    description: podDescription.text,
  };
  if (p.content !== undefined) {
    const content = readText(p.content, "pod.content");
    if (!content.ok) return { ok: false, error: content.error };
    pod.content = content.text;
  }

  const beansRaw = root.beans ?? [];
  if (!Array.isArray(beansRaw)) return { ok: false, error: "beans: must be a list" };

  const beans: ManifestBean[] = [];
  for (let i = 0; i < beansRaw.length; i += 1) {
    const b = beansRaw[i] as Record<string, unknown>;
    const where = `beans[${i}]`;
    if (typeof b !== "object" || b === null) {
      return { ok: false, error: `${where} must be a mapping` };
    }
    const name = readText(b.name, `${where}.name`);
    if (!name.ok) return { ok: false, error: name.error };
    const description = readText(b.description, `${where}.description`);
    if (!description.ok) return { ok: false, error: description.error };

    const sproutsRaw = b.sprouts ?? [];
    if (!Array.isArray(sproutsRaw)) return { ok: false, error: `${where}.sprouts must be a list` };

    const sprouts: ManifestSprout[] = [];
    for (let j = 0; j < sproutsRaw.length; j += 1) {
      const s = sproutsRaw[j] as Record<string, unknown>;
      const swhere = `${where}.sprouts[${j}]`;
      if (typeof s !== "object" || s === null) {
        return { ok: false, error: `${swhere} must be a mapping` };
      }
      const sname = readText(s.name, `${swhere}.name`);
      if (!sname.ok) return { ok: false, error: sname.error };
      const sdescription = readText(s.description, `${swhere}.description`);
      if (!sdescription.ok) return { ok: false, error: sdescription.error };

      const sprout: ManifestSprout = {
        slug: typeof s.slug === "string" ? s.slug : "",
        type: typeof s.type === "string" ? s.type : "",
        // A YAML date scalar parses to a Date; force the authored text back.
        date: s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date ?? ""),
        name: sname.text,
        description: sdescription.text,
      };
      if (s.content !== undefined) {
        const content = readText(s.content, `${swhere}.content`);
        if (!content.ok) return { ok: false, error: content.error };
        sprout.content = content.text;
      }
      sprouts.push(sprout);
    }

    beans.push({
      slug: typeof b.slug === "string" ? b.slug : "",
      name: name.text,
      description: description.text,
      sprouts,
    });
  }

  return { ok: true, manifest: { pod, beans } };
}
