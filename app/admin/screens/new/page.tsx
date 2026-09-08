import Link from "next/link";
import { loadRawGarden } from "@/lib/store";
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
  const raw = await loadRawGarden();

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

      <Card>
        <CardContent>
          <ScreenCreateForm plants={raw.plants ?? []} query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
