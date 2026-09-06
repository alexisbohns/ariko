import type { Media, MediaImage } from "./data";

/**
 * How `media[]` is grouped for rendering — and the whole of the gallery's
 * decision, kept out of the markup.
 *
 * A set of images is a set. Six 1080×1350 Instagram slides rendered one per
 * row, full width, is six screens of scroll before the reader reaches anything
 * else — so consecutive images collapse into ONE strip that the reader swipes.
 *
 * No new field was needed for that, and that is the point: adjacency in
 * `media[]` already carries the author's intent, so a `gallery: true` flag
 * would be a second source of truth for something the array already says.
 *
 * THE THRESHOLD IS TWO, and the one-image case is load-bearing rather than an
 * edge case: a lone image comes back as a `single` and renders through exactly
 * the markup it always did. That is what makes this change unable to alter any
 * existing page — the only rows affected are rows with an adjacent pair, and
 * before this slice nothing authored one.
 */

export type MediaRun =
  | { kind: "gallery"; images: MediaImage[] }
  | { kind: "single"; item: Media };

export function mediaRuns(media: Media[]): MediaRun[] {
  const runs: MediaRun[] = [];
  let pending: MediaImage[] = [];

  const flush = () => {
    if (pending.length >= 2) runs.push({ kind: "gallery", images: pending });
    else if (pending.length === 1) runs.push({ kind: "single", item: pending[0] });
    pending = [];
  };

  for (const item of media) {
    if (item.kind === "image") {
      pending.push(item);
      continue;
    }
    flush();
    runs.push({ kind: "single", item });
  }
  flush();

  return runs;
}
