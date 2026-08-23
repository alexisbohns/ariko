import { Node, type JSONContent, type MarkdownToken } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Image } from "@tiptap/extension-image";
import { ListItem, TaskList, TaskItem } from "@tiptap/extension-list";

/**
 * The EDITOR's half of the entity grammar (compose spec §2.2).
 *
 * The public site parses this syntax with remark (`lib/markdown.ts`); the editor
 * parses it with marked, which is what `@tiptap/markdown` runs on. Two parsers
 * over one format is this slice's central risk; `lib/markdown-conformance.test.ts`
 * keeps them honest — re-run it before changing anything here.
 *
 * Tiptap's built-in `createAtomBlockMarkdownSpec` / `createInlineMarkdownSpec`
 * are deliberately unused: they emit Pandoc `:::name {attrs}` (three colons) and
 * shortcodes `[name attrs]…[/name]`. Neither is our grammar (spec §6.1).
 */

// I2: marked's block-level "is this a list?" check (`Tokenizer.list`'s
// `rules.block.list` regex) requires its optional trailing-content group to
// consume at least ONE character beyond the marker's required whitespace —
// `([ \t][^\n]+?)?`, note the `+?`, not `*?`. A marker with NOTHING after it
// (`-\n`) matches (the whole group is skipped), and a marker with TWO OR
// MORE trailing characters (`-  \n`, `- x`) also matches (the group has
// enough to satisfy both the whitespace and the `+?`). A marker followed by
// EXACTLY one trailing space or tab and nothing else (`- \n`) matches
// NEITHER shape: the group can't consume just the one whitespace character
// on its own. That line falls through to being read as plain paragraph text
// instead of the empty list item CommonMark (and remark) agree it is —
// confirmed upstream in marked (its own per-item `listItemRegex` gets this
// right, with `[^\n]*`, zero-or-more; only this block-start check doesn't).
//
// This is round-trip DATA LOSS, not a display difference: opening a stored
// document with an empty list item ahead of a card
// (`- \n  ::entity{ref=…}`) mis-parses the list away from the moment it
// loads — the card becomes an orphaned top-level node, the "- " becomes
// literal paragraph text — and the next save writes that corruption back
// permanently. A narrow, targeted fix beats pinning it: strip the one
// character that trips marked's check, before marked ever sees the text.
//
// Deliberately narrow — touches ONLY a line that is entirely a 0-3-space-
// indented list marker (bullet or ordered) followed by exactly one trailing
// space or tab and nothing else, turning it into the shape marked already
// handles correctly (no trailing whitespace at all). Never touches a marker
// with real content after it, and is a no-op on every other line. Not fence-
// aware, unlike lib/entity-refs.ts's stripCode: a fenced code sample whose
// literal content happens to be exactly "- " on its own line loses that one
// trailing space too. Accepted — fence-tracking a preprocessing pass over
// raw markdown is real complexity for a change nobody would ever notice in a
// code sample, and it cannot make the data-loss bug this exists to fix any
// worse. Applied to `initialMarkdown` before it reaches `useEditor`
// (components/editor/prose-editor.tsx) — the one place stored markdown
// becomes marked's input — and mirrored in lib/markdown-conformance.test.ts's
// `roundTrip` helper so the tests exercise the same input the editor does.
export function normalizeEmptyListMarkers(markdown: string): string {
  return markdown.replace(/^( {0,3}(?:[-*+]|\d{1,9}[.)]))[ \t]$/gm, "$1");
}

// Shares two rules with lib/entity-refs.ts's BLOCK/INLINE: the {0,3} leading-space
// allowance (four is an indented code block) and "ref can appear anywhere in the
// braces". Deliberately does NOT share those regexes' looseness: entity-refs.ts's
// BLOCK/INLINE don't require a closing brace or end-of-line, because that's a
// scanner minting derived graph edges — over-matching there costs one spurious
// edge at worst. Here `raw` tells marked how far to advance its cursor, so
// over-matching would corrupt the rest of the document; these require a closing
// `}` and, for the block form, that the directive owns its whole line.
const REF = /\bref=([^\s}]+)/;
const BLOCK = /^ {0,3}::entity(?:\[[^\]\n]*\])?\{([^}\n]*)\}[ \t]*(?:\n|$)/;
const INLINE = /^:entity\[([^\]\n]*)\]\{([^}\n]*)\}/;

