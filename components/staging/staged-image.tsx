import type { ReactNode } from "react";
import type { MediaImage } from "@/lib/data";
import { cloudinaryFit } from "@/lib/image-url";
import { isSvgUrl, type Frame } from "@/lib/staging";
import { PhoneFrame } from "@/components/phone-frame";
import { DesktopFrame } from "@/components/desktop-frame";

/**
 * One staged image (spec 2026-11-15 §3.4). SERVER-SAFE, on
 * lib/server-safe-source.test.ts's list: every public prose page renders it,
 * and the editor's node views draw it from this same file.
 *
 * Always a real link to the original, so with script off every media item is
 * reachable full size — the public zone's promise, kept without an island.
 * `width` is the PAINTED width; derivatives ask for twice it.
 *
 * An SVG is never transformed: `f_auto` would hand back a raster of a file
 * whose whole point is that it is vector. The frames both run their image
 * through Cloudinary, so an SVG takes the bare branch whatever frame it
 * names — and only a figure can hold one anyway (spec §5).
 */
export interface ImageData {
  src: string;
  alt: string;
  title?: string | null;
}

export function FramedImage({
  image,
  frame,
  width,
  imgClassName,
}: {
  image: ImageData;
  frame: Frame;
  width: number;
  imgClassName?: string;
}): ReactNode {
  const svg = isSvgUrl(image.src);
  // PhoneFrame reads only `url` (and `width`/`height`, absent here: a staged
  // image stores no dimensions). `storageKey` is empty because nothing on this
  // path deletes or re-uploads the asset.
  const media: MediaImage = { kind: "image", storageKey: "", url: image.src };
  const inner =
    frame === "phone" && !svg ? (
      <PhoneFrame image={media} alt={image.alt} width={width * 2} />
    ) : frame === "desktop" && !svg ? (
      <DesktopFrame src={image.src} alt={image.alt} width={width * 2} imgClassName={imgClassName} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={svg ? image.src : cloudinaryFit(image.src, { width: width * 2 })}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className={`block rounded-xl border border-border ${imgClassName ?? "w-full"}`}
      />
    );
  return (
    <a href={image.src} className="block">
      {inner}
    </a>
  );
}
