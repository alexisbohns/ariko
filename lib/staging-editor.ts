import {
  Node,
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
  type MarkdownLexerConfiguration,
  type RenderContext,
} from "@tiptap/core";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { DEFAULT_FRAME, DEFAULT_SIZE, isStagedBlock, type StagedBlock } from "./staging";
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

/** Whether the editor would claim a staged block opening `src` — the same
 *  decision its tokenizers make, for lib/entity-markdown.ts's
 *  separateContainerOpeners, which may move an opener only when doing so
 *  produces a node. */
export function claimsBlock(src: string): boolean {
  const name = /^ {0,3}:{3,}([A-Za-z]+)/.exec(src)?.[1];
  return isStagedBlock(name) && claim(src, name) !== undefined;
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
interface StagedToken<T extends StagedBlock> extends MarkdownToken { value: BlockOf<T>; spaced: boolean }

// A staged block may sit in a list item — remark draws it there, and the
// editor can build one — and the list item's renderer
// (@tiptap/core's renderNestedMarkdownContent) separates a non-paragraph
// child with ONE newline, always. That turns `- item\n\n  :::callout` (a
// loose item: the page wraps "item" in <p>) into a tight one on the first
// save. So the node remembers whether a blank line came before it, and
// writes it back where the parent would drop it: as the leading empty line
// the list item indents into a whitespace-only line, which is still a blank
// line to both parsers. Not rendered to HTML — it is layout, not content.
const SPACED = { spaced: { default: false, rendered: false } };
const NESTING_PARENTS = new Set(["listItem", "taskItem"]);
const lead = (attrs: Record<string, unknown>, ctx: RenderContext | undefined) =>
  attrs.spaced && ctx && ctx.index > 0 && NESTING_PARENTS.has(ctx.parentType ?? "") ? "\n" : "";

// The same renderer writes an item's FIRST child on the marker line and
// indents none of its later lines — right for a one-line paragraph, wrong for
// a block: `- :::callout` came back with its body and closer at column 0,
// outside the list, and the page drew the callout below an empty item. So a
// staged block that opens an item indents its own continuation lines, by the
// same `helpers.indent` the renderer uses for every later child.
function placed(md: string, helpers: MarkdownRendererHelpers, ctx: RenderContext | undefined): string {
  if (!md || !ctx || ctx.index !== 0 || !NESTING_PARENTS.has(ctx.parentType ?? "")) return md;
  const [first, ...rest] = md.split("\n");
  return [first, ...rest.map((line) => helpers.indent(line))].join("\n");
}
const spacedAfter = (tokens: MarkdownToken[]) => tokens[tokens.length - 1]?.type === "space";

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
    addAttributes: () => ({ ...attributes, ...SPACED }),
    parseHTML: () => [{ tag: `staged-${block}-node` }],
    renderHTML: ({ HTMLAttributes }) => [`staged-${block}-node`, HTMLAttributes],
    markdownTokenizer: {
      name: nodeName,
      level: "block",
      start: startOf(block),
      tokenize: (src: string, tokens: MarkdownToken[]) => {
        const c = claim(src, block);
        if (!c) return;
        return { type: nodeName, raw: c.raw, value: c.value, spaced: spacedAfter(tokens) } as StagedToken<T>;
      },
    },
    parseMarkdown: (token: MarkdownToken) => ({
      type: nodeName,
      attrs: { ...toAttrs((token as StagedToken<T>).value), spaced: (token as StagedToken<T>).spaced },
    }),
    renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers, ctx?: RenderContext) => {
      const md = render(node.attrs ?? {});
      return md && `${lead(node.attrs ?? {}, ctx)}${placed(md, helpers, ctx)}`;
    },
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
 *  to drop; the editor writes one on save.
 *
 *  Dedented by the block's own indent — the opener's, or the closer's when
 *  the opener sits on a list marker's line. In a list item the editor writes
 *  three spaces of indent where the `- ` marker is two wide, so marked hands
 *  the item's content over with every line one space in, and a body kept
 *  that way came back one space deeper on every save. Never more than three,
 *  the most either fence may be indented: a body line indented four spaces
 *  past that is code, and stays code. */
function bodyOf(raw: string): string {
  const lines = raw.replace(/\n$/, "").split("\n");
  const closed = lines.length > 1 && /^ {0,3}:{3,}[ \t]*$/.test(lines[lines.length - 1]);
  const lead = (line: string) => /^ */.exec(line)![0].length;
  const indent = Math.max(lead(lines[0]), closed ? lead(lines[lines.length - 1]) : 0);
  const dedent = (line: string) => line.slice(Math.min(indent, /^ */.exec(line)![0].length));
  return lines.slice(1, closed ? -1 : undefined).map(dedent).join("\n");
}

