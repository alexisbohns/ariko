"use client";

import { READING_COLUMN } from "@/components/page-column";

/**
 * The outer public-zone error boundary.
 *
 * There are now two: this one, and `app/(public)/(chrome)/error.tsx`. This is
 * the one that owns `<main>` and the reading column, because it covers ground
 * the inner boundary cannot reach — `app/(public)/page.tsx` (the landing,
 * `force-dynamic`, reads Mongo directly, and sits outside the `(chrome)`
 * group) and, more importantly, a throw inside `(chrome)/layout.tsx` itself.
 * A segment's `error.tsx` wraps what that segment renders BELOW it, never the
 * segment's own layout — so only the boundary one level up can catch the
 * chrome layout failing.
 *
 * `"use client"` is Next's requirement, not a choice — and Next puts this
 * component in the client bundle of every route the boundary covers, which is
 * the whole public zone. That is a client boundary added in the slice right
 * after the rulebook rewrite removed one, so this file imports only the
 * measure it needs to lay out its own `<main>` — `READING_COLUMN`, a plain
 * string constant with no imports of its own — and nothing else: no `cn`, no
 * registry primitive, no lucide. `lib/error-pages.test.tsx` pins the exact
 * import list, as an allowlist rather than a blocklist of names it thought to
 * ban.
 *
 * English-only, unlike the chrome 404: a client component cannot read the
 * language cookie, and the reading language is not worth a second boundary.
 *
 * Rare by construction now. With a warm Data Cache a Mongo outage renders the
 * stale garden and never reaches here; this is for a cold cache and for the
 * genuinely unexpected.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-svh items-center">
      <div className={READING_COLUMN}>
        <h1 className="font-heading text-2xl">Something broke</h1>
        <p className="mt-3 text-muted-foreground">
          This page could not be loaded. It is usually temporary.
        </p>
        {error.digest ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex gap-6">
          <button
            type="button"
            onClick={reset}
            className="underline underline-offset-4"
          >
            Try again
          </button>
          <a href="/" className="underline underline-offset-4">
            Back to Ariko
          </a>
        </div>
      </div>
    </main>
  );
}
