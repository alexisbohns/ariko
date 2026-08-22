// Pure validation for the articles write door (POST /api/articles): given a
// container ref plus an optional narrative and/or batch of articles, checks
// shape only — no I/O, no Mongo. All-or-nothing, like validateDigestBatch in
// synthesis.ts: the first failure names the offender and refuses the whole
// payload. `state` is refused on the RAW article object whatever its value —
// this door is structurally incapable of publishing. DB-dependent refusals
// (an already-reviewed sprout, a published container) belong in the store,
// not here.

import { PLANT_PREFIX, POD_PREFIX } from "./data";

export interface ArticleInput {
  slug: string;
  name: string;
  description?: string;
  date: string;
  content: string;
}

export interface ArticlesPayload {
  container: string;
  narrative?: string;
  articles?: ArticleInput[];
}

export const MAX_CONTENT_BYTES = 64 * 1024;

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function tooBig(value: string): boolean {
  return Buffer.byteLength(value, "utf8") > MAX_CONTENT_BYTES;
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
    if (typeof narrative !== "string") return { ok: false, error: "narrative must be a string" };
    if (tooBig(narrative)) return { ok: false, error: "narrative must be at most 64 KiB" };
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
    if (typeof a.name !== "string" || !a.name.trim())
      return { ok: false, error: `${who}: name is required` };
    if (a.description !== undefined && typeof a.description !== "string")
      return { ok: false, error: `${who}: description must be a string` };
    if (typeof a.date !== "string" || !DATE.test(a.date))
      return { ok: false, error: `${who}: date is required (YYYY-MM-DD)` };
    if (typeof a.content !== "string") return { ok: false, error: `${who}: content must be a string` };
    if (tooBig(a.content)) return { ok: false, error: `${who}: content must be at most 64 KiB` };
  }

  return { ok: true };
}

// The garden's existing sprout-naming convention (wait-for-the-sun-0):
// re-posting an unreviewed article updates that same sprout in place, so a
// correction to a draft is simply a re-post, not a new sprout.
export function sproutSlugFor(articleSlug: string): string {
  return `${articleSlug}-0`;
}
