import {
  Node,
  type JSONContent,
  type MarkdownLexerConfiguration,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
  type RenderContext,
} from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Paragraph } from "@tiptap/extension-paragraph";
import { CodeBlock } from "@tiptap/extension-code-block";
import { TableKit } from "@tiptap/extension-table";
import { Image } from "@tiptap/extension-image";
import { ListItem, OrderedList, ORDERED_LIST_MARKER_PATTERN, TaskList, TaskItem } from "@tiptap/extension-list";
import { claimsBlock, stagingNodes } from "./staging-editor";

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

// A byte-order mark is invisible and remark ignores it, but marked reads it
// as the first character of the first paragraph — so a document opening with
// `\uFEFF:::callout` was never claimed (the opener no longer starts the
// line), and the mark itself was saved back as content.
export function stripBom(markdown: string): string {
  return markdown.replace(/^\uFEFF/, "");
}

// marked's list tokenizer keeps reading an item through any line that does
// not start a block IT knows — so `- item\n:::callout\nx\n:::` hands the
// whole container to the item as lazy continuation, while remark, for which
// a container interrupts a paragraph, ends the list and draws the callout
// below it. The editor then saved the callout indented under the item, and
// the page moved it into the list. A blank line before such an opener ends
// the list for marked exactly where remark ends it, and changes nothing for
// remark: the opener already interrupted whatever came before it.
//
// Only an opener that no list item in the same run of non-blank lines would
// hold — one indented less than the outermost item's content. An opener
// indented into a BULLET item belongs there in both parsers, and a blank line
// before it would loosen the list.
//
// An ORDERED item is the exception, and the reverse case: @tiptap's own
// ordered-list tokenizer reads every line up to a blank one as the item's
// paragraph unless it recognizes the line as a block, and a container is not
// one it recognizes — so `1. a\n   :::callout` kept the callout as item prose,
// saved it under-indented, and the page drew it below the list. A blank line
// moves it to the item's block content, which that tokenizer trims before
// lexing, so the item does not turn loose. Only for a block the editor will
// CLAIM (claimsBlock, lib/staging-editor.ts): moved, a foreign or malformed
// container is block text that the item's renderer writes one space deeper
// on every save — `1. a\n   :::grid` was a code block by the fourth — while
// left alone it stays item prose, which is what it was before.
//
// An opener is a whole line, as remark reads one: `Meet\n:::at 10:30` and
// `Hello\n:::smile:` are prose, and separating them split a paragraph.
// Fenced code is skipped: a code sample about the grammar is not the grammar.
// It ends only at a bare fence of the same character and at least the
// opener's length — findContainerEnd's rule — so "``` not a closer" is code.
const OPENER = /^( {0,3}):{3,}[A-Za-z][\w-]*(\[[^\]\n]*\])?(\{[^}\n]*\})?[ \t]*$/;
const LIST_ITEM = /^( *)([-*+]|(\d{1,9})[.)])( +|$)/;
const CODE_FENCE = /^\s*(`{3,}|~{3,})/;
const CODE_CLOSE = /^\s*(`{3,}|~{3,})[ \t]*$/;

export function separateContainerOpeners(markdown: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  let itemOffset: number | null = null;
  let ordered: number | null = null;
  const lines = markdown.split("\n");
  lines.forEach((line, i) => {
    const code = CODE_FENCE.exec(line);
    if (fence) {
      const close = CODE_CLOSE.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
    } else if (code) {
      fence = code[1];
    } else {
      const open = OPENER.exec(line);
      const prev = out[out.length - 1];
      const indent = open?.[1].length ?? 0;
      const lazy =
        itemOffset === null ||
        indent < itemOffset ||
        (ordered !== null && indent >= ordered && claimsBlock(lines.slice(i).join("\n")));
      if (open && prev !== undefined && prev.trim() && lazy) out.push("");
    }
    if (!line.trim()) itemOffset = ordered = null;
    else {
      const item = LIST_ITEM.exec(line);
      if (item) {
        itemOffset ??= item[0].length;
        ordered = item[3] ? item[0].length : null;
      }
    }
    out.push(line);
  });
  return out.join("\n");
}

/** Everything stored markdown goes through before marked sees it — the
 *  editor's one entry point (components/editor/prose-editor.tsx) and the
 *  conformance suite's `roundTrip` call this, so the two cannot drift. */
