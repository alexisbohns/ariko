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

// One page from a transport. done:true ends the loop after processing (file
// transport is single-page); http transports set done when the page is empty
// ("empty array ⇒ caught up"). "gone" = upstream 410 / vanished file cursor.
export type FeedPage =
  | { envelopes: unknown[]; extraRefusals?: StoredRefusal[]; done: boolean }
  | "gone";

export interface FeedTransport {
  fetchPage(cursor: string | null): Promise<FeedPage>;
}

export interface PollenSink {
  getCursor(feedId: string): Promise<string | null>;
  setCursor(feedId: string, cursor: string | null, status: string, error?: string): Promise<void>;
  insertNew(feedId: string, envelopes: Pollen[]): Promise<number>; // write-once; returns newly stored
  recordRefusals(feedId: string, refusals: StoredRefusal[]): Promise<void>;
  projectBeans(feedId: string, envelopes: Pollen[]): Promise<number>;
}

export interface FeedResult {
  feedId: string;
  stored: number;
  refused: number;
  status: "ok" | "error";
  error?: string;
}

// Cursor-synced ingest of one feed. Idempotent by construction: write-once
// inserts converge on replay, the cursor advances per page (a crashed run
// re-covers at most one page — latency, never correctness), and a 410/gone
// resets the cursor exactly once per run. One feed's failure never throws:
// it lands on the cursor doc and in the result (umbrella §11, no silent loss).
export async function syncFeed(
  feedId: string,
  transport: FeedTransport,
  sink: PollenSink,
): Promise<FeedResult> {
  let stored = 0;
  let refused = 0;
  try {
    let cursor = await sink.getCursor(feedId);
    let rebuilt = false;
    for (;;) {
      const page = await transport.fetchPage(cursor);
      if (page === "gone") {
        if (rebuilt) throw new Error("cursor gone again after rebuild");
        rebuilt = true;
        cursor = null;
        await sink.setCursor(feedId, null, "rebuilding");
        continue;
      }
      const { valid, refusals, warnings } = processEnvelopes(page.envelopes);
      for (const w of warnings) console.warn(`[pollen:${feedId}] ${w}`);
      const allRefusals = [...(page.extraRefusals ?? []), ...refusals];
      if (valid.length > 0) {
        stored += await sink.insertNew(feedId, valid);
        await sink.projectBeans(feedId, valid);
      }
      if (allRefusals.length > 0) {
        refused += allRefusals.length;
        await sink.recordRefusals(feedId, allRefusals);
      }
      const next = lastEnvelopeId(page.envelopes) ?? cursor;
      if (page.envelopes.length > 0 && next === cursor && !page.done) {
        throw new Error("cursor failed to advance — page carries no usable id");
      }
      cursor = next;
      await sink.setCursor(feedId, cursor, "ok");
      if (page.done || page.envelopes.length === 0) break;
    }
    return { feedId, stored, refused, status: "ok" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // Best effort: surface the failure on the cursor doc without clobbering
    // the cursor itself (the next run resumes where this one stopped).
    try {
      await sink.setCursor(feedId, await sink.getCursor(feedId), "error", error);
    } catch {
      // the sink itself is down — the FeedResult still carries the error
    }
    return { feedId, stored, refused, status: "error", error };
  }
}
