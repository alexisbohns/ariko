"use client";

/**
 * The public zone's error boundary.
 *
 * `"use client"` is Next's requirement, not a choice — and Next puts this
 * component in the client bundle of every route the boundary covers, which is
 * the whole public zone. That is a client boundary added in the slice right
 * after the rulebook rewrite removed one, so this file imports NOTHING:
 * literal Tailwind strings rather than `cn`, no registry primitive, no lucide.
 * `lib/not-found-pages.test.tsx` pins that.
 *
 * English-only, unlike the chrome 404: a client component cannot read the
 * language cookie, and the reading language is not worth a second boundary.
 *
 * Rare by construction now. With a warm Data Cache a Mongo outage renders the
 * stale garden and never reaches here; this is for a cold cache and for the
 * genuinely unexpected.
 */
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center">
      <div className="mx-auto w-full max-w-3xl px-6">
        <h1 className="font-mono text-2xl">Something broke</h1>
        <p className="mt-3 text-muted-foreground">
          This page could not be loaded. It is usually temporary.
        </p>
        <p className="mt-8 flex gap-6">
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
        </p>
      </div>
    </main>
  );
}
