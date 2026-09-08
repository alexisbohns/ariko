import NewScreenPage from "@/app/admin/screens/new/page";
import { SideSheet } from "@/app/admin/_components/side-sheet";

export const dynamic = "force-dynamic";

/** The create page, in the side sheet. The same module the standalone route
 *  renders — see the sibling slot for why that is not a convenience. */
export default async function NewScreenSheet(props: {
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
}) {
  return (
    <SideSheet>
      <NewScreenPage {...props} />
    </SideSheet>
  );
}
