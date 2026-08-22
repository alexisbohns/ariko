import { resolveText, type Relation, type Text } from "./data";

const MIRRORED_KINDS = new Set(["embeds", "mentions"]);

// Block form ::entity{ref=…} at the start of a line; inline form :entity[…]{ref=…}
// anywhere. Deliberately a scan, not a parse: this runs on every write, where a
// full mdast pass per document buys nothing — the grammar is fixed and narrow.
const BLOCK = /^::entity\{[^}]*\bref=([^\s}]+)/gm;
const INLINE = /(?<!:):entity\[[^\]]*\]\{[^}]*\bref=([^\s}]+)/g;

// Pure. The refs a document points at, as relations ready to mirror.
export function extractRefs(content: Text | undefined): Relation[] {
  const source = resolveText(content ?? "");
  if (!source.trim()) return [];
  const out: Relation[] = [];
  const seen = new Set<string>();
  const add = (kind: string, ref: string) => {
    const key = `${kind} ${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, ref });
  };
  for (const m of source.matchAll(BLOCK)) add("embeds", m[1]);
  for (const m of source.matchAll(INLINE)) add("mentions", m[1]);
  return out;
}

// Pure. Mirrored relations are DERIVED state: every write drops the previous
// embeds/mentions and re-adds what the content says now, leaving hand-authored
// kinds untouched. Idempotent on unchanged content — which is what lets the
// graph keep reading stored refs instead of parsing prose.
export function mergeMirrored(existing: Relation[] | undefined, mirrored: Relation[]): Relation[] {
  return [...(existing ?? []).filter((r) => !MIRRORED_KINDS.has(r.kind)), ...mirrored];
}