/** marked lexes a list item's content with `state.top` off, and there a run
 *  of prose is a `text` token, not a `paragraph` — which the parser turned
 *  into bare text nodes, schema-invalid as a text block's children and fatal
 *  on the next keystroke. The helpers cannot reach the lexer's state, so the
 *  body's own top-level prose is renamed instead, in place: the token's
 *  `tokens` array is the one marked's inline queue will fill.
 *
 *  (`blockTokens` also leaves `state.top` on for the rest of the item, so the
 *  item's prose after the block arrives as paragraphs rather than text;
 *  lib/entity-markdown.ts's list item makes both shapes the same document.) */
function asBlocks(tokens: MarkdownToken[]): MarkdownToken[] {
  for (const t of tokens) if (t.type === "text") t.type = "paragraph";
  return tokens;
}

/** The label of an emptied callout, written as the paragraph it unwraps to.
 *  Escaped only when it would start a block — a label `# One` must not come
 *  back as a heading. */
function asParagraph(line: string): string {
  const kids = (parser.parse(line) as unknown as MdNode).children ?? [];
  if (kids.length === 1 && kids[0].type === "paragraph") return line;
  if (/^\d+[.)]/.test(line)) return line.replace(/^(\d+)([.)])/, "$1\\$2");
  return /^[!-/:-@[-`{-~]/.test(line) ? `\\${line}` : line;
}

const isEmptyParagraph = (n: JSONContent) =>
  n.type === "paragraph" && (n.content ?? []).every((c) => c.type === "text" && !(c.text ?? "").trim());

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
    addAttributes: () => ({ ...attributes, ...SPACED }),
    parseHTML: () => [{ tag: `staged-${block}-node` }],
    renderHTML: ({ HTMLAttributes }) => [`staged-${block}-node`, HTMLAttributes, 0],
    markdownTokenizer: {
      name: nodeName,
      level: "block",
      start: startOf(block),
      tokenize: (src: string, tokens: MarkdownToken[], lexer: MarkdownLexerConfiguration) => {
        const c = claim(src, block);
        if (!c) return;
        const spaced = spacedAfter(tokens);
        nesting += 1;
        try {
          return { type: nodeName, raw: c.raw, value: c.value, spaced, tokens: asBlocks(lexer.blockTokens(bodyOf(c.raw))) } as StagedToken<T>;
        } finally {
          nesting -= 1;
        }
      },
    },
    // A claimed body can still yield no nodes: a link definition or a
    // footnote definition is consumed by marked and becomes nothing. One
    // empty paragraph keeps the node inside its own content expression.
    parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
      const kids = helpers.parseChildren(token.tokens ?? []);
      const t = token as StagedToken<T>;
      return helpers.createNode(nodeName, { ...toAttrs(t.value), spaced: t.spaced }, kids.length ? kids : [helpers.createNode("paragraph")]);
    },
    // A text block holding nothing but empty paragraphs — the author cleared
    // it, or its body was only a definition — writes no fence: an empty
    // `:::callout` is a block the parser refuses and the site unwraps, and
    // the editor would leave its fences as literal text on the next open. The
    // label is words the author wrote, so it stays, as the paragraph remark
    // would unwrap it to; a quote's `by` is not body text and goes with it.
    renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers, ctx?: RenderContext) => {
      const attrs = node.attrs ?? {};
      const content = node.content ?? [];
      if (content.every(isEmptyParagraph)) {
        const label = typeof attrs.label === "string" ? attrs.label.trim() : "";
        // Always spaced in a list item: written tight, the label would read
        // as a lazy continuation of the item's own text and merge into it.
        return label ? `${lead({ spaced: true }, ctx)}${asParagraph(label)}` : "";
      }
      const body = helpers.renderChildren(content, "\n\n");
      const fence = ":".repeat(fenceLength(body));
      return `${lead(attrs, ctx)}${placed(`${fence.slice(3)}${opener(attrs)}\n${body}\n${fence}`, helpers, ctx)}`;
    },
  });
}

/** Longer than any colon run that opens a line of the body. A body can hold
 *  fence-shaped text — stored `::::callout` around a `:::gallery` the editor
 *  left as text (nesting is not claimed) — and writing the canonical `:::`
 *  around it let the inner `:::` close the callout on the next parse,
 *  stranding the outer closer as a literal `:::` paragraph on the page.
 *
 *  Code lines are scanned too, and must be: fenced code is NOT opaque to a
 *  container's closer — remark closes `:::callout` at a `:::` line inside a
 *  code fence in its body. Every canonical body has no colon line at all. */
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
