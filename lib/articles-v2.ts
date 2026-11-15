// lib/articles-v2.ts
//
// Pure validation for the v2 article door (spec 2026-11-14 §3.3): a repo token
// posts essays (draft sprouts of kind `essay`) and narratives (a pod's or a
// bean's `content`). Shape only — scope (is this slug in the token's plant?)
// is the store's, because it needs the database. First failure wins and names
// the offender, as validateArticlesPayload does.
//
// Six keys are refused BY NAME whatever their value, because each is a way to
// do something this door must not: publish (`state`, `visibility`,
// `exhibited`), pick a kind other than essay (`kind`, and `type`, the field
// `kind` replaced), or anchor outside `about` (`parents`).

import { isTimelineDate } from "./sprout-date";
import type { Text } from "./data";
import { SLUG, validateText } from "./articles";
import { imageProblems, type ImageHost } from "./article-images";
import { stagingProblems } from "./staging-check";

export interface EssayInput {
  slug: string;
  date: string;
  name: Text;
  description?: Text;
  content: Text;
  // Bare pod/bean slugs. Omitted: the essay is about the whole plant.
  about?: string[];
}

export interface NarrativeInput {
  slug: string;
  // The pod a NEW bean is created under (the plant has several). On an
  // existing bean it must name the pod it is already in.
  pod?: string;
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
const ESSAY_KEYS = ["slug", "date", "name", "description", "content", "about"];
const NARRATIVE_KEYS = ["slug", "pod", "name", "description", "content"];
const LEGACY_KEYS = ["container", "narrative", "articles"] as const;

export function isV2Shape(body: unknown): boolean {
  return typeof body === "object" && body !== null && ("essays" in body || "narratives" in body);
}

function parts(text: Text): [string, string][] {
  return typeof text === "string" ? [["", text]] : Object.entries(text).map(([k, v]) => [k, v ?? ""]);
}

// One message per half, staging first: a block refused by name explains an
// image problem inside it better than the image problem alone would.
function checkContent(who: string, content: Text, host: ImageHost | undefined): Check {
  for (const [lang, md] of parts(content)) {
    const problems = [...stagingProblems(md), ...imageProblems(md, host)];
    if (problems.length > 0)
      return { ok: false, error: `${who}: content${lang ? `.${lang}` : ""}: ${problems.join("; ")}` };
  }
  return { ok: true };
}

function checkCommon(raw: Record<string, unknown>, who: string, allowed: string[]): Check {
  for (const key of REFUSED_KEYS)
    if (key in raw) return { ok: false, error: `${who}: ${key} is not accepted on this door` };
  for (const key of Object.keys(raw))
    if (!allowed.includes(key)) return { ok: false, error: `${who}: unknown key ${key}` };
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

export function validateArticlesV2(body: unknown, opts: { host: ImageHost | undefined }): Check {
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
    const common = checkCommon(raw, who, ESSAY_KEYS);
    if (!common.ok) return common;
    if (seenEssays.has(raw.slug as string)) return { ok: false, error: `duplicate essay slug: ${raw.slug}` };
    seenEssays.add(raw.slug as string);
    const name = validateText(raw.name, `${who}: name`, { required: true });
    if (!name.ok) return name;
    if (typeof raw.date !== "string" || !isTimelineDate(raw.date))
      return { ok: false, error: `${who}: date is required (YYYY-MM-DD)` };
    if (raw.about !== undefined && (!Array.isArray(raw.about) || raw.about.length === 0))
      return {
        ok: false,
        error: `${who}: about must list pod or bean slugs — omit it for an essay about the whole plant`,
      };
    const seenAbout = new Set<string>();
    for (const a of (raw.about as unknown[] | undefined) ?? []) {
      if (typeof a !== "string" || !SLUG.test(a))
        return { ok: false, error: `${who}: about takes bare slugs (a pod's or a bean's), got ${String(a)}` };
      if (seenAbout.has(a)) return { ok: false, error: `${who}: about repeats ${a}` };
      seenAbout.add(a);
    }
    const checked = checkContent(who, raw.content as Text, opts.host);
    if (!checked.ok) return checked;
  }

  const seenNarratives = new Set<string>();
  for (const raw of narratives) {
    const who = whoOf(raw);
    const common = checkCommon(raw, who, NARRATIVE_KEYS);
    if (!common.ok) return common;
    if (seenNarratives.has(raw.slug as string))
      return { ok: false, error: `duplicate narrative slug: ${raw.slug}` };
    seenNarratives.add(raw.slug as string);
    if (raw.pod !== undefined && (typeof raw.pod !== "string" || !SLUG.test(raw.pod)))
      return { ok: false, error: `${who}: pod must be a bare pod slug` };
    if (raw.name !== undefined) {
      const name = validateText(raw.name, `${who}: name`, { required: true });
      if (!name.ok) return name;
    }
    const checked = checkContent(who, raw.content as Text, opts.host);
    if (!checked.ok) return checked;
  }
  return { ok: true };
}
