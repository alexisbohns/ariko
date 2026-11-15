import { DEFAULT_FRAME, DEFAULT_SIZE, type Frame, type Size } from "./staging";
import type { ParsedBlock } from "./staging-parse";

/**
 * The canonical markdown of a staged block (spec §2.2), written by the
 * editor's media atoms on save. Media blocks are rebuilt from their fields
 * and never from editing inside them — that is what keeps a block's markdown
 * the size of its fields rather than whatever the editor's serializer makes
 * of a nested document.
 *
 * Pure and client-safe. A field that would change meaning on re-parse is
 * escaped rather than trusted: a caption opening with `- ` becomes a list,
 * one that is `:::` closes the block, and either would turn a valid figure
 * into one that unwraps.
 */

export interface FigureFields { frame: Frame; size: Size; src: string; alt: string; darkSrc: string; darkAlt: string; caption: string }
export interface GalleryImage { src: string; alt: string; title: string }
export interface GalleryFields { frame: Frame; images: GalleryImage[]; caption: string }
export interface SideFields { src: string; alt: string; text: string }
export interface CompareFields { do: SideFields; dont: SideFields }

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();
const escapeLead = (s: string) =>
  s.replace(/^(\d+)([.)])/, "$1\\$2").replace(/^([#>+*:-])/, "\\$1");
const escapeAlt = (s: string) => oneLine(s).replace(/[\\[\]]/g, (c) => `\\${c}`);
const escapeTitle = (s: string) => oneLine(s).replace(/["\\]/g, (c) => `\\${c}`);
const escapeUrl = (s: string) => s.trim().replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

export const imageMarkdown = (i: { src: string; alt: string; title?: string | null }) =>
  `![${escapeAlt(i.alt)}](${escapeUrl(i.src)}${i.title && oneLine(i.title) ? ` "${escapeTitle(i.title)}"` : ""})`;

const attrValue = (v: string) =>
  /^[A-Za-z0-9_-]+$/.test(v) ? v : `"${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;

function attrs(pairs: Array<[string, string | true | null]>): string {
  const parts = pairs.flatMap(([k, v]) => (v === null ? [] : [v === true ? k : `${k}=${attrValue(v)}`]));
  return parts.length ? `{${parts.join(" ")}}` : "";
}

const caption = (s: string) => (oneLine(s) ? [escapeLead(oneLine(s))] : []);

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

export function serializeCompare(c: CompareFields): string {
  if (!oneLine(c.do.text) && !oneLine(c.dont.text)) return "";
  return ["::::compare", ...side("do", c.do), ...side("dont", c.dont), "::::"].join("\n");
}

export const calloutOpener = (label: string | null) =>
  label && oneLine(label) ? `:::callout[${oneLine(label).replace(/[\\[\]]/g, (c) => `\\${c}`)}]` : ":::callout";

export const quoteOpener = (by: string, role: string | null) =>
  `:::quote${attrs([["by", oneLine(by)], ["role", role && oneLine(role) ? oneLine(role) : null]])}`;

// ── From a parse to fields: what the editor's atoms store ──────────────────

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
