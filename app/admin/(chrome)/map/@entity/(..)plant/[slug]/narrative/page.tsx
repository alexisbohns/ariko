import PlantNarrativePage from "@/app/admin/(chrome)/plant/[slug]/narrative/page";

export const dynamic = "force-dynamic";

/** A plant's narrative editor, in the map's sheet: the page's own module, imported. */
export default function PlantNarrativeInMapSheet(props: Parameters<typeof PlantNarrativePage>[0]) {
  return <PlantNarrativePage {...props} />;
}
