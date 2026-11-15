import type { ReactNode } from "react";
import { CheckIcon, XIcon } from "@/components/public-icons";
import type { CompareSide as Verdict } from "@/lib/staging";
import { FramedImage, type ImageData } from "./staged-image";

/**
 * `::::compare` and its two sides (spec 2026-11-15 §3.2). SERVER-SAFE, on
 * lib/server-safe-source.test.ts's list — which is why the marks come from
 * components/public-icons.tsx and not lucide: one lucide import is one client
 * boundary under every prose page.
 */
export function StagedCompare({ children }: { children?: ReactNode }) {
  return <div className="not-prose my-8 grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** The verdict is a WORD beside the mark — never colour alone (spec §3.2): a
 *  green tick and a red cross are the same grey to a reader who cannot tell
 *  the two apart, and the words are what a screen reader says. */
export function CompareSide({
  verdict,
  label,
  image,
  text,
}: {
  verdict: Verdict;
  label: string;
  image: ImageData | null;
  text?: ReactNode;
}) {
  const ok = verdict === "do";
  return (
    <figure className="m-0">
      <p
        className={`mb-2 flex items-center gap-1.5 font-heading text-xs font-medium ${ok ? "text-primary" : "text-destructive"}`}
      >
        <span
          aria-hidden="true"
          className={`inline-flex size-[18px] items-center justify-center rounded-full text-white ${ok ? "bg-primary" : "bg-destructive"}`}
        >
          {ok ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
        </span>
        {label}
      </p>
      {image ? <FramedImage image={image} frame="none" width={384} /> : null}
      <figcaption className="mt-2 text-sm leading-snug text-foreground/80">{text}</figcaption>
    </figure>
  );
}
