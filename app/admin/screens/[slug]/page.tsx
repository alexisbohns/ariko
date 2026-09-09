import { notFound } from "next/navigation";
import { loadRawGarden } from "@/lib/store";
import { PLANT_PREFIX, parentsWithPrefix, resolveText, type RawGarden } from "@/lib/data";
import { cloudinaryFit } from "@/lib/image-url";
import { filterScreens, neighbours, screenRows, screensQuery } from "@/lib/screens";
import { ScreenNav } from "@/app/admin/_components/screen-nav";
import { ScreenMetaForm } from "@/app/admin/_components/screen-meta-form";
import { ScreenExhibitForm } from "@/app/admin/_components/screen-exhibit-form";
import { ScreenImageForm } from "@/app/admin/_components/screen-image-form";
import { ScreenDeleteForm } from "@/app/admin/_components/screen-delete-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

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
 */
export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
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
  const plantName = plantSlug
    ? (resolveText((raw.plants ?? []).find((p) => p.slug === plantSlug)?.name) || plantSlug)
    : null;

  return (
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
            <ScreenExhibitForm screen={screen} plantName={plantName} query={query} />
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
  );
}
