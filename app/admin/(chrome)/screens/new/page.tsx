import Link from "next/link";
import { loadRawGarden } from "@/lib/store";
import type { Plant } from "@/lib/data";
import { screensHref, screensQuery } from "@/lib/screens";
import { ScreenCreateForm } from "@/app/admin/_components/screen-create-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * A new screen. Also a sheet body — `app/admin/@sheet/(.)screens/new/page.tsx`
 * renders this module inside the panel, exactly as the screen page is rendered
 * there, so the `+` beside the library's title is a link to a page rather than
 * a button that opens something.
 */
export default async function NewScreenPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
}) {
  const active = await searchParams;
  const query = screensQuery(active);

  // The index's stance on a database that will not answer — an Alert rather
  // than a 500. The plant list is the only thing loaded here, so the form could
  // in principle be offered without it; it is not, because a create form whose
  // Plant select is silently empty writes screens with no parent.
  let plants: Plant[] | null = null;
  try {
    plants = (await loadRawGarden()).plants ?? [];
  } catch {
    plants = null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-medium tracking-tight">New screen</h1>
        <Link
          href={screensHref(null, query)}
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          ← library
        </Link>
      </div>

      {active.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{active.error}</AlertDescription>
        </Alert>
      ) : null}

      {plants === null ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the garden.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <ScreenCreateForm plants={plants} query={query} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