export function prepareEditorMarkdown(markdown: string): string {
  return separateContainerOpeners(normalizeEmptyListMarkers(stripBom(markdown)));
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
//
// Its parseMarkdown is wrapped for a second, upstream gap of the same class.
// In a tight item, marked lexes prose as `text` tokens, and the stock handler
// wraps only the FIRST one in a paragraph: text after a block —
// `- item\n  ```\n  c\n  ```\n  after`, or the same with a card or a staged
// callout — came back as bare text nodes directly in the list item,
// schema-invalid and fatal on the next keystroke. Consecutive inline nodes
// are gathered into one paragraph instead. The item then saves loose (the
// renderer always writes a blank line before a later paragraph), which
// lib/markdown-conformance.test.ts pins as a KNOWN DIVERGENCE: a layout
// change, where the stock result was a frozen editor.
const INLINE_TYPES = new Set(["text", "hardBreak", "image", "entityMention"]);

function wrapStrayInline(content: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const node of content) {
    if (!INLINE_TYPES.has(node.type ?? "")) {
      out.push(node);
      continue;
    }
    const last = out[out.length - 1];
    if (last?.type === "paragraph" && (last as { stray?: boolean }).stray) last.content!.push(node);
    else out.push({ type: "paragraph", content: [node], stray: true } as JSONContent);
  }
  for (const node of out) {
    delete (node as { stray?: boolean }).stray;
    // marked keeps a later paragraph's indent beyond the item's content
    // column — the renderer's three spaces under a two-wide `- ` leave one —
    // and the stock handler stores it as text. Leading whitespace is never
    // content in a paragraph, but stored it was written back plus one more
    // space per save, until the fourth save turned the paragraph into code.
    // The same holds after every soft line break: a continuation line's
    // indent is never content either, and an ordered item's prose kept it
    // the same way, one space deeper per save.
    if (node.type !== "paragraph" || !node.content) continue;
    node.content = dropContinuationIndent(node.content);
  }
  return out;
}

const CardLeadingListItem = ListItem.extend({
  content: "block+",
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    const result = ListItem.config.parseMarkdown!(token, helpers);
    if (result && !Array.isArray(result) && "type" in result && result.type === "listItem" && result.content) {
      return { ...result, content: wrapStrayInline(result.content) };
    }
    return result;
  },
});

// @tiptap/extension-paragraph's OWN parseMarkdown special-cases a paragraph
// token holding ONLY an image token: instead of nesting the image as inline
// content, it unwraps to a bare, un-paragraphed image node
// (`helpers.parseChildren([tokens[0]])`, not `parseInline`) — written for
// Image's stock `inline: false` (group "block"), where a bare block-group
// sibling is exactly what belongs directly in `doc`/`listItem` content.
// `Image.configure({ inline: true, ... })` below (baseExtensions) flips
// Image's group to "inline" — required so an inline image ("text
// ![a](/i.png) more") or a list item whose only content is an image
// ("- ![a](/i.png)") parses as valid paragraph/listItem content instead of
// freezing the editor on the next keystroke (item 1) — but the upstream
// special case doesn't know that: it keeps handing `doc`/`listItem` an
// INLINE-group node with no paragraph wrapper for a bare top-level image
// line, which is schema-invalid for the exact shape the special case exists
// to serve. Delegates to the original parseMarkdown (still reachable via
// `Paragraph.config`, since `.extend()` replaces rather than removes it) and
// only intervenes when that special case actually fired — recognizable by
// its return shape, an array whose one element is an unwrapped "image" node,
// which the ordinary (non-special-cased) path never returns — re-wrapping
// the image in a paragraph so it round-trips through the now-inline schema
// exactly the way it always rendered. Verified: a bare top-level
// "![a](/i.png)" line still parses, still serializes byte-identically, and
// still renders the same HTML through remark (lib/markdown-conformance.test.ts's
// `image`/`imageTitled` fixtures).
//
// It also carries the two halves of a list item's continuation lines, which
// the stock list renderers get wrong in opposite directions. Writing, an
// item's FIRST paragraph is put on the marker line with its later lines at
// column 0 (renderNestedMarkdownContent indents only later children) — lazy
// continuation, harmless for prose and fatal for a line remark reads as a
// block: `1. a\n   :::grid` was saved as `1. a\n :::grid`, and the page then
// drew the container below the list. Reading, the item's content is dedented
// by the marker's width and not the renderer's three spaces, so a line came
// back one space in and that space was stored as text — a task item's second
// paragraph went one space deeper per save and was code by the fourth. So continuation lines
// are indented when written as an item's first child, and their indent is
// dropped when read — it is never content (code spans excepted, where
// CommonMark keeps interior spaces). Both together are a fixed point.
const ITEM_PARENTS = new Set(["listItem", "taskItem"]);

export function dropContinuationIndent(content: JSONContent[]): JSONContent[] {
  content.forEach((child, i) => {
    if (child.type !== "text" || !child.text || child.marks?.some((m) => m.type === "code")) return;
    child.text = child.text.replace(/\n[ \t]+/g, "\n");
    if (i === 0 || content[i - 1]?.type === "hardBreak") child.text = child.text.replace(/^[ \t]+/, "");
  });
  // An empty text node is itself schema-invalid.
  return content.filter((child) => child.type !== "text" || child.text);
}

