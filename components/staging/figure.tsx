import type { ReactNode } from "react";
import { SIZE_WIDTH, type Frame, type Size } from "@/lib/staging";
import { FramedImage, type ImageData } from "./staged-image";

/**
 * `:::figure` (spec 2026-11-15 §3.2). SERVER-SAFE, on
 * lib/server-safe-source.test.ts's list — public prose and the editor's node
 * views both draw it.
 *
 * Breakout for `wide` is margins, never a transform (CLAUDE.md, entity-rail
 * rule: a transform makes a containing block for every fixed descendant).
 * Below `sm` every size but `s` is the column.
 */
export const SIZE_CLASS: Record<Size, string> = {
  s: "mx-auto w-full max-w-60",
  m: "mx-auto w-full sm:max-w-96",
  l: "w-full",
  wide: "w-full lg:mx-[calc((100%_-_min(60rem,calc(100vw_-_4rem)))/2)] lg:w-[min(60rem,calc(100vw_-_4rem))] lg:max-w-none",
};

export function StagedFigure({
  frame,
  size,
  image,
  dark,
  caption,
}: {
  frame: Frame;
  size: Size;
  image: ImageData;
  dark: ImageData | null;
  caption?: ReactNode;
}) {
  const width = SIZE_WIDTH[size];
  return (
    <figure className={`not-prose my-8 ${SIZE_CLASS[size]}`}>
      {/* The hidden twin must not be fetched: `loading="lazy"` on a
          `display:none` image defers it in Chromium and Firefox, which is why
          every staged <img> is lazy. The switch is the `.dark` class, so it
          agrees with the preferences menu rather than with the OS. */}
      {dark ? (
        <>
          <div className="dark:hidden">
            <FramedImage image={image} frame={frame} width={width} />
          </div>
          <div className="hidden dark:block">
            <FramedImage image={dark} frame={frame} width={width} />
          </div>
        </>
      ) : (
        <FramedImage image={image} frame={frame} width={width} />
      )}
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
