// Pure validation for the articles write door (POST /api/articles): given a
// container ref plus an optional narrative and/or batch of articles, checks
// shape only — no I/O, no Mongo. All-or-nothing, like validateDigestBatch in
// synthesis.ts: the first failure names the offender and refuses the whole
// payload. `state` is refused on the RAW article object whatever its value —
// this door is structurally incapable of publishing. DB-dependent refusals
// (an already-reviewed sprout, a published container) belong in the store,
// not here.

import { PLANT_PREFIX, POD_PREFIX, type Text } from "./data";

export interface ArticleInput {
  slug: string;
  name: Text;
  description?: Text;
  date: string;
  content: Text;
}

export interface ArticlesPayload {
  container: string;
  narrative?: Text;
  articles?: ArticleInput[];
}

export const MAX_CONTENT_BYTES = 64 * 1024;

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LANGS = ["en", "fr"] as const;

function tooBig(value: string): boolean {
  return Buffer.byteLength(value, "utf8") > MAX_CONTENT_BYTES;
}

// Shape check for a `Text` field on this door (#53): a plain string (the
// pre-bilingual form, still valid — no migration) or a `{ en?, fr? }` object.
//
// Three refusals are deliberate rather than merely defensive:
//  - an UNKNOWN language key is rejected rather than ignored. `{eng: "…"}` is
//    the typo this door will actually see, and tolerating it would store a Text
//    with no parts — publishing a page that renders blank, with the prose
//    silently discarded and no error to show for it.
//  - an object with NO parts is rejected for the same reason.
//  - the size cap applies PER PART, not to the pair: a bilingual article is two
//    articles' worth of prose, and capping the sum would punish translating.
//
// `required` additionally demands one part be non-blank after trimming, which
// is what `name` needs — `{ en: "  " }` is a name in no language at all.
function validateText(
  value: unknown,
  label: string,
  { required }: { required: boolean },
): { ok: true } | { ok: false; error: string } {
  if (typeof value === "string") {
    if (required && !value.trim()) return { ok: false, error: `${label} is required` };
    if (tooBig(value)) return { ok: false, error: `${label} must be at most 64 KiB` };
    return { ok: true };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { ok: false, error: `${label} must be a string or { en?, fr? }` };

  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key] of entries) {
    if (!(LANGS as readonly string[]).includes(key))
      return { ok: false, error: `${label}: unknown language key: ${key}` };
  }
  if (entries.length === 0)
    return { ok: false, error: `${label} must carry at least one language` };

  for (const [key, part] of entries) {
    if (typeof part !== "string")
      return { ok: false, error: `${label}.${key} must be a string` };
    if (tooBig(part)) return { ok: false, error: `${label}.${key} must be at most 64 KiB` };
  }
  if (required && !entries.some(([, part]) => (part as string).trim()))
    return { ok: false, error: `${label} is required` };
  return { ok: true };
}

export function validateArticlesPayload(body: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return { ok: false, error: "body must be an object" };
  const { container, narrative, articles } = body as Record<string, unknown>;

  const containerRest =
    typeof container === "string" && container.startsWith(PLANT_PREFIX)
      ? container.slice(PLANT_PREFIX.length)
      : typeof container === "string" && container.startsWith(POD_PREFIX)
        ? container.slice(POD_PREFIX.length)
        : null;
  if (containerRest === null || !SLUG.test(containerRest))
    return {
      ok: false,
      error: `container must be a plant: or pod: ref, got ${container || "nothing"}`,
    };

  if (narrative === undefined && articles === undefined)
    return { ok: false, error: "payload must carry narrative or articles (or both)" };

  if (narrative !== undefined) {
    const v = validateText(narrative, "narrative", { required: false });
    if (!v.ok) return v;
  }

  if (articles === undefined) return { ok: true };
  if (!Array.isArray(articles)) return { ok: false, error: "articles must be an array" };

  const seen = new Set<string>();
  for (const raw of articles) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return { ok: false, error: "every article must be an object" };
    const a = raw as Record<string, unknown>;
    const who = typeof a.slug === "string" && a.slug !== "" ? a.slug : "(missing slug)";

    // Checked first, on the raw object, before anything else validates — the
    // door structurally cannot publish, so any state key at all is refused.
    if ("state" in a) return { ok: false, error: `${who}: state is not accepted on this door` };

    if (typeof a.slug !== "string" || !SLUG.test(a.slug))
      return { ok: false, error: `${who}: slug must match ^[a-z0-9][a-z0-9-]*$` };
    if (seen.has(a.slug)) return { ok: false, error: `duplicate slug: ${a.slug}` };
    seen.add(a.slug);
    const name = validateText(a.name, `${who}: name`, { required: true });
    if (!name.ok) return name;
    if (a.description !== undefined) {
      const d = validateText(a.description, `${who}: description`, { required: false });
      if (!d.ok) return d;
    }
    if (typeof a.date !== "string" || !DATE.test(a.date))
      return { ok: false, error: `${who}: date is required (YYYY-MM-DD)` };
    const content = validateText(a.content, `${who}: content`, { required: false });
    if (!content.ok) return content;
  }

  return { ok: true };
}

// The garden's existing sprout-naming convention (wait-for-the-sun-0):
// re-posting an unreviewed article updates that same sprout in place, so a
// correction to a draft is simply a re-post, not a new sprout.
export function sproutSlugFor(articleSlug: string): string {
  return `${articleSlug}-0`;
}
