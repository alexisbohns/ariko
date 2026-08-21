import { resolveText } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const data = await getPublicDataset();
  const plants = data.getPlants();
  const unrooted = data.unrootedPods();
  const standalone = data.standaloneBeans();

  const beanList = (beans: ReturnType<typeof data.beansForPod>) => (
    <ul className="flex flex-col gap-1">
      {beans.map((bean) => (
        <li key={bean.slug}>
          <a
            href={`/bean/${bean.slug}`}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {resolveText(bean.name)}
          </a>
        </li>
      ))}
    </ul>
  );

  const podSection = (pod: ReturnType<typeof data.podsForPlant>[number]) => (
    <section key={pod.slug} className="flex flex-col gap-2">
      <h3 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
        {resolveText(pod.name)}
      </h3>
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
              {resolveText(plant.name)}
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {plant.natures.map((nature) => (
                <Badge key={nature} variant="secondary">
                  {nature}
                </Badge>
              ))}
            </div>
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
