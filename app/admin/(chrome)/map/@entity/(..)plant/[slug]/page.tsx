import PlantPage from "@/app/admin/(chrome)/plant/[slug]/page";

export const dynamic = "force-dynamic";

/** A plant's hub, in the map's sheet: the page's own module, imported. */
export default function PlantInMapSheet(props: Parameters<typeof PlantPage>[0]) {
  return <PlantPage {...props} />;
}
