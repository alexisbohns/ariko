/**
 * The slot at `/admin/map` itself — deliberately nothing, and the reason Close
 * closes. On a SOFT navigation Next keeps a slot's previous state instead of
 * falling back to `default.tsx`, so without a route that MATCHES the map the
 * sheet would stay open over it after the URL changed back. This is the screen
 * sheet's `@sheet/screens/page.tsx` for the same reason, and
 * `lib/map-sheet-source.test.ts` pins its existence: deleting it as dead code
 * re-opens the bug.
 */
export default function NoEntityOnMap() {
  return null;
}
