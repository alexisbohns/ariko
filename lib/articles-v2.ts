// lib/articles-v2.ts
//
// Pure validation for the v2 article door (spec 2026-11-14 §3.3): a repo token
// posts essays (draft sprouts of kind `essay`) and narratives (its pod's or a
// bean's `content`). Shape only — scope (is this slug in the token's pod?) is
// the store's, because it needs the database. First failure wins and names
// the offender, as validateArticlesPayload does.
//
// Six keys are refused BY NAME whatever their value, because each is a way to
// do something this door must not: publish (`state`, `visibility`,
// `exhibited`), pick a kind other than essay (`kind`, and `type`, the field
// `kind` replaced), or anchor outside `about` (`parents`).

import { isTimelineDate } from "./sprout-date";
import type { Text } from "./data";
import { SLUG, validateText } from "./articles";
import { imageProblems } from "./article-images";

export interface EssayInput {
  slug: string;
  date: string;
  name: Text;
  description?: Text;
  content: Text;
  about: string[];
}

export interface NarrativeInput {
  slug: string;
  name?: Text;
  description?: Text;
  content: Text;
}

export interface ArticlesV2 {
  essays?: EssayInput[];
  narratives?: NarrativeInput[];
}

type Check = { ok: true } | { ok: false; error: string };

const REFUSED_KEYS = ["state", "visibility", "kind", "type", "parents", "exhibited"] as const;
const LEGACY_KEYS = ["container", "narrative", "articles"] as const;

export function isV2Shape(body: unknown): boolean {
  return typeof body === "object" && body !== null && ("essays" in body || "narratives" in body);
}

function parts(text: Text): [string, string][] {
  return typeof text === "string" ? [["", text]] : Object.entries(text).map(([k, v]) => [k, v ?? ""]);
}

function checkImages(who: string, content: Text, cloud: string | undefined): Check {
  for (const [lang, md] of parts(content)) {
    const problems = imageProblems(md, cloud);
    if (problems.length > 0)
      return { ok: false, error: `${who}: content${lang ? `.${lang}` : ""}: ${problems[0]}` };
  }
  return { ok: true };
}

function checkCommon(raw: Record<string, unknown>, who: string): Check {
  for (const key of REFUSED_KEYS)
    if (key in raw) return { ok: false, error: `${who}: ${key} is not accepted on this door` };
  if (typeof raw.slug !== "string" || !SLUG.test(raw.slug))
    return { ok: false, error: `${who}: slug must match ^[a-z0-9][a-z0-9-]*$` };
  if (raw.description !== undefined) {
    const d = validateText(raw.description, `${who}: description`, { required: false });
    if (!d.ok) return d;
  }
  return validateText(raw.content, `${who}: content`, { required: true });
}

function eachObject(list: unknown, label: string): Check | Record<string, unknown>[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) return { ok: false, error: `${label} must be an array` };
  for (const item of list)
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return { ok: false, error: `every ${label.slice(0, -1)} must be an object` };
  return list as Record<string, unknown>[];
}

const whoOf = (raw: Record<string, unknown>) =>
  typeof raw.slug === "string" && raw.slug !== "" ? raw.slug : "(missing slug)";

export function validateArticlesV2(body: unknown, opts: { cloud: string | undefined }): Check {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return { ok: false, error: "body must be an object" };
  const b = body as Record<string, unknown>;
  for (const key of LEGACY_KEYS)
    if (key in b) return { ok: false, error: `${key} is a legacy key — v2 takes essays and narratives only` };

  const essays = eachObject(b.essays, "essays");
  if (!Array.isArray(essays)) return essays;
  const narratives = eachObject(b.narratives, "narratives");
  if (!Array.isArray(narratives)) return narratives;
  if (essays.length + narratives.length === 0)
    return { ok: false, error: "payload must carry at least one essay or narrative" };

  const seenEssays = new Set<string>();
  for (const raw of essays) {
    const who = whoOf(raw);
    const common = checkCommon(raw, who);
    if (!common.ok) return common;
    if (seenEssays.has(raw.slug as string)) return { ok: false, error: `duplicate essay slug: ${raw.slug}` };
    seenEssays.add(raw.slug as string);
    const name = validateText(raw.name, `${who}: name`, { required: true });
    if (!name.ok) return name;
    if (typeof raw.date !== "string" || !isTimelineDate(raw.date))
      return { ok: false, error: `${who}: date is required (YYYY-MM-DD)` };
    if (!Array.isArray(raw.about) || raw.about.length === 0)
      return { ok: false, error: `${who}: about must name at least one of the pod or its beans` };
    const seenAbout = new Set<string>();
    for (const a of raw.about) {
      if (typeof a !== "string" || !SLUG.test(a))
        return { ok: false, error: `${who}: about takes bare slugs (the pod's or a bean's), got ${String(a)}` };
      if (seenAbout.has(a)) return { ok: false, error: `${who}: about repeats ${a}` };
      seenAbout.add(a);
    }
    const images = checkImages(who, raw.content as Text, opts.cloud);
    if (!images.ok) return images;
  }

  const seenNarratives = new Set<string>();
  for (const raw of narratives) {
    const who = whoOf(raw);
    const common = checkCommon(raw, who);
    if (!common.ok) return common;
    if (seenNarratives.has(raw.slug as string))
      return { ok: false, error: `duplicate narrative slug: ${raw.slug}` };
    seenNarratives.add(raw.slug as string);
    if (raw.name !== undefined) {
      const name = validateText(raw.name, `${who}: name`, { required: true });
      if (!name.ok) return name;
    }
    const images = checkImages(who, raw.content as Text, opts.cloud);
    if (!images.ok) return images;
  }
  return { ok: true };
}
