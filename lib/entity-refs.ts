import { resolveText, type Relation, type Text } from "./data";

const MIRRORED_KINDS = new Set(["embeds", "mentions"]);

// Block form ::entity{ref=…} at the start of a line (up to 3 leading spaces,
// same as CommonMark/remark-directive's leaf-block-start allowance — 4+
// spaces is an indented code block, which the renderer leaves as literal text
// and this must NOT match either, see the {0,3} below); inline form
// :entity[…]{ref=…} anywhere. Deliberately a scan, not a parse: this runs on
// every write, where a full mdast pass per document buys nothing — the
// grammar is fixed and narrow.
const BLOCK = /^ {0,3}::entity(?:\[[^\]\n]*\])?\{[^}]*\bref=([^\s}]+)/gm;
const INLINE = /(?<!:):entity\[[^\]]*\]\{[^}]*\bref=([^\s}]+)/g;

// Fenced code blocks and inline code spans render as literal text — the
// directive syntax inside them is never activated by remark-directive. Strip
// both before matching so a ref mentioned inside a code sample doesn't mint a
// phantom graph edge to something the page never actually links (prior art:
// paulopus's extractRelLinks does the same strip for the same reason). Order
// matters: strip whole fences first so an inline-code-looking backtick pair
// straddling a fence boundary doesn't get mis-parsed.
function stripCode(source: string): string {
  return source.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
}

// Pure. The refs a document points at, as relations ready to mirror.
export function extractRefs(content: Text | undefined): Relation[] {
  const raw = resolveText(content ?? "");
  if (!raw.trim()) return [];
  const source = stripCode(raw);
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
