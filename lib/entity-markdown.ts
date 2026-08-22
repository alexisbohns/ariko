import { Node, type JSONContent, type MarkdownToken } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";

/**
 * The EDITOR's half of the entity grammar (compose spec §2.2).
 *
 * The public site parses this syntax with remark (`lib/markdown.ts`); the editor
 * parses it with marked, which is what `@tiptap/markdown` runs on. Two parsers
 * over one format is this slice's central risk, and `lib/markdown-conformance.test.ts`
 * is what keeps them honest — change nothing here without re-running it.
 *
 * Tiptap's built-in `createAtomBlockMarkdownSpec` / `createInlineMarkdownSpec`
 * are deliberately unused: they emit Pandoc `:::name {attrs}` (three colons) and
 * shortcodes `[name attrs]…[/name]`. Neither is our grammar (spec §6.1).
 */

// Mirrors lib/entity-refs.ts's BLOCK/INLINE, and for the same reasons: up to
// three leading spaces (four is an indented code block), ref anywhere in the
// braces, and the inline form guarded against matching the block form's second
// colon.
const REF = /\bref=([^\s}]+)/;
const BLOCK = /^ {0,3}::entity\{([^}\n]*)\}[ \t]*(?:\n|$)/;
const INLINE = /^:entity\[([^\]]*)\]\{([^}\n]*)\}/;

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
    // marked uses `start` to decide where to cut a paragraph. Landing on the
    // preceding newline rather than the colons is safe — it only ever cuts
    // earlier, never later.
    start: (src: string) => src.search(/(^|\n) {0,3}::entity\{/),
    tokenize: (src: string) => {
      const m = BLOCK.exec(src);
      if (!m) return;
      const ref = REF.exec(m[1])?.[1];
      // No ref, no node: the directive degrades to literal text, exactly as
      // remarkEntity degrades it (lib/markdown.ts:34).
      if (!ref) return;
      return { type: "entityCard", raw: m[0], ref } as EntityCardToken;
    },
  },
  parseMarkdown: (token: MarkdownToken) => ({
    type: "entityCard",
    attrs: { ref: (token as EntityCardToken).ref },
  }),
  renderMarkdown: (node: JSONContent) => `::entity{ref=${node.attrs?.ref}}`,
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
    // as an inline mention preceded by a stray colon.
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
  renderMarkdown: (node: JSONContent) =>
    `:entity[${node.attrs?.label ?? ""}]{ref=${node.attrs?.ref}}`,
});

/**
 * The headless extension set: schema and markdown, no views. Exported so both
 * lib/entity-markdown.test.ts and lib/markdown-conformance.test.ts drive the
 * exact schema the editor drives, minus the React node views the editor layers
 * on top (components/editor/entity-views.tsx). One definition, so a node added
 * later cannot be tested by one file and missed by the other.
 */
export const headlessExtensions = [StarterKit, TableKit, EntityCard, EntityMention];
