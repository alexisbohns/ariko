/**
 * Scheme vetting for a stored URL. Zero imports — `URL` is a Web/Node global,
 * not a dependency — so any layer can use it, including one that runs before
 * the app exists.
 *
 * WHY IT IS NEEDED AT ALL: a stored media URL is never scheme-checked on the
 * way in. `lib/inbox.ts` requires only a non-empty string, deliberately
 * (spec §3 — a capture must never fail on a URL we merely dislike), so the
 * check belongs at each place the string is handed to something that acts on
 * it.
 *
 * WHY AN `href` IS GUARDED AND AN `<img src>` IS NOT — the asymmetry is
 * reasoned, not an oversight, and the repo has four unguarded `<img src>` sites
 * (app/(public)/page.tsx, components/entity.tsx, components/media.tsx,
 * components/admin/media-picker.tsx) to prove it:
 *
 *   - An `href` is a NAVIGATION sink. `javascript:` in an href executes on
 *     click, with the page's origin; a string that is not a URL at all resolves
 *     RELATIVE to the current page and quietly navigates to an in-site 404.
 *     React 19 does sanitize `javascript:` hrefs in its server builds, but that
 *     is React's guarantee to withdraw, not ours to rely on.
 *   - An `<img src>` is a FETCH sink. The browser fetches it as an image and
 *     nothing else: `javascript:` never executes there, and a `data:` image is
 *     inert pixels. The worst a hostile value does is fail to paint. Guarding
 *     it would trade a broken image for no image, buying nothing.
 *
 * The third sink is neither: `lib/graph.ts` puts a cover URL into the
 * `/api/graph` payload, where the consumer is an unknown client renderer that
 * may well use it as an href. A JSON boundary cannot vet its own sink, so it
 * vets the value instead.
 */
export function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    // `new URL` lowercases the scheme, so "JavaScript:" is caught too.
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
