import type { ReactNode } from "react";
import type { Frame } from "@/lib/staging";
import { FramedImage, type ImageData } from "./staged-image";

/**
 * `:::gallery` (spec 2026-11-15 decision 7). SERVER-SAFE, on
 * lib/server-safe-source.test.ts's list.
 *
 * Natural ratios at a shared row height, rows centred — pure CSS, because a
 * staged image stores no dimensions and a layout that needed them would need
 * an island to measure. Phone screens are equal-ratio by nature, so a phone
 * gallery is even columns instead.
 */
export function StagedGallery({
  frame,
  images,
  caption,
}: {
  frame: Frame;
  images: ImageData[];
  caption?: ReactNode;
}) {
  const cell = (img: ImageData, i: number, width: number, imgClassName?: string) => (
    <figure key={i} className="m-0 min-w-0">
      <FramedImage image={img} frame={frame} width={width} imgClassName={imgClassName} />
      {img.title ? (
        <figcaption className="mt-1.5 text-xs leading-snug text-muted-foreground">{img.title}</figcaption>
      ) : null}
    </figure>
  );
  return (
    <figure className="not-prose my-8">
      {frame === "phone" ? (
        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, minmax(0, 1fr))` }}
        >
          {images.map((img, i) => cell(img, i, 256))}
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-center gap-3.5">
          {images.map((img, i) => cell(img, i, 480, "h-auto max-h-56 w-auto max-w-full"))}
        </div>
      )}
      {caption ? (
        <figcaption className="mt-3 text-center text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
