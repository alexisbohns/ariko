import PodPage from "@/app/admin/(chrome)/pod/[slug]/page";

export const dynamic = "force-dynamic";

/** A pod, in the map's sheet: the page's own module, imported. */
export default function PodInMapSheet(props: Parameters<typeof PodPage>[0]) {
  return <PodPage {...props} />;
}
