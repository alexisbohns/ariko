import {
  resolveSproutPlant,
  resolveSproutPlants,
  resolveText,
  parentsWithPrefix,
  PLANT_PREFIX,
  POD_PREFIX,
  type Sprout,
  type SproutGarden,
} from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { setSproutAboutAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ChoiceLabel, NativeCheckbox } from "@/components/ui/native-controls";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Where a sprout hangs, as a panel on the sprout page's rail (spec 2026-10-10
 * §3, admin). Server-rendered and handed to `EntityRail` as a ReactNode, per
 * the rail rule — the island learns no field name from it. A server component
 * like `sprout-meta-form.tsx`: no `"use client"`, native controls, a real
 * `<form action>`.
 *
 * The derived plant is SHOWN, not edited: the panel lists that plant's pods
 * (each with its beans) and its direct beans as checkboxes, posts the plant as
 * a hidden statement of where the sprout currently is, and
 * `setSproutAboutAction` refuses anything that would roll up elsewhere. Moving
 * a sprout between plants is not a feature of this slice. Nothing checked files
 * the entry under the plant itself. A sprout whose plant cannot be derived —
 * refs that dangle, or that roll up to two plants — gets the explanation and no
 * form: there is no honest list to offer it.
 *
 * A ref is offered ONCE. A bean under two of the plant's pods would otherwise
 * draw two checkboxes for one fact, and two boxes can disagree about it.
 *
 * `lib/sprout-about-form.test.ts` pins the offer; `lib/entity-rail-source.test.ts`
 * pins that this stays a server component.
 */
export function SproutAboutForm({
  sprout,
  garden,
  lang,
  error,
}: {
  sprout: Pick<Sprout, "slug" | "about" | "parents">;
  garden: SproutGarden;
  lang: Lang;
  error?: string;
}) {
  const plant = resolveSproutPlant(sprout, garden);
  if (!plant) {
    const plants = resolveSproutPlants(sprout, garden).map((p) => p.slug);
    return (
      <p className="text-sm text-muted-foreground">
        {plants.length === 0
          ? "This sprout's refs resolve to no plant. Root its pod or bean under a plant, or re-anchor it from a seed."
          : `This sprout's refs roll up to ${plants.length} plants (${plants.join(", ")}). It belongs to one — remove the refs under the other.`}
      </p>
    );
  }

  const checked = new Set(sprout.about ?? []);
  const pods = (garden.pods ?? []).filter((p) =>
    parentsWithPrefix(p.parents, PLANT_PREFIX).includes(plant.slug),
  );
  const beansOfPod = (podSlug: string) =>
    (garden.beans ?? []).filter((b) => parentsWithPrefix(b.parents, POD_PREFIX).includes(podSlug));
  const directBeans = (garden.beans ?? []).filter((b) =>
    parentsWithPrefix(b.parents, PLANT_PREFIX).includes(plant.slug),
  );

  const seen = new Set<string>();
  const box = (ref: string, label: string, indent = false) => {
    if (seen.has(ref)) return null;
    seen.add(ref);
    return (
      <ChoiceLabel key={ref} className={indent ? "ml-6" : undefined}>
        <NativeCheckbox name="about" value={ref} defaultChecked={checked.has(ref)} /> {label}
      </ChoiceLabel>
    );
  };

  return (
    <form action={setSproutAboutAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={sprout.slug} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="plant" value={plant.slug} />
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-sm">
        <span className="text-muted-foreground">Plant </span>
        {resolveText(plant.name, lang)}
      </p>
      <div className="flex flex-col gap-2">
        {pods.map((pod) => [
          box(`pod:${pod.slug}`, resolveText(pod.name, lang)),
          ...beansOfPod(pod.slug).map((b) => box(`bean:${b.slug}`, resolveText(b.name, lang), true)),
        ])}
        {directBeans.map((b) => box(`bean:${b.slug}`, resolveText(b.name, lang)))}
      </div>
      <p className="text-xs leading-snug text-muted-foreground">
        What this entry is about. Nothing checked files it under the plant itself.
      </p>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}
