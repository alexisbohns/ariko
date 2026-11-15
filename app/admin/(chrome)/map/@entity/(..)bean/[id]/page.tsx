import BeanPage from "@/app/admin/(chrome)/bean/[id]/page";

export const dynamic = "force-dynamic";

/** A bean, in the map's sheet: the page's own module, imported. */
export default function BeanInMapSheet(props: Parameters<typeof BeanPage>[0]) {
  return <BeanPage {...props} />;
}