const InlineImageParagraph = Paragraph.extend({
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    // Non-null assertion, not `?.`: Paragraph always defines parseMarkdown
    // (it's not optional in practice, only in the config type), and `?.`
    // would widen this override's return type to include `undefined`, which
    // the extension field's own type does not accept.
    const result = Paragraph.config.parseMarkdown!(token, helpers);
    if (Array.isArray(result) && result.length === 1 && result[0]?.type === "image") {
      return helpers.createNode("paragraph", undefined, result);
    }
    if (result && !Array.isArray(result) && "type" in result && result.type === "paragraph" && result.content) {
      return { ...result, content: dropContinuationIndent(result.content) };
    }
    return result;
  },
  renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers, ctx: RenderContext) => {
    const md = Paragraph.config.renderMarkdown!(node, helpers, ctx);
    if (!md || ctx?.index !== 0 || !ITEM_PARENTS.has(ctx.parentType ?? "")) return md;
    const [first, ...rest] = md.split("\n");
    return [first, ...rest.map((line) => (line ? helpers.indent(line) : line))].join("\n");
  },
});

// A fenced code block marked hands over with its fence indented — which is
// every fence inside a list item written by this editor (a `- ` item's content
// starts at column 2 and children are written three in, so the fence arrives
// one space deep), and any fence a document indents 1-3 spaces. CommonMark and
// remark read all of those as code. @tiptap/extension-code-block's own
// parseMarkdown refuses a token unless its `raw` STARTS with a backtick or
// tilde and returns `[]`, so the code was silently dropped — on the editor's
// next save for a list item (its first save wrote the fence one space deeper,
// its second erased it), on the first load for a top-level fence.
//
// The guard is kept, widened to the indentation CommonMark allows: marked
// emits `type: "code"` for an indented block too, and `codeBlockStyle` is how
// the stock handler tells that one. Four spaces is not a fence.
const FENCED_RAW = /^ {0,3}(?:`{3,}|~{3,})/;

const IndentedFenceCodeBlock = CodeBlock.extend({
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    if (token.type !== "code") return [];
    if (token.raw && !FENCED_RAW.test(token.raw) && token.codeBlockStyle !== "indented") return [];
    return helpers.createNode(
      "codeBlock",
      { language: (token.lang as string | undefined) || null },
      token.text ? [helpers.createTextNode(token.text)] : [],
    );
  },
});

// @tiptap/extension-list's ordered-list tokenizer takes a list item's
// continuation lines apart with `nextLine.slice(min(ws, indent + marker.length
// + 1))`, where `marker` is the bare `1` — so it strips two columns from an
// item whose content starts at three (`1. `), and every later line comes back
// one space too deep. It then trims the item's block text, which takes the
// leftover space off the OPENING line only. A code fence written under `1. `
// therefore parsed with its fence at column 0 and every body line indented one
// more, and the next save wrote that back a column deeper: a space per save,
// forever, in a code sample where a space is content. Prose under an item had
// the same one-column error and is dropped by `dropContinuationIndent` below —
// which is a patch for what the error does to text, and cannot reach code.
//
// So the error is fixed where it is made, not where each node type shows it:
// the lines the tokenizer will count as continuation are given back the one
// column it does not strip, before it sees them. A line indented AT LEAST as
// far as the item's content has one leading character removed, so the
// tokenizer's own subtraction lands on exactly the content column; a line
// indented less (a lazy continuation) is not touched, and neither is a marker
// line, whose indent is how the tokenizer nests one item under another. The
// line COUNT never changes, which is what lets the token's `raw` — the span
// marked advances its cursor by — be taken from the original source.
//
// Pinned versions make this safe to carry: when a Tiptap bump fixes the
// off-by-one, the `code in a list` fixtures in lib/markdown-conformance.test.ts
// fail (a body line indented deeper than its fence loses a space) and this
// wrapper is what to delete. The unpatched tokenizer stays reachable as
// `OrderedList.config.markdownTokenizer`, which is how this calls it.
const ORDERED_MARKER_LINE = new RegExp(`^(\\s*)(${ORDERED_LIST_MARKER_PATTERN})([.)])\\s+(.*)$`);

export function restoreOrderedContinuationColumn(markdown: string): string {
  let content = Infinity;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = ORDERED_MARKER_LINE.exec(line);
      if (marker) {
        // `. ` is the separator and the one space after it — the width the
        // tokenizer's `+ 1` was reaching for.
        content = marker[1].length + marker[2].length + 2;
        return line;
      }
      if (!line.trim()) return line;
      const indent = line.length - line.trimStart().length;
      return indent >= content ? line.slice(1) : line;
    })
    .join("\n");
}

const stockOrderedList = OrderedList.config.markdownTokenizer!;

const FixedColumnOrderedList = OrderedList.extend({
  markdownTokenizer: {
    ...stockOrderedList,
    tokenize: (src: string, tokens: MarkdownToken[], lexer: MarkdownLexerConfiguration) => {
      const token = stockOrderedList.tokenize(restoreOrderedContinuationColumn(src), tokens, lexer) as
        | (MarkdownToken & { raw: string })
        | undefined;
      if (!token) return token;
      // Same number of lines in, same number consumed: the raw is the source's.
      return { ...token, raw: src.split("\n").slice(0, token.raw.split("\n").length).join("\n") };
    },
  },
});

/**
 * Every node the editor and the tests share. The entity nodes are NOT here: the
 * editor uses `.extend()`ed copies carrying React node views
 * (components/editor/entity-views.tsx), while the tests use the bare ones.
 * The five staging nodes (lib/staging-editor.ts) are left out for the same
 * reason: the editor layers React node views on them, and headlessExtensions
 * below carries the bare ones into every test.
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
  // paragraph: false — configured out the same way listItem is below, and
  // for the analogous reason: StarterKit.configure's `paragraph` option only
  // forwards `ParagraphOptions` (HTMLAttributes), not `parseMarkdown`, so
  // InlineImageParagraph (this file, right above) has to replace it entirely
  // rather than layer on top of it.
  // codeBlock: false and orderedList: false — replaced the same way, for the
  // same reason: StarterKit's options forward settings, not the markdown
  // handlers, and both nodes had to change how they READ stored markdown
  // (IndentedFenceCodeBlock and FixedColumnOrderedList, above). Both keep
  // their names, so every command and schema reference still finds them.
  StarterKit.configure({ listItem: false, underline: false, paragraph: false, codeBlock: false, orderedList: false }),
  InlineImageParagraph,
  IndentedFenceCodeBlock,
  FixedColumnOrderedList,
  CardLeadingListItem,
  TableKit,
  // inline: true — @tiptap/markdown's markdown parser tokenizes `![a](/i.png)`
  // as an INLINE token whenever it appears mid-paragraph ("text ![a](/i.png)
  // more") or as a list item's only content ("- ![a](/i.png)"); only a bare
  // top-level image line is tokenized as a standalone block. Image defaults
  // to `inline: false` (group "block"), so the parser hands a block-group
  // node to `createNode` inside inline content, and the ENCLOSING paragraph
  // ends up with an image in its content array despite the schema saying
  // paragraph content is `inline*` — invisible on load (createDocument does
  // not validate content) and a `RangeError` out of `dispatchTransaction` on
  // the next keystroke, same failure class as CardLeadingListItem below.
  // `inline: true` makes Image's own `group()` return "inline", matching what
  // the parser actually produces; a top-level image (`imageTopLevel` in
  // lib/markdown-conformance.test.ts) still parses and round-trips the same
  // way, because a lone inline node is valid paragraph content too.
  // allowBase64 stays false (Image's own default) — pinned explicitly so a
  // future Image default change can't silently start accepting data: URIs.
  Image.configure({ inline: true, allowBase64: false }),
  TaskList,
  // nested: true — mirrors CardLeadingListItem below, one node over. TaskItem
  // defaults to `nested: false`, whose content expression is `paragraph+`:
  // ONLY paragraphs, nothing else. But `parseMarkdown` pushes whatever
  // `nestedTokens` the tokenizer found (a nested taskList, or any other block
  // — including a card sharing the item's indentation) unconditionally, with
  // no regard for what the schema currently admits. A task item as ordinary
  // as "- [ ] a\n  - [x] b" (a nested task list) or "- [ ] a\n\n
  // ::entity{ref=…}" (a card under a task item) then parses to a document
  // ProseMirror rejects on the next transaction — invisible on load, same
  // failure class as image above and the original CardLeadingListItem bug.
  // `nested: true` widens content to `paragraph block*`: a task item's own
  // parseMarkdown always emits a leading paragraph (even an empty one, for
  // an item with no text of its own — see TaskItem's own source), so this
  // alone admits both a nested taskList (group "block list") and an
  // entityCard (group "block") as later children — no further content-
  // expression widening needed, unlike CardLeadingListItem above.
  TaskItem.configure({ nested: true }),
];

/**
 * The headless extension set: schema and markdown, no views. Exported so
 * lib/entity-markdown.test.ts and lib/markdown-conformance.test.ts drive the
 * exact schema the editor drives (components/editor/prose-editor.tsx spreads
 * `baseExtensions` rather than re-listing nodes), minus the React node views
 * the editor layers on top. One definition, so a node added later cannot be
 * tested by one file and missed by the other.
 */
export const headlessExtensions = [...baseExtensions, EntityCard, EntityMention, ...stagingNodes];
