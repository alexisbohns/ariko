import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { DEFAULT_FRAME, DEFAULT_SIZE, type Frame, type Size } from "./staging";
import type { MdNode, ParsedBlock } from "./staging-parse";

/**
 * The canonical markdown of a staged block (spec §2.2), written by the
 * editor's media atoms on save. Media blocks are rebuilt from their fields
 * and never from editing inside them — that is what keeps a block's markdown
 * the size of its fields rather than whatever the editor's serializer makes
 * of a nested document.
 *
 * Pure and client-safe. Each field is written in the form the parser hands it
 * out in, so serialize(fields(parse(x))) is x:
 *
 *  - a caption, a side's text and a callout label are markdown SOURCE, written
 *    verbatim — `*Em* phasis` stays emphasis. Escaping every leading
 *    punctuation mark would have turned it into literal asterisks on the
 *    first save;
 *  - except that a caption line which would START or INTERRUPT a block is
 *    backslash-escaped, decided by parsing it rather than by a list of
 *    characters. A list is always one short: `===` under the image line turns
 *    the figure's paragraph into a heading, ` ``` ` opens a fence that eats
 *    the closing `:::`, `|---|` makes a table — each turns a valid figure into
 *    one that unwraps;
 *  - alt is mdast's plain text, so its markdown-significant characters are
 *    escaped, or `a *b* c` comes back as emphasis-less `a b c` one save later.
 */
export interface FigureFields { frame: Frame; size: Size; src: string; alt: string; darkSrc: string; darkAlt: string; caption: string }
export interface GalleryImage { src: string; alt: string; title: string }
export interface GalleryFields { frame: Frame; images: GalleryImage[]; caption: string }
export interface SideFields { src: string; alt: string; text: string }
export interface CompareFields { do: SideFields; dont: SideFields }

/** A caption is one line; a hard break in it (`\\` or two trailing spaces
 *  before the newline) is a space, never a stray backslash. */
const oneLine = (s: string) =>
  s.replace(/\\\r?\n/g, " ").replace(/ {2,}\r?\n/g, " ").replace(/\s*\n\s*/g, " ").trim();

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

/** One paragraph and nothing else, both where the line starts its container
 *  (a compare side's text) and where it follows the image line (a caption) —
 *  and no IMAGE in it. The image line and the caption are one paragraph to
 *  remark, so an image at the caption's start is read as a second image and
 *  one later as an image after the caption (lib/staging-parse.ts's
 *  splitMedia): either way the block stops being one and unwraps on the
 *  page. Top-level children only, as splitMedia reads them — an image inside
 *  a link is the link's. */
function staysProse(line: string): boolean {
  const onlyParagraph = (md: string) => {
    const root = parser.parse(md) as unknown as MdNode;
    const [box, ...rest] = root.children ?? [];
    if (rest.length || box?.type !== "containerDirective") return false;
    const kids = box.children ?? [];
    return kids.length === 1 && kids[0].type === "paragraph" && !(kids[0].children ?? []).some(isImage);
  };
  return onlyParagraph(`:::callout\n${line}\n:::`) && onlyParagraph(`:::callout\nx\n${line}\n:::`);
}

const isImage = (n: MdNode) => n.type === "image" || n.type === "imageReference";

/** Whether the line, read as a caption, holds an image node at the top. */
function holdsImage(line: string): boolean {
  const [box] = (parser.parse(`:::callout\nx\n${line}\n:::`) as unknown as MdNode).children ?? [];
  return (box?.children ?? []).some((p) => p.type === "paragraph" && (p.children ?? []).some(isImage));
}

