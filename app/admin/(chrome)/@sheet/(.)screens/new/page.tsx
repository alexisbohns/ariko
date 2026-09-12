import NewScreenPage from "@/app/admin/(chrome)/screens/new/page";

export const dynamic = "force-dynamic";

/** The create page, in the side sheet. The same module the standalone route
 *  renders — see the sibling slot for why that is not a convenience. The panel
 *  itself is the segment's layout, so this is content and nothing else. */
export default async function NewScreenSheet(props: {
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
}) {
  return <NewScreenPage {...props} />;
}
