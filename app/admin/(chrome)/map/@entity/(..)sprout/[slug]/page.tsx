import SproutPage from "@/app/admin/(chrome)/sprout/[slug]/page";

export const dynamic = "force-dynamic";

/** A sprout, in the map's sheet: the page's own module, imported. */
export default function SproutInMapSheet(props: Parameters<typeof SproutPage>[0]) {
  return <SproutPage {...props} />;
}
