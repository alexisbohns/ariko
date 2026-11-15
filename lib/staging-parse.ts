import {
  BLOCK_ATTRIBUTES, FRAMES, SIZES, isFrame, isSize, isStagedBlock, resolveFrame, resolveSize,
  type Frame, type Size, type StagedBlock,
} from "./staging";

/**
 * THE shape of a staged block (spec §2), decided once over the mdast
 * container node. Three consumers call it and none re-derives it:
 *
 *  - remarkStaging (lib/markdown.ts), leniently, to decide what renders;
 *  - stagingProblems (lib/staging-check.ts), strictly, to refuse a post;
 *  - the editor's tokenizers (lib/staging-editor.ts), leniently, after
 *    finding a block's extent in marked's source — which is what keeps the
 *    editor from claiming a block the renderer would unwrap, or the reverse.
 *
 * Lenient and strict differ ONLY on vocabulary — an unknown attribute or
 * value, a label where none belongs. Shape problems (no image, a missing
 * side, no `by`) are refused in both, because a block with the wrong shape
 * has no right rendering: it unwraps to its children instead, which is what
 * every foreign container does already.
 *
 * Nesting is the callers' business: this function looks at one node.
 *
 * The node type is local, as in lib/markdown.ts: mdast-util-directive's types
 * arrive by declaration merging, and depending on them couples this file to a
 * transitive dependency's type exports.
 */
export interface MdNode {
  type: string;
  name?: string;
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  attributes?: Record<string, string | null | undefined> | null;
  children?: MdNode[];
  data?: Record<string, unknown>;
  position?: { start: { offset?: number }; end: { offset?: number } };
}

export interface StagedImage {
  src: string;
  alt: string;
  title: string | null;
}

/** Inline markdown, as nodes (for the renderer) and as the author's own
 *  source text (for the editor, which must give it back byte for byte). */
export interface Phrase {
  nodes: MdNode[];
  source: string;
}

export interface Side {
  image: StagedImage | null;
  text: Phrase;
  node: MdNode;
}

export type ParsedBlock =
  | { block: "figure"; frame: Frame; size: Size; image: StagedImage; dark: StagedImage | null; caption: Phrase | null }
  | { block: "gallery"; frame: Frame; images: StagedImage[]; caption: Phrase | null }
  | { block: "compare"; do: Side; dont: Side }
  | { block: "callout"; label: Phrase | null; labelText: string | null; body: MdNode[] }
  | { block: "quote"; by: string; role: string | null; body: MdNode[] };

export type ParseResult = { ok: true; value: ParsedBlock } | { ok: false; problem: string };

const fail = (problem: string): ParseResult => ({ ok: false, problem });

export function plainText(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  if (node.type === "image") return node.alt ?? "";
  return (node.children ?? []).map(plainText).join("");
}

const isLabel = (n: MdNode) => n.type === "paragraph" && n.data?.directiveLabel === true;
const isBlank = (n: MdNode) => (n.type === "text" && !(n.value ?? "").trim()) || n.type === "break";

/** The author's own text for a run of sibling nodes, from the source offsets.
 *  Falls back to plain text when offsets are missing, which loses emphasis
 *  rather than the words. */
function sourceOf(nodes: MdNode[], source: string): string {
  const from = nodes[0]?.position?.start.offset;
  const to = nodes[nodes.length - 1]?.position?.end.offset;
  if (typeof from === "number" && typeof to === "number") return source.slice(from, to).trim();
  return nodes.map(plainText).join("").trim();
}

/** A caption's first text node starts with the newline after the image line;
 *  the renderer should not see it. Clones, never mutates the tree. */
function trimmed(nodes: MdNode[]): MdNode[] {
  return nodes.map((n, i) => {
    if (n.type !== "text") return n;
    let value = n.value ?? "";
    if (i === 0) value = value.replace(/^\s+/, "");
    if (i === nodes.length - 1) value = value.replace(/\s+$/, "");
    return { ...n, value };
  });
}

const toImage = (n: MdNode): StagedImage => ({ src: n.url ?? "", alt: n.alt ?? "", title: n.title ?? null });

