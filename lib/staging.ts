import type { Lang } from "./locale";

/**
 * The staging grammar's vocabulary (spec 2026-11-15 §2.4) — the one place the
 * five blocks and their closed value lists are named, as lib/plant-status.ts
 * is for its enum. The remark pass, the marked tokenizers, the sanitize
 * schema's value lists, the editor's radios and the door's validator all read
 * this file; nothing re-lists a member. A member spelled twice is how the
 * renderer and the door come to disagree about whether `size=xl` exists.
 *
 * Pure and client-safe: the editor's staging forms import it.
 */

export const STAGED_BLOCKS = ["figure", "gallery", "compare", "callout", "quote"] as const;
export type StagedBlock = (typeof STAGED_BLOCKS)[number];

export const COMPARE_SIDES = ["do", "dont"] as const;
export type CompareSide = (typeof COMPARE_SIDES)[number];

export const FRAMES = ["phone", "desktop", "none"] as const;
export type Frame = (typeof FRAMES)[number];

export const SIZES = ["s", "m", "l", "wide"] as const;
export type Size = (typeof SIZES)[number];

export const DEFAULT_FRAME: Frame = "none";

/** A phone is narrow by nature; a desktop screenshot wants the column. */
export const DEFAULT_SIZE: Record<Frame, Size> = { phone: "m", desktop: "l", none: "l" };

/** What each block accepts. Anything else is refused by the door (§6.1) and
 *  ignored on render (§2.2). */
export const BLOCK_ATTRIBUTES: Record<StagedBlock, readonly string[]> = {
  figure: ["frame", "size", "dark"],
  gallery: ["frame"],
  compare: [],
  callout: [],
  quote: ["by", "role"],
};

/** Painted width in CSS px per size. Derivatives ask Cloudinary for twice it. */
export const SIZE_WIDTH: Record<Size, number> = { s: 240, m: 384, l: 768, wide: 960 };

/** The verdict words. Real text in the page's language, never colour alone. */
export const COMPARE_LABELS: Record<Lang, Record<CompareSide, string>> = {
  en: { do: "Do", dont: "Don't" },
  fr: { do: "À faire", dont: "À éviter" },
};

/** The one block an SVG may sit in (spec §5, §6.2). */
export const SVG_BLOCK: StagedBlock = "figure";

const has = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

export const isStagedBlock = (v: unknown): v is StagedBlock => has(STAGED_BLOCKS, v);
export const isFrame = (v: unknown): v is Frame => has(FRAMES, v);
export const isSize = (v: unknown): v is Size => has(SIZES, v);

export const resolveFrame = (v: unknown): Frame => (isFrame(v) ? v : DEFAULT_FRAME);
export const resolveSize = (v: unknown, frame: Frame): Size => (isSize(v) ? v : DEFAULT_SIZE[frame]);

/** By the URL's PATH, so a `?x=.svg` query on a PNG is not an SVG. A string
 *  that is not a URL falls back to its own ending — the door refuses it as
 *  unhosted anyway. */
export function isSvgUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return /\.svg$/i.test(url.trim());
  }
}
