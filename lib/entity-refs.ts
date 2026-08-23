import { resolveText, type Relation, type Text } from "./data";

const MIRRORED_KINDS = new Set(["embeds", "mentions"]);

// Block form ::entity{ref=…} at the start of a line (up to 3 leading spaces,
// same as CommonMark/remark-directive's leaf-block-start allowance — 4+
// spaces is an indented code block, which the renderer leaves as literal text
// and this must NOT match either, see the {0,3} below); inline form
// :entity[…]{ref=…} anywhere. Deliberately a scan, not a parse: this runs on
// every write, where a full mdast pass per document buys nothing — the
// grammar is fixed and narrow.
//
// The optional `(?:[ \t]*(?:>[ \t]*|(?:[-*+]|\d+[.)])[ \t]+)+)?` prefix
// tolerates a card living inside a blockquote or a list item — bullet
// (`-`, `*`, `+`) or ordered (`1.`, `1)`) — nested to any depth, INCLUDING the
// leading indentation a nested item carries (`  - ::entity{…}`,
// `    - ::entity{…}`), and a blockquote marker with no trailing space
// (`>::entity{…}`, CommonMark permits it, unlike a list marker). remark and
// the editor's marked tokenizer both already render a card for these because
// they parse the surrounding blockquote/list structure first and see the
// directive on its own dedented line; this is a flat scan over raw source, so
// it has to tolerate the markers (and their indentation) explicitly instead.
// Verified reachable from the editor itself: Tiptap's bullet/ordered list
// serializer emits exactly this indentation, e.g.
// `manager.serialize(manager.parse("- a\n  - ::entity{ref=bean:x}"))` round-
// trips byte-identically, indentation included.
//
// The leading `[ \t]*` is hoisted OUTSIDE the `+` repetition, matched once up
// front rather than once per marker — this is load-bearing, not stylistic. A
// per-iteration `[ \t]*` before each marker, as an earlier version of this
// regex had, is ambiguous: for a run of k whitespace characters sitting
// between two markers, the trailing `[ \t]+`/`[ \t]*` of one iteration and
// the leading `[ \t]*` of the next can split that run k different ways, and
// with n markers the engine explores k^n paths once the tail fails to match
// `::entity` — a catastrophic-backtracking DoS on adversarial input (measured
// on the earlier regex: single-digit ms at 60 bytes, ~2s at 81 bytes, minutes
// by ~110; `extractRefs` runs on every write, including the up-to-64-KiB
// `/api/articles` body, and a regex hang blocks Node's whole event loop).
// Hoisting the `[ \t]*` to run exactly once removes the ambiguity: every
// repetition after the first begins directly at a marker character, with no
// whitespace-consuming step immediately before another whitespace-consuming
// step, so there is only one way to parse a given input — linear, not
// exponential (verified: 0.28ms against 40 KB of the same adversarial shape).
//
// A marker still requires trailing whitespace before the next marker or the
// directive UNLESS it's a blockquote (`>` may be immediately followed by
// content), so a BARE run of leading spaces with no marker at all never
// satisfies the group — it always matches zero times, falling through to the
// plain ` {0,3}` below. That preserves the 4-space indented-code rule:
// `    ::entity{ref=x}` (four bare leading spaces, no quote/list marker)
// still matches nothing, because {0,3} can consume at most three of the four
// spaces, leaving a stray space before the literal `::entity`. A leading TAB
// behaves the same way (`\t::entity{…}` also matches nothing, by the same
// {0,3}-space-only rule) — see below for why that's an accepted trade-off.
//
// Known, accepted over-match: a scan is line-local and stateless, so
// `    - ::entity{ref=x}` (four raw spaces then a marker) is indistinguishable
// from the SAME line appearing as a genuinely nested list item two levels
// deep (e.g. after `- a\n  - b\n`) versus appearing bare at the top level,
// where CommonMark would actually treat those four spaces as an indented
// code block regardless of the marker that follows. This regex always reads
// it as a card. A leading tab before a marker (`\t- ::entity{ref=x}`) is a
// second instance of the same trade-off, for the same reason. Neither is as
// contained as it sounds, but it isn't a page/graph mismatch in the worrying
// direction either: filterPublic's scrubRelations and toGraph's both-ends
// prune guarantee a spurious edge to a dangling or private ref is invisible,
// so the failure mode is a visible-but-contained wrong edge at worst — never
// exposure of a private or nonexistent node — which is the lesser failure
// next to the missing-edge bug this widening exists to fix.
// Second top-level alternative (added for I1): a card sharing a list item
// with a PRECEDING paragraph serializes with no marker of its own — just
// bare indentation matching the item's content column, e.g.
// `- a\n  - b\n    ::entity{ref=bean:two}` (the card is `b`'s sibling inside
// the level-2 item, not a nested item itself). At depth 1 that bare indent is
// {0,3} and the plain fallback above already covers it; at depth 2+ it isn't
// — with the editor's 3-space list indent (see components/editor/prose-
// editor.tsx's `Markdown.configure`) it's 6 bare spaces, and no FIXED cap can
// accept that while still rejecting the required negative `    ::entity{ref=
// x}` (4 bare spaces, genuinely top-level): any cap wide enough for 6 already
// admits 4. The two are literally indistinguishable by looking at this line
// alone — the only real signal is the line before it. So this alternative
// looks one line back with a lookbehind: if the PREVIOUS line itself starts
// with a marker run (the same list/quote-marker group as above), this line
// is known to be inside that item's content, and its own leading whitespace
// is unconstrained. If the previous line has no marker at all — including
// the negative fixture, which has no previous line — this alternative simply
// doesn't apply and the plain {0,3} fallback still governs. Deliberately
// narrow: it only looks at the ONE immediately preceding line, so a card as
// a THIRD (or later) bare sibling in the same item — two bare paragraphs
// then a card — is not covered (an under-match, not an over-match; the
// editor's own list-item content is `[paragraph, block*]`-shaped per item
// today, so a card never actually has more than one bare sibling ahead of
// it in practice).
//
// Safety: reuses the exact same marker-run subpattern already verified
// non-backtracking below (the hoisted-`[ \t]*` fix), inside a lookbehind
// whose only additional piece is a single unambiguous `[^\n]*` run to the
// line's end — no nested quantifiers, so no new exponential path. Re-checked
// against the existing ReDoS regression (still ~0.2ms) and against harder
// adversarial input built from valid marker-run lines specifically to
// exercise this new lookbehind at every line (400 lines: ~0.4ms; ~400KB /
// 2000 lines: ~2ms) — linear, not quadratic.
// The lookbehind deliberately lets [^\n]* own everything after ONE marker
// character. Writing it as `>[ \t]*` / `[ \t]+` instead makes the trailing
// whitespace class overlap [^\n]*, and a right-to-left match then re-walks
// every split point of the preceding line: O(L^2) per line start. Measured on
// the ambiguous form, a 63 KiB body of whitespace-only lines took 970ms and
// blocked the event loop; this form takes 0.28ms. Same hazard the hoisted
// [ \t]* above already guards against, one layer down.
const BLOCK =
  /(?:^(?:[ \t]*(?:>[ \t]*|(?:[-*+]|\d+[.)])[ \t]+)+)? {0,3}|(?<=^[ \t]*(?:>|(?:[-*+]|\d+[.)])[ \t])[^\n]*\n)[ \t]*)::entity(?:\[[^\]\n]*\])?\{[^}]*\bref=([^\s}]+)/gm;
const INLINE = /(?<!:):entity\[[^\]]*\]\{[^}]*\bref=([^\s}]+)/g;

// Fenced code blocks and inline code spans render as literal text — the
// directive syntax inside them is never activated by remark-directive. CommonMark
// allows a fence to be either backticks or tildes, and remark treats both the
// same way, so both must be stripped or a ref inside a `~~~`-fenced sample
// mints a phantom edge. Strip both before matching so a ref mentioned inside a
// code sample doesn't mint a phantom graph edge to something the page never
// actually links (prior art: paulopus's extractRelLinks does the same strip
// for the same reason). Order matters: strip whole fences first so an
// inline-code-looking backtick pair straddling a fence boundary doesn't get
// mis-parsed.
function stripCode(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`]*`/g, "");
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
