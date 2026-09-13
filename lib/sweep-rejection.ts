/**
 * Drop `?error=` and `?form=` from the URL, without navigating.
 *
 * A rejected save redirects back with those two params so the surface it came
 * from can reopen and render the message beside the field. They then OUTLIVE
 * the surface: close it, reload, and the banner comes back about an edit that
 * no longer exists in any field. This is the sweep that prevents that.
 *
 * `replaceState` rather than a router push, and the distinction is load-bearing:
 * this is tidying the URL, not a navigation, and a navigation here would
 * re-render the page underneath the surface that is in the middle of closing.
 *
 * **A pure DOM utility with no entity knowledge and no React in it**, which is
 * why it lives here rather than inside any of its three callers. It was written
 * once in `entity-rail.tsx` and then copied, verbatim and independently, into
 * `sprout-hero.tsx`'s `close()` and `bean-hero.tsx`'s — the third copy is the
 * threshold, and a rule about URL hygiene told in three files is three files
 * that drift.
 *
 * Client-safe by construction: it imports nothing, and guards `window` so a
 * server render is a no-op rather than a crash.
 */
export function sweepRejection(): void {
  if (typeof window === "undefined" || !window.location.search) return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("error") && !url.searchParams.has("form")) return;
  url.searchParams.delete("error");
  url.searchParams.delete("form");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
