import { resolveText } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";
import { coverFor } from "@/lib/cover";
import { cloudinaryThumb } from "@/lib/image-url";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const data = await getPublicDataset();
  const plants = data.getPlants();
  const unrooted = data.unrootedPods();
  const standalone = data.standaloneBeans();

  const beanList = (beans: ReturnType<typeof data.beansForPod>) => (
    <ul className="flex flex-col gap-2">
      {beans.map((bean) => {
        // sproutsForBean is newest-first (buildDataset), which is the ordering
        // coverFor expects.
        const cover = coverFor(data.sproutsForBean(bean.slug));
        return (
          <li key={bean.slug} className="flex items-start gap-3">
            {/* A fixed-width gutter, reserved whether or not this row has a
                cover. Most beans have none yet, and rendering the thumbnail
                only when present pushed the text column in by 52px on rows
                that had one and left it flush on rows that didn't — a list
                that read as ragged rather than aligned. Reserving the slot
                keeps the text column straight without inventing a "missing
                image" placeholder graphic for the common no-cover case. */}
            <div className="h-10 w-10 shrink-0">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  // A 40px row painting a full-size Cloudinary original could
                  // cost several MB per bean; cloudinaryThumb asks Cloudinary
                  // for an already-shrunk derivative instead. 80 (not 40) so
                  // the thumbnail stays sharp on a 2x display.
                  src={cloudinaryThumb(cover.url, { width: 80, height: 80 })}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-10 rounded object-cover"
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <a
                href={`/bean/${bean.slug}`}
                className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {resolveText(bean.name)}
              </a>
              {/* One muted line, never markdown: descriptions are one-liners, content is not (spec §5). */}
              {resolveText(bean.description ?? "").trim() ? (
                <p className="text-xs text-muted-foreground/80">{resolveText(bean.description)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const podSection = (pod: ReturnType<typeof data.podsForPlant>[number]) => (
    <section key={pod.slug} className="flex flex-col gap-2">
      <h3 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
        <a href={`/pod/${pod.slug}`} className="underline-offset-4 hover:underline">
          {resolveText(pod.name)}
        </a>
      </h3>
      {resolveText(pod.description ?? "").trim() ? (
        <p className="text-xs text-muted-foreground/80">{resolveText(pod.description)}</p>
      ) : null}
      {beanList(data.beansForPod(pod.slug))}
    </section>
  );

  return (
    <article className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl font-medium tracking-tight">Directory</h1>

      {plants.map((plant) => (
        <Card key={plant.slug}>
          <CardHeader>
            <CardTitle className="font-heading text-lg tracking-tight">
              <a href={`/plant/${plant.slug}`} className="underline-offset-4 hover:underline">
                {resolveText(plant.name)}
              </a>
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {plant.natures.map((nature) => (
                <Badge key={nature} variant="secondary">
                  {nature}
                </Badge>
              ))}
            </div>
            {resolveText(plant.description ?? "").trim() ? (
              <p className="text-sm text-muted-foreground">{resolveText(plant.description)}</p>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* A bean parented to BOTH the plant and one of its pods appears in each list — multi-parent membership is by design. */}
            {data.beansForPlant(plant.slug).length > 0 && beanList(data.beansForPlant(plant.slug))}
            {data.podsForPlant(plant.slug).map(podSection)}
          </CardContent>
        </Card>
      ))}

      {(unrooted.length > 0 || standalone.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg tracking-tight">Unrooted</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {unrooted.map(podSection)}
            {standalone.length > 0 && beanList(standalone)}
          </CardContent>
        </Card>
      )}
    </article>
  );
}
