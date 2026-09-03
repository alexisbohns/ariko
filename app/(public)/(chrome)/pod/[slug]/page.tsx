import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/store";
import { resolveEntity } from "@/lib/entity-resolve";
import { Prose } from "@/components/markdown";

export const dynamic = "force-dynamic";

export default async function PodPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await currentLang();
  const data = await getPublicDataset();
  const pod = data.getPod(slug);
  // A private container 404s rather than existing as an empty public shell.
  if (!pod) notFound();

  const beans = data.beansForPod(slug);

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">{resolveText(pod.name, lang)}</h1>
        {resolveText(pod.description ?? "", lang).trim() ? (
          <p className="text-base text-muted-foreground">{resolveText(pod.description, lang)}</p>
        ) : null}
      </header>

      <Prose
          lang={lang}
          content={pod.content}
          resolve={(ref) => resolveEntity(data, ref, lang)} />

      {/* Mechanical index — an aggregation with no argument to make (spec §5). */}
      {beans.length > 0 ? (
        <nav className="flex flex-col gap-2">
          <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
            Inside
          </h2>
          <ul className="flex flex-col gap-1">
            {beans.map((bean) => (
              <li key={bean.slug}>
                <a
                  href={`/bean/${bean.slug}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {resolveText(bean.name, lang)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