const PUNCT = /[!-/:-@[-`{-~]/;

/** `![` → `\![` wherever it is not already escaped: the image becomes a `!`
 *  and a link to the same URL, which is prose. Tried only when the line
 *  holds an image node, so a `!` that was never one is written as typed. */
const unImage = (line: string) => line.replace(/(^|[^\\])!\[/g, "$1\\![");

function escapeLine(line: string): string {
  if (staysProse(line)) return line;
  if (holdsImage(line)) {
    line = unImage(line);
    if (staysProse(line)) return line;
  }
  const first = /^\d+[.)]/.test(line)
    ? line.replace(/^(\d+)([.)])/, "$1\\$2")
    : PUNCT.test(line[0] ?? "") ? `\\${line}` : line;
  if (staysProse(first)) return first;
  const lead = /^[!-/:-@[-`{-~]+/.exec(line)?.[0] ?? "";
  return lead.replace(/./g, (c) => `\\${c}`) + line.slice(lead.length);
}

/** Inline-significant characters only. Every ASCII punctuation mark would be
 *  plain-text-safe too, but it would make the fixtures' own alts (`phone: the
 *  lake`, `conductor's`) non-canonical — a save would rewrite them. `:` is
 *  escaped before any non-space: remark-directive opens a text directive at
 *  `:` + a digit or a non-ASCII letter too, and its text vanishes from the
 *  alt (`16:9` read back as `16`). The cost is a `https\://` in an alt that
 *  quotes a URL, rewritten once on the first save. */
const escapeAlt = (s: string) =>
  oneLine(s).replace(/[\\[\]*_`<>&~!|]|:(?=\S)/g, (c) => `\\${c}`);
const escapeTitle = (s: string) => oneLine(s).replace(/["\\]/g, (c) => `\\${c}`);
const escapeUrl = (s: string) =>
  s.trim().replace(/\\/g, "%5C").replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

export const imageMarkdown = (i: { src: string; alt: string; title?: string | null }) =>
  `![${escapeAlt(i.alt)}](${escapeUrl(i.src)}${i.title && oneLine(i.title) ? ` "${escapeTitle(i.title)}"` : ""})`;

const attrValue = (v: string) =>
  /^[A-Za-z0-9_-]+$/.test(v) ? v : `"${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;

function attrs(pairs: Array<[string, string | true | null]>): string {
  const parts = pairs.flatMap(([k, v]) => (v === null ? [] : [v === true ? k : `${k}=${attrValue(v)}`]));
  return parts.length ? `{${parts.join(" ")}}` : "";
}

const caption = (s: string) => (oneLine(s) ? [escapeLine(oneLine(s))] : []);

export function serializeFigure(f: FigureFields): string {
  if (!f.src.trim()) return "";
  const opener = `:::figure${attrs([
    ["frame", f.frame === DEFAULT_FRAME ? null : f.frame],
    ["size", f.size === DEFAULT_SIZE[f.frame] ? null : f.size],
    ["dark", f.darkSrc.trim() ? true : null],
  ])}`;
  return [
    opener,
    imageMarkdown({ src: f.src, alt: f.alt }),
    ...(f.darkSrc.trim() ? [imageMarkdown({ src: f.darkSrc, alt: f.darkAlt })] : []),
    ...caption(f.caption),
    ":::",
  ].join("\n");
}

export function serializeGallery(g: GalleryFields): string {
  const images = g.images.filter((i) => i.src.trim());
  if (images.length === 0) return "";
  if (images.length === 1) {
    const [only] = images;
    return serializeFigure({
      frame: g.frame, size: DEFAULT_SIZE[g.frame], src: only.src, alt: only.alt, darkSrc: "", darkAlt: "",
      caption: [oneLine(only.title), oneLine(g.caption)].filter(Boolean).join(" — "),
    });
  }
  return [
    `:::gallery${attrs([["frame", g.frame === DEFAULT_FRAME ? null : g.frame]])}`,
    ...images.map(imageMarkdown),
    ...caption(g.caption),
    ":::",
  ].join("\n");
}

const side = (name: "do" | "dont", s: SideFields) =>
  [`:::${name}`, ...(s.src.trim() ? [imageMarkdown({ src: s.src, alt: s.alt })] : []), ...caption(s.text), ":::"];

/** Empty only when there is nothing at all to keep. A compare with an image
 *  and no text is invalid (the parser refuses it and the renderer unwraps
 *  it), but it is still written: the form's Save is disabled until both
 *  sides have text, and an editor that silently dropped a half-made block
 *  would delete the image the author had just uploaded. */
export function serializeCompare(c: CompareFields): string {
  const empty = (s: SideFields) => !oneLine(s.text) && !s.src.trim();
  if (empty(c.do) && empty(c.dont)) return "";
  return ["::::compare", ...side("do", c.do), ...side("dont", c.dont), "::::"].join("\n");
}

/** The label is SOURCE (ParsedBlock's label.source), written as given: it
 *  is already escaped wherever the author escaped it, and escaping it again
 *  doubled every backslash on each save. */
export const calloutOpener = (label: string | null) =>
  label && oneLine(label) ? `:::callout[${oneLine(label)}]` : ":::callout";

/** An empty `by` writes a bare `:::quote`, which the parser refuses — not
 *  guarded here, for the reason serializeCompare gives: the form's Save is
 *  disabled until `by` is filled. */
export const quoteOpener = (by: string, role: string | null) =>
  `:::quote${attrs([["by", oneLine(by)], ["role", role && oneLine(role) ? oneLine(role) : null]])}`;

// ── From a parse to fields: what the editor's atoms store ──────────────────

/** An image title on a figure is dropped here: the door refuses it, the
 *  renderer ignores it, and the first save removes it rather than keep a
 *  second caption nobody sees. */
export function figureFields(v: Extract<ParsedBlock, { block: "figure" }>): FigureFields {
  return {
    frame: v.frame, size: v.size, src: v.image.src, alt: v.image.alt,
    darkSrc: v.dark?.src ?? "", darkAlt: v.dark?.alt ?? "", caption: v.caption?.source ?? "",
  };
}

export function galleryFields(v: Extract<ParsedBlock, { block: "gallery" }>): GalleryFields {
  return { frame: v.frame, images: v.images.map((i) => ({ src: i.src, alt: i.alt, title: i.title ?? "" })), caption: v.caption?.source ?? "" };
}

export function compareFields(v: Extract<ParsedBlock, { block: "compare" }>): CompareFields {
  const f = (s: typeof v.do): SideFields => ({ src: s.image?.src ?? "", alt: s.image?.alt ?? "", text: s.text.source });
  return { do: f(v.do), dont: f(v.dont) };
}
