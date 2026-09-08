import Link from "next/link";
import { loadRawGarden } from "@/lib/store";
import { cloudinaryFit } from "@/lib/image-url";
import { filterHref } from "@/lib/admin-filters";
import { resolveText } from "@/lib/data";
import {
  SCREEN_FILTER_KEYS,
  distinctScreenBeans,
  distinctScreenPlants,
  distinctScreenTags,
  filterScreens,
  newScreenHref,
  screenRows,
  screensHref,
  screensQuery,
  type ScreenRow,
} from "@/lib/screens";
import { EntityAvatarGlyph, type EntityMark } from "@/components/admin/glyphs";
import { AdminFilters, type FilterGroup } from "../_components/admin-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/**
 * The screen library — a CONTACT SHEET rather than a table.
 *
 * A hundred and seventy rows of `match-hero-m104-final-spain-argentina-aet` are
 * not scannable by eye, and those names are honest filename stems precisely
 * because nobody was ever going to write a hundred and seventy titles. So the
 * page shows the screens themselves, and the name is the caption.
 *
 * Every tile is a `next/link`, which is the first one in this repo — every
 * other LINK in both zones is a plain <a href>. It renders the same real
 * anchor, so the no-script path is byte-identical; what it adds is the
 * client-side navigation that lets `app/admin/@sheet/(.)screens/[slug]`
 * intercept the click and open the editors in the side sheet WITHOUT
 * re-rendering this page. That is what keeps the grid, and the author's scroll
 * position, exactly where they were.
 */
export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string }>;
}) {
  const active = await searchParams;

  let all: ScreenRow[] | null = null;
  let plantMarks = new Map<string, EntityMark>();
  try {
    const raw = await loadRawGarden();
    all = screenRows(raw.screens ?? []);
    plantMarks = new Map(
      (raw.plants ?? []).map((plant) => [
        plant.slug,
        {
          name: resolveText(plant.name),
          hint: plant.slug,
          ...(plant.logo ? { logoUrl: plant.logo.url } : {}),
        },
      ]),
    );
  } catch {
    all = null;
  }

  if (all === null) {
    return (
      <article>
        <h1 className="mb-4 font-heading text-2xl font-medium tracking-tight">Screens</h1>
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the screens.</AlertDescription>
        </Alert>
      </article>
    );
  }

  const rows = filterScreens(all, active);
  const query = screensQuery(active);

  // Named rather than spelled inline in the table below: `as const` there makes
  // an inline array a READONLY tuple, which `FilterGroup["options"]` does not
  // admit — the vault page hands the same table named arrays for the same
  // reason.
  const plantOptions = ["all", ...distinctScreenPlants(all)];
  const beanOptions = ["all", ...distinctScreenBeans(all)];
  const tagOptions = ["all", ...distinctScreenTags(all)];

  const groups: FilterGroup[] = (
    [
      ["plant", plantOptions],
      ["bean", beanOptions],
      ["tag", tagOptions],
    ] as const
  ).map(([key, options]) => ({
    key,
    options,
    current: active[key] ?? "all",
    hrefs: options.map((opt) => filterHref("/admin/screens", active, SCREEN_FILTER_KEYS, key, opt)),
  }));

  return (
    <article className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Screens</h1>
        {/* A link, not a button that opens something: the create form is a page
            (`/admin/screens/new`) that the sheet merely presents. Its href comes
            from `newScreenHref` rather than a template literal, because
            lib/screens.ts is the one place that builds this slice's URLs and a
            second copy of the rule is a second place to forget it. */}
        <Link
          href={newScreenHref(query)}
          className="rounded-lg px-2 py-0.5 text-xl leading-none text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          {/* An `aria-hidden` glyph beside an `sr-only` word, the shape
              components/admin/glyphs.tsx uses for every icon in the admin
              tables — the name is real text in the document rather than an
              attribute on it, which is what keeps a glyph from being the only
              carrier of a value. An `aria-label` over a bare "+" reads the
              same to a screen reader and to nothing else. */}
          <span aria-hidden>+</span>
          <span className="sr-only">New screen</span>
        </Link>
      </div>

      <AdminFilters groups={groups} />

      <p className="text-sm text-muted-foreground">
        showing {rows.length} of {all.length}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {all.length === 0 ? (
            <>
              {/* The empty state NAMES the import and LINKS the other way in
                  (spec §3). A first-run page whose only route onward is the "+"
                  in the title bar is a page that reads as broken. */}
              No screens yet — run <code className="font-heading">npm run import:screens</code>, or{" "}
              <Link
                href={newScreenHref(query)}
                className="underline underline-offset-4 transition-colors hover:text-foreground"
              >
                add one
              </Link>
              .
            </>
          ) : (
            "No screens match these filters."
          )}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => (
            <li key={row.slug}>
              <Link
                /* `screensHref`, not a template literal. A stored slug came
                   from a FILENAME, and the builder is the thing that
                   percent-encodes it — hand-building the href here made the
                   tile the one place in the slice that trusted a slug, while
                   the panel's `activeTileCss` refuses to. */
                href={screensHref(row.slug, query)}
                /* The hook the open panel marks itself with — see
                   app/admin/@sheet/(.)screens/[slug]/page.tsx. This page is
                   never re-rendered while the panel navigates (that is what
                   interception buys), so it cannot know which tile is open and
                   the panel says so instead. */
                data-screen-tile={row.slug}
                className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {/* object-contain, not cover: a 9:19.5 phone capture cropped
                    into a box is a picture of its middle third, and finding a
                    screen by looking at it is the entire point of this page. */}
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg border bg-muted/40 transition-colors group-hover:border-ring">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cloudinaryFit(row.url, { width: 480 })}
                    alt={row.alt}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm">{row.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {row.plant ? (
                      <EntityAvatarGlyph
                        mark={plantMarks.get(row.plant) ?? { name: row.plant, hint: row.plant }}
                      />
                    ) : null}
                    {row.bean ? (
                      <Badge variant="secondary" className="max-w-full truncate">
                        {row.bean}
                      </Badge>
                    ) : null}
                    {row.isCover ? <Badge variant="outline">cover</Badge> : null}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
