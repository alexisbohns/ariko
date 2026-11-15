import { Suspense, type ReactNode } from "react";
import { MapSheet } from "../../_components/map-sheet";

/**
 * The map's layout exists to hold the `@entity` slot (spec 2026-11-15
 * §"Mechanism"). The slot lives HERE and not under `(chrome)` as the screen
 * sheet's does, so that interception is active only while the router is on the
 * map: an interceptor at the chrome level would turn every link to a bean in the
 * tables, the palette and the lineage chrome into a sheet.
 *
 * `useSearchParams` in `MapSheet` wants a boundary; `null` because a half-drawn
 * sheet frame is worse than none.
 */
export default function MapLayout({ children, entity }: { children: ReactNode; entity: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MapSheet>{entity}</MapSheet>
      </Suspense>
    </>
  );
}
