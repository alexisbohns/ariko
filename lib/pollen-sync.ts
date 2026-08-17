import { validatePollen, type Pollen } from "./pollen";
import { isObject } from "./text-input";

// Pure sync core for the read model (spec §3). No DB, no fetch — transports
// and sinks are injected (lib/pollen-transports.ts, lib/pollen-store.ts).

// A cached envelope: the validated envelope plus sync provenance.
export interface PollenDoc extends Pollen {
  feedId: string;
  syncedAt: string;
}

export interface StoredRefusal {
  reason: string;
  raw: string; // capped — no silent loss, but no unbounded junk either
}

export const MAX_REFUSAL_RAW_BYTES = 4096;

function capRaw(value: unknown): string {
  let s: string;
  try {
    s = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  return s.length > MAX_REFUSAL_RAW_BYTES ? s.slice(0, MAX_REFUSAL_RAW_BYTES) : s;
}

export interface ProcessResult {
  valid: Pollen[];
  refusals: StoredRefusal[];
  warnings: string[];
}

// Partition one page: refusals are recorded, never fatal; warnings (non-core
// kinds) accompany a STORED envelope — generic handling, never rejection.
export function processEnvelopes(raw: unknown[]): ProcessResult {
  const valid: Pollen[] = [];
  const refusals: StoredRefusal[] = [];
  const warnings: string[] = [];
  for (const entry of raw) {
    const result = validatePollen(entry);
    if (result.ok) {
      valid.push(result.value);
      warnings.push(...result.warnings);
    } else {
      refusals.push({ reason: result.error, raw: capRaw(entry) });
    }
  }
  return { valid, refusals, warnings };
}

// Committed-feed-file transport core (POLLEN.md §Report): one envelope per
// line, blank lines ignored. The cursor is a line's envelope id; a cursor no
// longer present in the file is the 410-equivalent — the caller rebuilds from
// the top. Unparseable lines after the cursor surface as refusals.
export function sliceFeedFile(
  text: string,
  cursor: string | null,
): { entries: unknown[]; malformed: StoredRefusal[] } | "gone" {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const parsed = lines.map((line): { ok: true; value: unknown } | { ok: false; line: string } => {
    try {
      return { ok: true, value: JSON.parse(line) };
    } catch {
      return { ok: false, line };
    }
  });
  let start = 0;
  if (cursor !== null) {
    const idx = parsed.findIndex((p) => p.ok && isObject(p.value) && p.value.id === cursor);
    if (idx === -1) return "gone";
    start = idx + 1;
  }
  const entries: unknown[] = [];
  const malformed: StoredRefusal[] = [];
  for (const p of parsed.slice(start)) {
    if (p.ok) entries.push(p.value);
    else malformed.push({ reason: "unparseable ndjson line", raw: capRaw(p.line) });
  }
  return { entries, malformed };
}

// The consumer's cursor is the last processed envelope id — refused envelopes
// count as processed (they were recorded). Junk without a string id cannot
// carry a cursor; the loop's no-advance guard catches a page of only-junk.
export function lastEnvelopeId(envelopes: unknown[]): string | null {
  for (let i = envelopes.length - 1; i >= 0; i--) {
    const e = envelopes[i];
    if (isObject(e) && typeof e.id === "string" && e.id) return e.id;
  }
  return null;
}
