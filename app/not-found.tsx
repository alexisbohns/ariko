import { READING_COLUMN } from "@/components/page-column";

/**
 * Unmatched URLs. Root layout only — Next gives the root not-found boundary no
 * zone chrome, which is a documented constraint rather than a choice here. The
 * three public `notFound()` calls resolve to the nearer boundary at
 * `app/(public)/(chrome)/not-found.tsx` and DO get the chrome.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center">
      <div className={READING_COLUMN}>
        <h1 className="font-mono text-2xl">Not here</h1>
        <p className="mt-3 text-muted-foreground">
          This page does not exist, or it was never public.
        </p>
        <p className="mt-8">
          <a href="/" className="underline underline-offset-4">
            Back to Ariko
          </a>
        </p>
      </div>
    </main>
  );
}