interface EntityCardToken extends MarkdownToken {
  ref: string;
}
interface EntityMentionToken extends MarkdownToken {
  ref: string;
  label: string;
}

export const EntityCard = Node.create({
  name: "entityCard",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes: () => ({ ref: { default: null } }),

  parseHTML: () => [{ tag: "entity-card" }],
  renderHTML: ({ HTMLAttributes }) => ["entity-card", HTMLAttributes],

  markdownTokenizer: {
    name: "entityCard",
    level: "block",
    // marked calls `start` with `src.slice(1)`, so a leading `^` here would
    // assert at real offset 1, not 0 — and a directive at true offset 0 is
    // reached by the block tokenizer directly, so `^` buys nothing anyway.
    // `(?:\[|\{)` also catches the labeled block form (`::entity[Label]{…}`)
    // as an early paragraph-interrupt point, not just the bare `{` form.
    // Landing on the preceding newline rather than the colons is safe — it
    // only ever cuts a paragraph earlier, never later.
    start: (src: string) => src.search(/\n {0,3}::entity(?:\[|\{)/),
    tokenize: (src: string) => {
      const m = BLOCK.exec(src);
      if (!m) return;
      const ref = REF.exec(m[1])?.[1];
      // No ref, no node — the one rule shared with remarkEntity's ref-less
      // branch (lib/markdown.ts).
      if (!ref) return;
      return { type: "entityCard", raw: m[0], ref } as EntityCardToken;
    },
  },
  parseMarkdown: (token: MarkdownToken) => ({
    type: "entityCard",
    attrs: { ref: (token as EntityCardToken).ref },
  }),
  renderMarkdown: (node: JSONContent) => {
    // No ref, no markdown: mirrors the parse-side rule and avoids emitting
    // `::entity{ref=undefined}`, which would re-parse as a bogus real ref. A
    // ref containing `}` or whitespace is guarded the same way and for the
    // same reason: `}` closes the brace early and drops the whole card on
    // re-parse, and whitespace gets silently truncated by REF — either way
    // the ref is lost, which is worse than emitting nothing.
    const ref = node.attrs?.ref;
    if (!ref || /[\s}]/.test(ref)) return "";
    return `::entity{ref=${ref}}`;
  },
});

export const EntityMention = Node.create({
  name: "entityMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes: () => ({ ref: { default: null }, label: { default: "" } }),

  parseHTML: () => [{ tag: "entity-link" }],
  renderHTML: ({ HTMLAttributes }) => ["entity-link", HTMLAttributes],

  markdownTokenizer: {
    name: "entityMention",
    level: "inline",
    // The lookbehind is the block form's guard: `::entity[…]` must not be read
    // as an inline mention preceded by a stray colon. It only sees characters
    // within the slice marked hands it, so the block tokenizer's own BLOCK
    // regex (which now recognizes the labeled block form) is what actually
    // keeps `::entity[Label]{ref=…}` from ever reaching this tokenizer as a
    // block-starting line — this guard alone can't see far enough back.
    start: (src: string) => src.search(/(?<!:):entity\[/),
    tokenize: (src: string) => {
      const m = INLINE.exec(src);
      if (!m) return;
      const ref = REF.exec(m[2])?.[1];
      if (!ref) return;
      return { type: "entityMention", raw: m[0], label: m[1], ref } as EntityMentionToken;
    },
  },
  parseMarkdown: (token: MarkdownToken) => ({
    type: "entityMention",
    attrs: {
      ref: (token as EntityMentionToken).ref,
      label: (token as EntityMentionToken).label,
    },
  }),
  renderMarkdown: (node: JSONContent) => {
    // No ref, no markdown: see EntityCard's renderMarkdown above — same guard,
    // same reasoning.
    const ref = node.attrs?.ref;
    if (!ref || /[\s}]/.test(ref)) return "";
    // `[` and `]` in the label would otherwise close the markdown label early
    // and desync the brace count, silently dropping the whole mention on
    // re-parse. A display label losing a bracket is benign; silently losing
    // the reference is not — so strip rather than escape, then collapse the
    // double space a bracket's removal can leave behind.
    const label = String(node.attrs?.label ?? "")
      .replace(/[[\]]/g, "")
      .replace(/ {2,}/g, " ");
    return `:entity[${label}]{ref=${ref}}`;
  },
});

// StarterKit's built-in ListItem requires a leading paragraph
// (`content: "paragraph block*"`). A card (`::entity{…}`) is a block atom,
// and CommonMark/marked happily produce a list item whose ONLY child is that
// card — no leading paragraph — for markdown as ordinary as
// `- ::entity{ref=bean:x}` (one of the ENTITY_FIXTURES rows, and something
// `POST /api/articles` accepts from arbitrary markdown). Tiptap's
// `createDocument` does not validate node content on load, so the mismatch is
// invisible until the next transaction, when ProseMirror's own
// `contentMatchAt` throws `RangeError` out of `dispatchTransaction` — a DOM
// event listener no React error boundary catches — and the editor silently
// stops accepting input. Widening to `"block+"` (any block, atom or not, may
// lead, and any number may follow) fixes this without changing how a plain
// `- text` item parses or renders: a paragraph still satisfies `block+`
// first, same as it always has.
//
// Configured OUT of StarterKit and back in as its own extension rather than
// passed through `StarterKit.configure({ listItem: {...} })`: StarterKit's
// `listItem` option only forwards `ListItemOptions` (HTMLAttributes and the
// bullet/ordered type names), not `content` — the node's content expression
// isn't configurable through it. bulletList/orderedList still find this node
// by NAME (`listItem`), the same way they'd find StarterKit's own, so nothing
// else about list behavior changes.
const CardLeadingListItem = ListItem.extend({ content: "block+" });

/**
 * Every node the editor and the tests share. The entity nodes are NOT here: the
 * editor uses `.extend()`ed copies carrying React node views
 * (components/editor/entity-views.tsx), while the tests use the bare ones.
 * Everything else must be identical in both, or a node the editor cannot
 * represent gets silently dropped on save — which is exactly how images and
 * task lists were lost before this split existed.
 *
 * Image and TaskList are NOT in StarterKit, and @tiptap/markdown drops any
 * node its schema cannot represent: without these, saving an article
 * silently deletes every image, and a task list serializes to the empty
 * string.
 */
export const baseExtensions = [
  // underline: false — StarterKit v3 ships @tiptap/extension-underline and
  // registers Mod-u/Mod-U live. @tiptap/markdown serializes its mark as
  // `++text++`; remark + remark-gfm has no `++` rule, so that syntax renders
  // literally on the public page instead of underlining anything (I3) — a
  // fourth grammar no reader shares, on top of the three the bubble menu
  // actually offers (bold/italic/code). The round trip through THIS editor
  // is byte-stable either way, so the conformance harness's render-equality
  // loop can't catch the divergence on its own; see the dedicated I3 test in
  // lib/markdown-conformance.test.ts, which parses "++x++" and asserts no
  // underline mark is produced. strike stays on: "~~" is real GFM.
  StarterKit.configure({ listItem: false, underline: false }),
  CardLeadingListItem,
  TableKit,
  Image,
  TaskList,
  TaskItem,
];

/**
 * The headless extension set: schema and markdown, no views. Exported so
 * lib/entity-markdown.test.ts and lib/markdown-conformance.test.ts drive the
 * exact schema the editor drives (components/editor/prose-editor.tsx spreads
 * `baseExtensions` rather than re-listing nodes), minus the React node views
 * the editor layers on top. One definition, so a node added later cannot be
 * tested by one file and missed by the other.
 */
export const headlessExtensions = [...baseExtensions, EntityCard, EntityMention];
