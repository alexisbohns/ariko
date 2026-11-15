import {
  Node,
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
  type MarkdownLexerConfiguration,
} from "@tiptap/core";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { DEFAULT_FRAME, DEFAULT_SIZE, type StagedBlock } from "./staging";
import { findContainerEnd } from "./staging-fence";
import { parseStagedBlock, type MdNode, type ParsedBlock } from "./staging-parse";
import {
  serializeFigure, serializeGallery, serializeCompare, calloutOpener, quoteOpener,
  figureFields, galleryFields, compareFields,
  type FigureFields, type GalleryFields, type CompareFields,
} from "./staging-markdown";

/**
 * The EDITOR's half of the staging grammar (spec 2026-11-15 §4).
 *
 * marked finds a block's EXTENT (lib/staging-fence.ts, remark's closing
 * rules); remark-parse + directive then parses exactly that text and
 * lib/staging-parse.ts decides whether it is a block — the same function the
 * renderer uses. So the editor never claims a block the site would unwrap,
 * or leaves as text one the site would draw. lib/markdown-conformance.test.ts
 * keeps the extents honest.
 *
 * Media blocks are ATOMS: their fields are attributes and their markdown is
 * rebuilt from them (lib/staging-markdown.ts). Text blocks keep editable
 * block children, lexed by marked like any other content.
 *
 * Headless — schema and markdown, no views — so lib/entity-markdown.ts's
 * headlessExtensions can carry them into every test; the editor layers its
 * React node views on `.extend()`ed copies, as it does for the entity nodes.
 */

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

// >0 while a text block lexes its own body. A staged block in there is not
// claimed — remark unwraps it (the inner one), the door refuses it, and the
// `/` menu does not offer it, so the editor leaves its fences as text rather
// than building a node the site would not draw. Module state is safe:
// marked's lexing is synchronous, and every increment is paired in `finally`.
let nesting = 0;

interface Claimed { raw: string; value: ParsedBlock }

function claim(src: string, name: StagedBlock): Claimed | undefined {
  if (nesting > 0) return;
  const open = /^ {0,3}:{3,}([A-Za-z]+)/.exec(src);
  if (!open || open[1] !== name) return;
  const end = findContainerEnd(src);
  if (end === null) return;
  const raw = src.slice(0, end);
  // Parsed on its own, so offsets are into `raw` — the `source` that
  // parseStagedBlock slices a caption's or label's markdown out of.
  const root = parser.parse(raw) as unknown as MdNode;
  const kids = root.children ?? [];
  if (kids.length !== 1 || kids[0].type !== "containerDirective" || kids[0].name !== name) return;
  const r = parseStagedBlock(kids[0], raw, { strict: false });
  return r.ok && r.value.block === name ? { raw, value: r.value } : undefined;
}

// marked calls `start` with the source AFTER the current position's first
// character; landing on the preceding newline only ever cuts a paragraph
// earlier, never later (lib/entity-markdown.ts's EntityCard explains why `^`
// would be wrong here). Containers interrupt paragraphs in remark (spec
// §2.3), so they must here, or `Some prose.\n:::callout` stays one paragraph
// in the editor while the site draws a callout under it.
const startOf = (name: StagedBlock) => {
  const re = new RegExp(`\\n {0,3}:{3,}${name}(?=[\\[{\\s]|$)`);
  return (src: string) => src.search(re);
};

type BlockOf<T extends StagedBlock> = Extract<ParsedBlock, { block: T }>;
interface StagedToken<T extends StagedBlock> extends MarkdownToken { value: BlockOf<T> }

function atom<T extends "figure" | "gallery" | "compare">(
  nodeName: string,
  block: T,
  attributes: Record<string, { default: unknown }>,
  toAttrs: (v: BlockOf<T>) => Record<string, unknown>,
  render: (attrs: Record<string, unknown>) => string,
) {
  return Node.create({
    name: nodeName,
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes: () => attributes,
    parseHTML: () => [{ tag: `staged-${block}-node` }],
    renderHTML: ({ HTMLAttributes }) => [`staged-${block}-node`, HTMLAttributes],
    markdownTokenizer: {
      name: nodeName,
      level: "block",
      start: startOf(block),
      tokenize: (src: string) => {
        const c = claim(src, block);
        if (!c) return;
        return { type: nodeName, raw: c.raw, value: c.value } as StagedToken<T>;
      },
    },
    parseMarkdown: (token: MarkdownToken) => ({
      type: nodeName,
      attrs: toAttrs((token as StagedToken<T>).value),
    }),
    renderMarkdown: (node: JSONContent) => render(node.attrs ?? {}),
  });
}

