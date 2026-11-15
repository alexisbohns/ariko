import { cloudinaryFit } from "@/lib/image-url";

/**
 * A desktop screenshot, framed (spec 2026-11-15 §3.3): a hairline, the
 * theme's radius, and an 18px strip with three dots. It identifies a screen
 * without drawing a browser — traffic lights date, and a window chrome
 * competes with what is inside it. The phone's sibling: same outline, same
 * tokens, so the two read as one family.
 *
 * SERVER-SAFE, on lib/server-safe-source.test.ts's list. `width` is the
 * DERIVATIVE's (twice the painted width), as in PhoneFrame.
 */
export function DesktopFrame({
  src,
  alt,
  width,
  imgClassName,
}: {
  src: string;
  alt: string;
  width: number;
  imgClassName?: string;
}) {
  return (
    <span className="block overflow-hidden rounded-xl border border-border bg-card">
      <span
        aria-hidden="true"
        className="flex h-[18px] items-center gap-[5px] border-b border-border bg-muted px-2.5"
      >
        <span className="size-[7px] rounded-full bg-muted-foreground/40" />
        <span className="size-[7px] rounded-full bg-muted-foreground/40" />
        <span className="size-[7px] rounded-full bg-muted-foreground/40" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cloudinaryFit(src, { width })}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`block ${imgClassName ?? "w-full"}`}
      />
    </span>
  );
}