/** Images first, then at most one paragraph of caption. */
function splitMedia(
  kids: MdNode[],
  source: string,
  who: string,
): { images: StagedImage[]; caption: Phrase | null } | string {
  const images: StagedImage[] = [];
  let caption: MdNode[] | null = null;
  let captionParagraph = -1;
  for (let p = 0; p < kids.length; p++) {
    const para = kids[p];
    if (para.type !== "paragraph") return `${who}: only images and a caption belong inside`;
    for (const n of para.children ?? []) {
      if (caption === null) {
        if (n.type === "image") images.push(toImage(n));
        else if (n.type === "imageReference") return `${who}: use ![alt](url), not a reference image`;
        else if (!isBlank(n)) {
          caption = [n];
          captionParagraph = p;
        }
      } else {
        if (n.type === "image") return `${who}: an image cannot follow the caption`;
        if (p !== captionParagraph) return `${who}: the caption is one paragraph`;
        caption.push(n);
      }
    }
  }
  return { images, caption: caption ? { nodes: trimmed(caption), source: sourceOf(caption, source) } : null };
}

function vocabularyProblem(node: MdNode, name: StagedBlock): string | null {
  const allowed = BLOCK_ATTRIBUTES[name];
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (!allowed.includes(key)) return `${name}: unknown attribute ${key}`;
    if (key === "frame" && !isFrame(value)) return `${name}: frame=${value} is not one of ${FRAMES.join(", ")}`;
    if (key === "size" && !isSize(value)) return `${name}: size=${value} is not one of ${SIZES.join(", ")}`;
    if (key === "dark" && value) return `${name}: dark takes no value`;
  }
  return null;
}

export function parseStagedBlock(node: MdNode, source: string, opts: { strict: boolean }): ParseResult {
  const name = node.name;
  if (node.type !== "containerDirective" || !isStagedBlock(name)) return fail(`${name}: not a staging block`);

  if (opts.strict) {
    const problem = vocabularyProblem(node, name);
    if (problem) return fail(problem);
  }
  const attrs = node.attributes ?? {};
  const all = node.children ?? [];
  const labelNode = all.find(isLabel) ?? null;
  const kids = all.filter((n) => !isLabel(n));

  if (labelNode && name !== "callout" && opts.strict) return fail(`${name} takes no [label]`);

  switch (name) {
    case "figure": {
      const media = splitMedia(kids, source, "figure");
      if (typeof media === "string") return fail(media);
      const dark = attrs.dark !== undefined && attrs.dark !== null;
      if (dark && media.images.length !== 2) return fail("figure: dark needs two images, light then dark");
      if (!dark && media.images.length !== 1) return fail("figure: needs exactly one image");
      const frame = resolveFrame(attrs.frame);
      return {
        ok: true,
        value: { block: "figure", frame, size: resolveSize(attrs.size, frame), image: media.images[0], dark: dark ? media.images[1] : null, caption: media.caption },
      };
    }
    case "gallery": {
      const media = splitMedia(kids, source, "gallery");
      if (typeof media === "string") return fail(media);
      if (media.images.length < 2) return fail("gallery: needs at least two images");
      return { ok: true, value: { block: "gallery", frame: resolveFrame(attrs.frame), images: media.images, caption: media.caption } };
    }
    case "compare": {
      const sides = kids.filter((n) => !(n.type === "paragraph" && !plainText(n).trim()));
      const [a, b] = sides;
      if (sides.length !== 2 || a.type !== "containerDirective" || a.name !== "do" || b.type !== "containerDirective" || b.name !== "dont")
        return fail("compare: needs one :::do and one :::dont, in that order");
      const side = (n: MdNode, who: "do" | "dont"): Side | string => {
        if (opts.strict && Object.keys(n.attributes ?? {}).length > 0) return `compare: ${who} takes no attributes`;
        const media = splitMedia((n.children ?? []).filter((k) => !isLabel(k)), source, `compare: ${who}`);
        if (typeof media === "string") return media;
        if (media.images.length > 1) return `compare: each side holds at most one image`;
        if (!media.caption) return `compare: ${who} needs a line of text`;
        return { image: media.images[0] ?? null, text: media.caption, node: n };
      };
      const yes = side(a, "do");
      if (typeof yes === "string") return fail(yes);
      const no = side(b, "dont");
      if (typeof no === "string") return fail(no);
      return { ok: true, value: { block: "compare", do: yes, dont: no } };
    }
    case "callout": {
      if (kids.length === 0) return fail("callout: needs some text");
      const label = labelNode && (labelNode.children ?? []).length > 0
        ? { nodes: labelNode.children ?? [], source: sourceOf(labelNode.children ?? [], source) }
        : null;
      return { ok: true, value: { block: "callout", label, labelText: label ? plainText(labelNode!).trim() : null, body: kids } };
    }
    case "quote": {
      const by = (attrs.by ?? "").trim();
      if (!by) return fail("quote: by is required");
      if (kids.length === 0) return fail("quote: needs the quoted words");
      const role = (attrs.role ?? "").trim() || null;
      return { ok: true, value: { block: "quote", by, role, body: kids } };
    }
  }
}
