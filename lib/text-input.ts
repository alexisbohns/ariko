// Shared boundary helpers for raw JSON payloads (inbox, pollen). Extracted
// from lib/inbox.ts so every door enforces the same B1 Text shape.

import type { Text } from "./data";

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function nonEmptyString(v: unknown): v is string {
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
export function normalizeTextInput(v: unknown): Text | null {
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
