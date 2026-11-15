import { NodeSelection, type EditorState } from "@tiptap/pm/state";
import type { ResolvedPos } from "@tiptap/pm/model";
import { DEFAULT_FRAME, DEFAULT_SIZE } from "./staging";
import type { FigureFields } from "./staging-markdown";

/**
 * "Make it a figure" (spec 2026-11-15 §12): whether the selected plain image
 * can become a `stagedFigure`, decided once, here, and only ASKED by the
 * editor's bubble menu — which draws the button enabled or disabled with the
 * reason — and by the command that performs it (components/editor/
 * staging-views.tsx). Pure and client-safe: it reads a ProseMirror state and
 * writes nothing.
 *
 * Also the one place that says where a staged block may NOT live, which the
 * `/` menu asks too (`stagingAllowedAt`, components/editor/
 * editor-extensions.ts). One list, so the menu cannot offer a figure in a
 * place this refuses one, or the reverse.
 */

/** Where a staged block may not go.
 *
 *  A list item: remark reads a container fence indented under a list marker
 *  as part of the item, and a staged block inside one is what the schema
 *  refuses to hold (lib/staging-editor.ts) — so offering the row there would
 *  delete the typed `/figure` and then fail its insert.
 *
 *  A table cell: a GFM cell is one line, so the block's fences cannot be
 *  written into it at all. The insert SUCCEEDS there and the loss comes on
 *  save — a figure serialized into a cell comes back as literal text in it,
 *  and a callout vanishes. */
export const NO_STAGING_ANCESTORS: ReadonlySet<string> = new Set(["listItem", "taskItem", "tableCell", "tableHeader"]);

/** The staged TEXT blocks, whose schema refuses a staged child — and nesting
 *  is what the renderer unwraps anyway (spec §2.2). The `/` menu stays shut
 *  inside one altogether. */
export const STAGED_TEXT_BLOCKS: ReadonlySet<string> = new Set(["stagedCallout", "stagedQuote"]);

/** Whether a staged block may stand at `$pos` — no list item, table cell,
 *  callout or attributed quote among its ancestors. Ancestors, not the
 *  parent: the position is in a paragraph INSIDE the container. */
export function stagingAllowedIn($pos: ResolvedPos): boolean {
  for (let d = $pos.depth; d >= 0; d--) {
    const name = $pos.node(d).type.name;
    if (NO_STAGING_ANCESTORS.has(name) || STAGED_TEXT_BLOCKS.has(name)) return false;
  }
  return true;
}

export const NOT_ALONE = "Only an image on its own line can become a figure";
export const NOT_HERE = "A figure can't sit in a list, a table, a callout or a quote";

export type FigureConversion =
  | { ok: true; from: number; to: number; attrs: FigureFields }
  | { ok: false; reason: string };

/** What may share a line with the image and still leave it "on its own":
 *  whitespace and hard breaks, which the figure's own line drops anyway. */
const isFiller = (node: { type: { name: string }; isText: boolean; text?: string | null }) =>
  node.type.name === "hardBreak" || (node.isText && !(node.text ?? "").trim());

/**
 * `null` when the selection is not a plain image at all — the bubble menu then
 * keeps its text buttons. Otherwise the verdict: the range of the paragraph
 * the figure replaces (the image's whole line, so one replace step leaves no
 * empty paragraph behind) and the figure's attributes, or why not.
 *
 * Nothing is guessed beyond the image itself: `frame=none` at its default
 * size, `src` and `alt` as they are, and the image's `title` — which the
 * figure's image line does not carry — as the caption, so it is moved rather
 * than lost. The paragraph after is never pulled in as a caption.
 */
export function figureFromImage(state: EditorState): FigureConversion | null {
  const { selection } = state;
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image") return null;
  const $pos = selection.$from;
  if (!stagingAllowedIn($pos)) return { ok: false, reason: NOT_HERE };
  const line = $pos.parent;
  if (line.type.name !== "paragraph") return { ok: false, reason: NOT_ALONE };
  let images = 0;
  let other = false;
  line.forEach((child) => {
    if (child.type.name === "image") images++;
    else if (!isFiller(child)) other = true;
  });
  if (images !== 1 || other) return { ok: false, reason: NOT_ALONE };
  const image = selection.node.attrs as { src?: string | null; alt?: string | null; title?: string | null };
  return {
    ok: true,
    from: $pos.before(),
    to: $pos.after(),
    attrs: {
      frame: DEFAULT_FRAME,
      size: DEFAULT_SIZE[DEFAULT_FRAME],
      src: image.src ?? "",
      alt: image.alt ?? "",
      darkSrc: "",
      darkAlt: "",
      caption: (image.title ?? "").trim(),
    },
  };
}
