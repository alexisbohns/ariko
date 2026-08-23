import type { LocalizedText, Media, MediaImage, Source, SeedSuggestion, Text } from "./data";
import { detectEmbed } from "./embeds";
import { isObject, nonEmptyString, normalizeTextInput } from "./text-input";

// Hard cap for /api/inbox request bodies (spec 2026-07-18-c1-hardening §5):
// ~17× under Vercel's platform limit, far above any real seed.
export const MAX_INBOX_BODY_BYTES = 256 * 1024;

// Media as it arrives in a raw JSON payload. An embed may omit `provider` and
// `embedId` — but it may also DECLARE them, and if it does they are accepted
// and then ignored: normalizeMedia (below) re-derives both from the URL, every
// time, because provider decides whether something gets iframed and a provider
// a caller can set is no trust signal. The optional fields survive here so the
// wire format stays lenient, not because anything honours them. The stored
// `Media` type always carries a derived provider.
export type InputMedia =
  | { kind: "embed"; url: string; provider?: string; embedId?: string }
  | MediaImage;

export interface InboxInput {
  title: Text;
  body?: LocalizedText;
  content?: LocalizedText;
  media: Media[];
  source: Source;
  suggested?: SeedSuggestion;
}

export type ValidationResult =
  | { ok: true; value: InboxInput }
  | { ok: false; error: string };

// Boundary alias — the ONLY place legacy vocabulary survives the botanical
// rename. Sibling repos' lab-note payloads still send moleculeSlug/atomSlug
// over the wire; the repo slugs it carries (pbbls, femfolk, …) are PLANTS
// since the PR2 re-tiering, so the legacy molecule key maps to plantSlug.
// Canonical keys win when both are present. Internal code never aliases.
function normalizeSuggestion(s: unknown): SeedSuggestion | undefined {
  if (!isObject(s)) return undefined;
  const plant = s.plantSlug ?? s.moleculeSlug;
  const bean = s.beanSlug ?? s.atomSlug;
  const out: SeedSuggestion = {
    ...(nonEmptyString(plant) ? { plantSlug: plant } : {}),
    ...(nonEmptyString(s.podSlug) ? { podSlug: s.podSlug } : {}),
    ...(nonEmptyString(bean) ? { beanSlug: bean } : {}),
    ...(nonEmptyString(s.type) ? { type: s.type } : {}),
  };
  if (Array.isArray(s.tags)) {
    const tags = s.tags.filter((t): t is string => typeof t === "string");
    if (tags.length) out.tags = tags;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Images pass through; every embed's provider is DERIVED from its URL.
 *
 * A declared `provider` (and `embedId`) on an incoming payload is ignored, not
 * trusted. `provider` decides whether a URL is loaded into an iframe
 * (lib/embed-src.ts), so a caller-settable provider would be no trust signal at
 * all — it would let a payload claim "soundcloud" for any URL and be framed on
 * an allowlisted host. Hardening detectEmbed's host matching (lib/embeds.ts)
 * without closing this would lock the front door and leave the side one.
 *
 * The InputMedia type still carries the optional fields because that is the
 * shape /api/inbox ACCEPTS — accepting and honouring are different things, and
 * rejecting a payload for a field we can derive would be a needless break.
 */
export function normalizeMedia(media: InputMedia[]): Media[] {
  return media.map((m) => (m.kind === "image" ? m : detectEmbed(m.url)));
}

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

// Pure guard. Never touches the DB. Returns a normalized InboxInput or a clear
// error string (spec §7: malformed payloads are rejected, never silently dropped).
export function validateInboxPayload(body: unknown): ValidationResult {
  if (!isObject(body)) return { ok: false, error: "body must be a JSON object" };
  const title = normalizeTextInput(body.title);
  if (title === null) return { ok: false, error: "title is required" };
  if (!isObject(body.source) || !nonEmptyString(body.source.kind)) {
    return { ok: false, error: "source.kind is required" };
  }
  if (body.media !== undefined && !Array.isArray(body.media)) {
    return { ok: false, error: "media must be an array" };
  }

  const rawMedia = Array.isArray(body.media) ? (body.media as unknown[]) : [];
  const inputMedia: InputMedia[] = [];
  for (const m of rawMedia) {
    const entry = validateMediaEntry(m);
    if (!entry.ok) return { ok: false, error: entry.error };
    inputMedia.push(entry.value);
  }

  const src = body.source as Record<string, unknown>;
  if (src.url !== undefined && !nonEmptyString(src.url)) {
    return { ok: false, error: "source.url must be a non-empty string" };
  }
  if (src.externalId !== undefined && !nonEmptyString(src.externalId)) {
    return { ok: false, error: "source.externalId must be a non-empty string" };
  }
  const source: Source = {
    kind: src.kind as string,
    ...(nonEmptyString(src.url) ? { url: src.url } : {}),
    ...(nonEmptyString(src.externalId) ? { externalId: src.externalId } : {}),
  };

  const value: InboxInput = {
    title,
    media: normalizeMedia(inputMedia),
    source,
    ...(isObject(body.body) ? { body: body.body as LocalizedText } : {}),
    ...(isObject(body.content) ? { content: body.content as LocalizedText } : {}),
    ...((): { suggested?: SeedSuggestion } => {
      const suggested = normalizeSuggestion(body.suggested);
      return suggested ? { suggested } : {};
    })(),
  };
  return { ok: true, value };
}
