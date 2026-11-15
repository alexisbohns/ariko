// Shared text rules for the article door (POST /api/articles): the per-part size
// ceiling, the slug grammar, and `validateText`, the shape check for a `Text`
// field. The door's own payload is validated by lib/articles-v2.ts; this file
// holds only what that validator and the admin's content patch share.
//
// The legacy `{ container, narrative, articles }` validator that used to live
// here went with the ARTICLES_TOKEN door (retired 2026-11-15).

// Per part, per language. Was 64 KiB when the largest article was ~12 KB; the
// first long-form article outgrew it. It is an authoring ceiling, not a
// platform one — server actions accept ~4 MiB (next.config.ts) and a Mongo
// document 16 MiB — so the number is headroom, chosen well under both. The
// editor re-serializes the whole document on every burst of typing, which is
// the cost that grows with it. `lib/content-edit.ts` re-exports this, so the
// authoring door and the article door cannot drift apart.
export const MAX_CONTENT_BYTES = 512 * 1024;
const MAX_CONTENT_LABEL = `${MAX_CONTENT_BYTES / 1024} KiB`;

export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
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
export function validateText(
  value: unknown,
  label: string,
  { required }: { required: boolean },
): { ok: true } | { ok: false; error: string } {
  if (typeof value === "string") {
    if (required && !value.trim()) return { ok: false, error: `${label} is required` };
    if (tooBig(value)) return { ok: false, error: `${label} must be at most ${MAX_CONTENT_LABEL}` };
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
    if (tooBig(part)) return { ok: false, error: `${label}.${key} must be at most ${MAX_CONTENT_LABEL}` };
  }
  if (required && !entries.some(([, part]) => (part as string).trim()))
    return { ok: false, error: `${label} is required` };
  return { ok: true };
}
