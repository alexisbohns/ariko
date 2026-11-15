import Link from "next/link";
import { Chrome } from "@/components/chrome";
import { filterHref, type FilterValues } from "@/lib/admin-filters";
import { MAP_VIEWS, type MapView } from "@/lib/garden-map";

const PATH = "/admin/map";

const LABEL: Record<MapView, string> = {
  all: "All",
  review: "Needs review",
  gaps: "Has gaps",
};

/**
 * The map's three views, as links. The view is `?view=` in the URL and is read
 * by the page (`lib/admin-filters.ts`'s rule: a filtered view is shareable and
 * filtering is server-side). `all` is `NO_FILTER`, so it is the absent query.
 *
 * The plate is kept at `md+` (`CHROME_PLATE` goes transparent there, which
 * suits an icon rail but would leave the only view switcher as bare text over
 * a busy canvas), and `w-max` stops a bottom-centre element with `left: 50%`
 * shrinking to half the viewport and wrapping its links.
 *
 * `plant` rides through so a view change keeps the scope; `view` is not a
 * `SECTION_KEYS` key, so a plant switch drops it — a different tree is a
 * different question.
 */
export function MapToolbar({
  active,
  view,
  counts,
}: {
  active: FilterValues;
  view: MapView;
  counts: Record<MapView, number>;
}) {
  return (
    <Chrome
      magnet="bottom-center"
      content
      label="Map view"
      className="w-max max-w-[calc(100vw-2rem)] md:border-border md:bg-card/80 md:shadow-lg md:backdrop-blur"
    >
      {MAP_VIEWS.map((option) => {
        const current = option === view;
        return (
          <Link
            key={option}
            href={filterHref(PATH, active, ["plant", "view"], "view", option)}
            aria-current={current ? "page" : undefined}
            className={
              "rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors md:px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
              (current
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
            }
          >
            {LABEL[option]} <span className="tabular-nums opacity-70">{counts[option]}</span>
          </Link>
        );
      })}
    </Chrome>
  );
}
