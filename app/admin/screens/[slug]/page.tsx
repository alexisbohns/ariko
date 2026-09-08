import { notFound } from "next/navigation";
import { loadRawGarden } from "@/lib/store";
import { resolveText } from "@/lib/data";
import { cloudinaryFit } from "@/lib/image-url";
import { filterScreens, neighbours, screenRows, screensQuery } from "@/lib/screens";
import { ScreenNav } from "@/app/admin/_components/screen-nav";
import { ScreenMetaForm } from "@/app/admin/_components/screen-meta-form";
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

  const raw = await loadRawGarden();
  const screen = (raw.screens ?? []).find((s) => s.slug === slug);
  if (!screen) notFound();

  const query = screensQuery(active);
  const rows = filterScreens(screenRows(raw.screens ?? []), active);
  const { prev, next } = neighbours(rows, slug);
  const isCover = (screen.relations ?? []).some((r) => r.kind === "cover");

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

      <Card>
        <CardContent>
          <ScreenImageForm screen={screen} query={query} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ScreenDeleteForm screen={screen} isCover={isCover} query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
