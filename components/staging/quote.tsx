import type { ReactNode } from "react";

/**
 * `:::quote{by role}` (spec 2026-11-15 decision 9) — someone's own words,
 * attributed. SERVER-SAFE, on lib/server-safe-source.test.ts's list.
 *
 * Set a step larger with a hanging mark. Typography's automatic quote marks
 * are turned off, or the author's text would be wrapped in a second pair
 * beside the hanging one.
 */
export function StagedQuote({ by, role, children }: { by: string; role?: string | null; children?: ReactNode }) {
  return (
    <figure className="relative my-8 pl-7">
      <span
        aria-hidden="true"
        className="absolute -top-2 left-0 font-heading text-5xl leading-none text-muted-foreground/40"
      >
        “
      </span>
      <blockquote className="m-0 border-0 p-0 text-lg font-normal not-italic text-foreground [&_p]:before:content-none [&_p]:after:content-none">
        {children}
      </blockquote>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        — {by}
        {role ? `, ${role}` : ""}
      </figcaption>
    </figure>
  );
}
