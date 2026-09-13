import { notFound } from "next/navigation";
import { loadRawGarden } from "@/lib/store";
import { PLANT_PREFIX, parentsWithPrefix, resolveText, type RawGarden } from "@/lib/data";
import { cloudinaryFit } from "@/lib/image-url";
import { filterScreens, neighbours, screenRows, screensQuery } from "@/lib/screens";
import { ScreenNav } from "@/app/admin/_components/screen-nav";
import { ScreenMetaForm } from "@/app/admin/_components/screen-meta-form";
import { ScreenExhibitForm, type ScreenPlantRef } from "@/app/admin/_components/screen-exhibit-form";
import { ScreenImageForm } from "@/app/admin/_components/screen-image-form";
import { ScreenDeleteForm } from "@/app/admin/_components/screen-delete-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { resolveLineage, ADMIN_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";

export const dynamic = "force-dynamic";

/**
 * One screen, with everything that edits it.
 *
 * THIS COMPONENT IS ALSO THE SIDE SHEET'S BODY — `app/admin/@sheet/(.)screens/[slug]/page.tsx`
 * renders this very module inside the panel. That is the whole reason the panel
 * costs no exception in CLAUDE.md's list: there is nothing in the sheet that is
 * not a page, so script-off the same click is an ordinary navigation here and
 * every field still works. Keep the two identical; a divergence is a no-script
 * hole.
 *
 * prev/next are computed from the FILTERED rows, so the arrows walk the set the
 * author is looking at rather than the whole collection.
 *
 * `inSheet` IS THE ONE DIFFERENCE THE TWO RENDERS ARE ALLOWED, and it exists
 * because the parenting chrome is `position: fixed`. A fixed cluster cannot be
 * contained by the panel it happens to be rendered in — it lands at the
 * viewport's top-center whatever its ancestors do — so inside the sheet the
 * trail floats over the page while its subject sits in the right-hand panel,
 * and the geometry claims "this is about the page" when it is not. That makes
 * it a RENDER decision, not a CSS one: there is no containment to reach for.
 *
 * It is a parameter rather than either of the two obvious alternatives, both of
 * which are worse:
 *   - the sheet reimplementing the page's body to leave the cluster out —
 *     exactly the drift `lib/screen-sheet-source.test.ts` exists to forbid,
 *     since the slot reusing this module WHOLESALE is what keeps the library
 *     script-off navigable;
 *   - this page sniffing its own context (a header, a segment, a pathname) to
 *     decide — which makes a server component's output depend on something no
 *     caller can see or test.
 * Next only ever hands a route's default export `params` / `searchParams`, so
 * on `/admin/screens/[slug]` the flag is `undefined` and the standalone page
 * keeps its trail. Only the sheet, which calls this component directly, passes
 * it. Delete the guard or the pass-through and a viewport-fixed cluster sits
 * back over the open sheet, with `tsc`, `npm test` and `npm run build` all
 * green — which is why `lib/screen-sheet-source.test.ts` pins both ends.
 */
export default async function ScreenPage({
  params,
  searchParams,
  inSheet,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
  inSheet?: boolean;
}) {
  const { slug } = await params;
  const active = await searchParams;

  // The index's stance on a database that will not answer, and the same one
  // here: an Alert rather than a 500, so the panel the author is looking at
  // says what happened instead of blanking. `notFound()` stays OUT of the try —
  // it throws to control flow, exactly as `redirect()` does in actions.ts, and
  // a catch around it would turn a missing screen into "couldn't load".
  let raw: RawGarden | null = null;
  try {
    raw = await loadRawGarden();
  } catch {
    raw = null;
  }
  if (raw === null) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>Couldn&apos;t load this screen.</AlertDescription>
      </Alert>
    );
  }

  const screen = (raw.screens ?? []).find((s) => s.slug === slug);
  if (!screen) notFound();

  const query = screensQuery(active);
  const rows = filterScreens(screenRows(raw.screens ?? []), active);
  const { prev, next } = neighbours(rows, slug);
  const isCover = (screen.relations ?? []).some((r) => r.kind === "cover");
  const plantSlug = parentsWithPrefix(screen.parents, PLANT_PREFIX)[0] ?? null;
  const plantDoc = plantSlug ? (raw.plants ?? []).find((p) => p.slug === plantSlug) : undefined;
  // The LIVE garden — already loaded above, per CLAUDE.md's garden rule. "en":
  // the admin zone is authored in one language.
  const lineage = resolveLineage(screen.parents, raw, { lang: "en", hrefs: ADMIN_HREFS });

  // Three states, not `string | null`: a plant ref that names no document in
  // the garden is neither "no plant" nor a resolved name, and ScreenExhibitForm's
  // docblock explains why collapsing it into either would be wrong.
  const plantRef: ScreenPlantRef = !plantSlug
    ? { kind: "none" }
    : plantDoc
      ? { kind: "found", slug: plantSlug, name: resolveText(plantDoc.name) || plantSlug }
      : { kind: "dangling", slug: plantSlug };

  return (
    <>
      {inSheet ? null : <LineageChrome lineage={lineage} as={Link} />}
      <div className="flex flex-col gap-6">
        <ScreenNav prev={prev} next={next} query={query} />

        {active.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{active.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-xl font-medium tracking-tight">
            {resolveText(screen.name)}
          </h1>
          <p className="font-heading text-xs text-muted-foreground">{screen.slug}</p>
        </div>

        <div className="flex justify-center rounded-lg border bg-muted/40 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cloudinaryFit(screen.image.url, { width: 720 })}
            alt={screen.image.alt ?? ""}
            className="max-h-[50vh] w-auto object-contain"
          />
        </div>

        {/* Each card is named, in the bean page's shape (`<h2>` above the card),
            because three unlabelled cards leave this body with no heading outline
            under its h1 — and the Delete card in particular would be identified
            only by the text of its own checkbox. It matters more here than on an
            ordinary page: the same markup is the side sheet's contents, where a
            reader arrives without the page around it. */}
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg tracking-tight">Details</h2>
          <Card>
            <CardContent>
              <ScreenMetaForm
                screen={screen}
                plants={raw.plants ?? []}
                beans={raw.beans ?? []}
                query={query}
              />
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg tracking-tight">Exhibition</h2>
          <Card>
            <CardContent>
              <ScreenExhibitForm screen={screen} plant={plantRef} query={query} />
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg tracking-tight">Image</h2>
          <Card>
            <CardContent>
              <ScreenImageForm screen={screen} query={query} />
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg tracking-tight text-destructive">Danger zone</h2>
          <Card className="ring-destructive/30">
            <CardContent>
              <ScreenDeleteForm screen={screen} isCover={isCover} query={query} />
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
