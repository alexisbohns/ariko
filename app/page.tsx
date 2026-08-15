import { resolveText } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const data = await getPublicDataset();
  const plants = data.getPlants();
  const unrooted = data.unrootedPods();
  const standalone = data.standaloneBeans();

  const beanList = (beans: ReturnType<typeof data.beansForPod>) => (
    <ul>
      {beans.map((bean) => (
        <li key={bean.slug}>
          <a href={`/bean/${bean.slug}`}>{resolveText(bean.name)}</a>
        </li>
      ))}
    </ul>
  );

  return (
    <article>
      <h1>Directory</h1>

      {plants.map((plant) => (
        <section key={plant.slug}>
          <h2>
            {resolveText(plant.name)} <small>({plant.natures.join(" · ")})</small>
          </h2>
          {data.beansForPlant(plant.slug).length > 0 && beanList(data.beansForPlant(plant.slug))}
          {data.podsForPlant(plant.slug).map((pod) => (
            <section key={pod.slug}>
              <h3>{resolveText(pod.name)}</h3>
              {beanList(data.beansForPod(pod.slug))}
            </section>
          ))}
        </section>
      ))}

      {(unrooted.length > 0 || standalone.length > 0) && (
        <section>
          <h2>Unrooted</h2>
          {unrooted.map((pod) => (
            <section key={pod.slug}>
              <h3>{resolveText(pod.name)}</h3>
              {beanList(data.beansForPod(pod.slug))}
            </section>
          ))}
          {standalone.length > 0 && beanList(standalone)}
        </section>
      )}
    </article>
  );
}
