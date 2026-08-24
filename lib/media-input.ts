import type { Media } from "./data";
import { normalizeMedia, validateMediaEntry, type InputMedia } from "./inbox";

/**
 * The admin media picker's wire format → normalized media.
 *
 * The picker (components/admin/media-picker.tsx) owns an ordered list and
 * emits the WHOLE list as repeated hidden fields, one JSON object each — so
 * reorder and remove never cross the wire as operations, and this function has
 * nothing to diff and no client-supplied intent to interpret.
 *
 * Malformed entries are DROPPED, not rejected: a hidden field is
 * client-controlled, and one bad entry must never cost a capture. That is the
 * opposite of validateInboxPayload's stance, deliberately — /api/inbox answers
 * a machine that can fix its payload and retry; this answers a person who is
 * mid-capture and cannot.
 *
 * Entries are shape-validated through the SAME validateMediaEntry /api/inbox
 * uses, and nothing more: there is no host allowlist on the stored URL. The
 * surface is admin-authenticated, and an arbitrary URL there is a hotlink, not
 * an injection — an <img src> cannot execute. Stated so the absence reads as a
 * decision (spec §3).
 */
export function parseMediaField(values: string[]): Media[] {
  const input: InputMedia[] = [];
  for (const raw of values) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const entry = validateMediaEntry(parsed);
    if (entry.ok) input.push(entry.value);
  }
  // Provider detection happens HERE, server-side, never in the browser.
  return normalizeMedia(input);
}
