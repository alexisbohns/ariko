import type { ReactNode } from "react";

/**
 * `:::callout[label]` (spec 2026-11-15 decision 9) — an aside on the muted
 * plate. SERVER-SAFE, on lib/server-safe-source.test.ts's list.
 *
 * The body stays prose-styled — it is real markdown, entity cards and all — so
 * this is NOT `not-prose`. The accessible name is the label's plain text on
 * `aria-label` rather than `aria-labelledby` (§3.2's first sketch): a server
 * component has no `useId`, and an id minted from the label would collide the
 * day two asides share one.
 */
/** Exported for the editor's node view (components/editor/staging-views.tsx),
 *  which draws the same plate around an editable body: retyped there, the
 *  two would drift the way the editor's entity card once did. */
export const CALLOUT_CLASS =
  "my-6 rounded-2xl bg-muted px-5 py-1 text-[0.95rem] [&>p:first-child]:mt-4 [&>p:last-child]:mb-4";
export const CALLOUT_LABEL_CLASS = "mb-1 font-heading text-sm font-medium tracking-tight text-foreground";

export function StagedCallout({ labelText, children }: { labelText?: string | null; children?: ReactNode }) {
  return (
    <aside
      aria-label={labelText ?? undefined}
      className={CALLOUT_CLASS}
    >
      {children}
    </aside>
  );
}

export function CalloutLabel({ children }: { children?: ReactNode }) {
  return <p className={CALLOUT_LABEL_CLASS}>{children}</p>;
}
