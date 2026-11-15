import type { ReactNode } from "react";

/**
 * `:::quote{by role}` (spec 2026-11-15 decision 9) — someone's own words,
 * attributed. SERVER-SAFE, on lib/server-safe-source.test.ts's list.
 *
 * Set a step larger with a hanging mark. Typography's automatic quote marks
 * are turned off, or the author's text would be wrapped in a second pair
 * beside the hanging one.
 */
/** Exported for the editor's node view (components/editor/staging-views.tsx),
 *  which draws the same quote around an editable body. */
export const QUOTE_CLASS = "relative my-8 pl-7";
export const QUOTE_MARK_CLASS = "absolute -top-2 left-0 font-heading text-5xl leading-none text-muted-foreground/40";
export const QUOTE_BODY_CLASS =
  "m-0 border-0 p-0 text-lg font-normal not-italic text-foreground [&_p]:before:content-none [&_p]:after:content-none";
export const QUOTE_BY_CLASS = "mt-2 text-sm text-muted-foreground";

export function StagedQuote({ by, role, children }: { by: string; role?: string | null; children?: ReactNode }) {
  return (
    <figure className={QUOTE_CLASS}>
      <span
        aria-hidden="true"
        className={QUOTE_MARK_CLASS}
      >
        “
      </span>
      <blockquote className={QUOTE_BODY_CLASS}>
        {children}
      </blockquote>
      <figcaption className={QUOTE_BY_CLASS}>
        — {by}
        {role ? `, ${role}` : ""}
      </figcaption>
    </figure>
  );
}
