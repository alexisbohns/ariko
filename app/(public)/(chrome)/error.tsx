"use client";

/**
 * The inner public-zone error boundary — the one that catches a throw from
 * `plant/[slug]`, `pod/[slug]`, `bean/[id]` or any other page under
 * `(chrome)`, WITHOUT unmounting `(chrome)/layout.tsx` around it: Next mounts
 * a segment's `error.tsx` in place of that segment's own children, leaving
 * the segment's own layout — here, the mark, the nav and the language switch
 * — standing. That is the same relationship this slice's two `not-found.tsx`
 * files already have, and for the same reason: a visitor should be able to
 * leave without the back button, and losing the chrome on the exact pages
 * that read Mongo (the three above) would contradict that.
 *
 * `app/(public)/error.tsx` stays too, and is not redundant with this one: a
 * segment's `error.tsx` cannot catch a throw from that same segment's own
 * layout, so only the OUTER boundary can catch a failure inside
 * `(chrome)/layout.tsx` itself. That outer boundary is also the one covering
 * `app/(public)/page.tsx` (the landing), which sits outside this group.
 *
 * `"use client"` is Next's requirement. This file renders inside
 * `(chrome)/layout.tsx`'s `<main>` and `READING_COLUMN` div, so — unlike the
 * outer boundary — it needs neither: a plain `<div>`, and it imports nothing
 * at all beyond the pragma above. `lib/error-pages.test.tsx` pins the exact
 * (empty) import list, and that it renders no `<main>` and no `max-w-3xl` of
 * its own.
 *
 * English-only, like the outer boundary and for the same reason: a client
 * component cannot read the language cookie.
 */
export default function ChromeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
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
  );
}
