import { Node, type JSONContent, type MarkdownToken } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";

/**
 * The EDITOR's half of the entity grammar (compose spec §2.2).
 *
 * The public site parses this syntax with remark (`lib/markdown.ts`); the editor
 * parses it with marked, which is what `@tiptap/markdown` runs on. Two parsers
 * over one format is this slice's central risk; Task 3 adds
 * `lib/markdown-conformance.test.ts` to keep them honest — re-run it before
 * changing anything here once it exists.
 *
 * Tiptap's built-in `createAtomBlockMarkdownSpec` / `createInlineMarkdownSpec`
 * are deliberately unused: they emit Pandoc `:::name {attrs}` (three colons) and
 * shortcodes `[name attrs]…[/name]`. Neither is our grammar (spec §6.1).
 */

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

/**
 * The headless extension set: schema and markdown, no views. Exported so
 * lib/entity-markdown.test.ts drives the same schema definition that Task 3's
 * `lib/markdown-conformance.test.ts` will drive too, once it exists, rather
 * than each test file carrying its own copy that could quietly drift apart.
 * The editor itself (a later task) will build its own extension array on top
 * of these nodes plus React node views (components/editor/entity-views.tsx,
 * not yet written), so this does not guarantee the editor stays in sync —
 * only that the two test files will.
 */
export const headlessExtensions = [StarterKit, TableKit, EntityCard, EntityMention];
