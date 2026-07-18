import type { LocalizedText, Media, MediaImage, Source, CaptureSuggestion, Text } from "./data";
import { detectEmbed } from "./embeds";

// Hard cap for /api/inbox request bodies (spec 2026-07-18-c1-hardening §5):
// ~17× under Vercel's platform limit, far above any real capture.
export const MAX_INBOX_BODY_BYTES = 256 * 1024;

// Media as it arrives in a raw JSON payload: an embed may omit `provider`
// (we detect it), while the stored `Media` type always has one.
export type InputMedia =
  | { kind: "embed"; url: string; provider?: string; embedId?: string }
  | MediaImage;

export interface InboxInput {
  title: Text;
  body?: LocalizedText;
  content?: LocalizedText;
  media: Media[];
  source: Source;
  suggested?: CaptureSuggestion;
}

export type ValidationResult =
  | { ok: true; value: InboxInput }
  | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// One language part of an incoming Text: absent is fine, non-strings are junk,
// blank strings are dropped (mirrors composeText's blank-part behavior).
function textPartInput(v: unknown): { ok: boolean; part?: string } {
  if (v === undefined) return { ok: true };
  if (typeof v !== "string") return { ok: false };
  const t = v.trim();
  return t ? { ok: true, part: t } : { ok: true };
}

// The B1 Text shape at the payload boundary: a non-empty string, or { en?, fr? }
// with at least one non-empty part. Null means invalid.
function normalizeTextInput(v: unknown): Text | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : null;
  }
  if (isObject(v)) {
    const en = textPartInput(v.en);
    const fr = textPartInput(v.fr);
    if (!en.ok || !fr.ok) return null;
    if (!en.part && !fr.part) return null;
    return { ...(en.part ? { en: en.part } : {}), ...(fr.part ? { fr: fr.part } : {}) };
  }
  return null;
}

// Fill provider for bare embeds; pass images and already-typed embeds through.
export function normalizeMedia(media: InputMedia[]): Media[] {
  return media.map((m) => {
    if (m.kind === "image") return m;
    if (!m.provider) return detectEmbed(m.url);
    return {
      kind: "embed",
      provider: m.provider,
      url: m.url,
      ...(m.embedId ? { embedId: m.embedId } : {}),
    };
  });
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
    if (!isObject(m)) return { ok: false, error: "each media entry must be an object" };
    if (m.kind === "embed") {
      if (!nonEmptyString(m.url)) return { ok: false, error: "embed media requires a url" };
      inputMedia.push({
        kind: "embed",
        url: m.url,
        ...(nonEmptyString(m.provider) ? { provider: m.provider } : {}),
        ...(nonEmptyString(m.embedId) ? { embedId: m.embedId } : {}),
      });
    } else if (m.kind === "image") {
      if (!nonEmptyString(m.storageKey) || !nonEmptyString(m.url)) {
        return { ok: false, error: "image media requires storageKey and url" };
      }
      inputMedia.push({
        kind: "image",
        storageKey: m.storageKey,
        url: m.url,
        ...(nonEmptyString(m.alt) ? { alt: m.alt } : {}),
        ...(typeof m.width === "number" ? { width: m.width } : {}),
        ...(typeof m.height === "number" ? { height: m.height } : {}),
      });
    } else {
      return { ok: false, error: "media entry kind must be 'embed' or 'image'" };
    }
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
    ...(isObject(body.suggested) ? { suggested: body.suggested as CaptureSuggestion } : {}),
  };
  return { ok: true, value };
}