export const StagedFigure = atom(
  "stagedFigure", "figure",
  {
    frame: { default: DEFAULT_FRAME }, size: { default: DEFAULT_SIZE[DEFAULT_FRAME] }, src: { default: "" }, alt: { default: "" },
    darkSrc: { default: "" }, darkAlt: { default: "" }, caption: { default: "" },
  },
  (v) => ({ ...figureFields(v) }),
  (a) => serializeFigure(a as unknown as FigureFields),
);

export const StagedGallery = atom(
  "stagedGallery", "gallery",
  { frame: { default: DEFAULT_FRAME }, images: { default: [] }, caption: { default: "" } },
  (v) => ({ ...galleryFields(v) }),
  (a) => serializeGallery(a as unknown as GalleryFields),
);

export const StagedCompare = atom(
  "stagedCompare", "compare",
  { do: { default: { src: "", alt: "", text: "" } }, dont: { default: { src: "", alt: "", text: "" } } },
  (v) => ({ ...compareFields(v) }),
  (a) => serializeCompare(a as unknown as CompareFields),
);

/** The body between the opener line and the closing fence, for marked. An
 *  unclosed block (remark runs it to the end of the document) has no closer
 *  to drop; the editor writes one on save. */
function bodyOf(raw: string): string {
  const lines = raw.replace(/\n$/, "").split("\n");
  const closed = lines.length > 1 && /^ {0,3}:{3,}[ \t]*$/.test(lines[lines.length - 1]);
  return lines.slice(1, closed ? -1 : undefined).join("\n");
}

function textBlock<T extends "callout" | "quote">(
  nodeName: string,
  block: T,
  attributes: Record<string, { default: unknown }>,
  toAttrs: (v: BlockOf<T>) => Record<string, unknown>,
  opener: (a: Record<string, unknown>) => string,
) {
  return Node.create({
    name: nodeName,
    group: "block",
    // Not "block+": a staged node inside a text block is what the renderer
    // refuses to draw, so the schema refuses to hold it. `image` is absent
    // because Image is INLINE here (lib/entity-markdown.ts): it arrives inside
    // a paragraph, which is already listed.
    content: "(paragraph | heading | bulletList | orderedList | taskList | blockquote | codeBlock | horizontalRule | table | entityCard)+",
    defining: true,
    addAttributes: () => attributes,
    parseHTML: () => [{ tag: `staged-${block}-node` }],
    renderHTML: ({ HTMLAttributes }) => [`staged-${block}-node`, HTMLAttributes, 0],
    markdownTokenizer: {
      name: nodeName,
      level: "block",
      start: startOf(block),
      tokenize: (src: string, _tokens: MarkdownToken[], lexer: MarkdownLexerConfiguration) => {
        const c = claim(src, block);
        if (!c) return;
        nesting += 1;
        try {
          return { type: nodeName, raw: c.raw, value: c.value, tokens: lexer.blockTokens(bodyOf(c.raw)) } as StagedToken<T>;
        } finally {
          nesting -= 1;
        }
      },
    },
    parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) =>
      helpers.createNode(nodeName, toAttrs((token as StagedToken<T>).value), helpers.parseChildren(token.tokens ?? [])),
    renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers) => {
      const body = helpers.renderChildren(node.content ?? [], "\n\n");
      const fence = ":".repeat(fenceLength(body));
      return `${fence.slice(3)}${opener(node.attrs ?? {})}\n${body}\n${fence}`;
    },
  });
}

/** Longer than any colon run that opens a line of the body. A body can hold
 *  fence-shaped text — stored `::::callout` around a `:::gallery` the editor
 *  left as text (nesting is not claimed) — and writing the canonical `:::`
 *  around it let the inner `:::` close the callout on the next parse,
 *  stranding the outer closer as a literal `:::` paragraph on the page. Code
 *  fences are opaque to remark, so a colon line inside one only lengthens the
 *  fence by a colon, which is harmless; every canonical body has none. */
function fenceLength(body: string): number {
  let longest = 2;
  for (const m of body.matchAll(/^ {0,3}(:{3,})/gm)) longest = Math.max(longest, m[1].length);
  return longest + 1;
}

export const StagedCallout = textBlock(
  "stagedCallout", "callout", { label: { default: null } },
  (v) => ({ label: v.label?.source ?? null }),
  (a) => calloutOpener((a.label as string | null) ?? null),
);

export const StagedQuote = textBlock(
  "stagedQuote", "quote", { by: { default: "" }, role: { default: null } },
  (v) => ({ by: v.by, role: v.role }),
  (a) => quoteOpener(String(a.by ?? ""), (a.role as string | null) ?? null),
);

export const stagingNodes = [StagedFigure, StagedGallery, StagedCompare, StagedCallout, StagedQuote];
