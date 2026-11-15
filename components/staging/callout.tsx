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
export function StagedCallout({ labelText, children }: { labelText?: string | null; children?: ReactNode }) {
  return (
    <aside
      aria-label={labelText ?? undefined}
      className="my-6 rounded-2xl bg-muted px-5 py-1 text-[0.95rem] [&>p:first-child]:mt-4 [&>p:last-child]:mb-4"
    >
      {children}
    </aside>
  );
}

export function CalloutLabel({ children }: { children?: ReactNode }) {
  return <p className="mb-1 font-heading text-sm font-medium tracking-tight text-foreground">{children}</p>;
}
