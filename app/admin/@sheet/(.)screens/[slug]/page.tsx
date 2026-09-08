import ScreenPage from "@/app/admin/screens/[slug]/page";
import { SideSheet } from "@/app/admin/_components/side-sheet";

export const dynamic = "force-dynamic";

/**
 * A screen's page, in the side sheet.
 *
 * It renders THE SAME MODULE the standalone route does — imported, not
 * reimplemented — and that is the claim the whole design rests on: there is
 * nothing in this panel that is not a page, so a script-off click on a tile is
 * an ordinary navigation to the same editors. `lib/screen-sheet-source.test.ts`
 * pins the import, because reimplementing the body here would pass `tsc`,
 * `npm test` and `npm run build` while quietly making the library
 * script-dependent.
 *
 * ONE SUSPECTED CASE, UNVERIFIED IN A BROWSER and left for a real viewport:
 * reload the admin with the panel already open (a hard navigation, so the slot
 * and the page are rendered for the SAME slug), then press `→`. The `children`
 * underneath may not re-render with the panel, in which case the page beneath
 * still shows the previous screen and TWO `SheetKeys` are mounted at once —
 * one from the panel and one from the page under it — so a single arrow press
 * would fire two `router.push` calls. If that reproduces, the fix is that the
 * standalone page should not render its keys while a panel exists, not a
 * second binding here.
 */
export default async function ScreenSheet(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plant?: string; bean?: string; tag?: string; error?: string }>;
}) {
  const { slug } = await props.params;

  return (
    <SideSheet>
      <ActiveTile slug={slug} />
      <ScreenPage {...props} />
    </SideSheet>
  );
}

/**
 * Which tile is open, said in CSS by the panel.
 *
 * The index page cannot say it: interception is precisely what keeps it from
 * re-rendering while the panel navigates, so it never learns the slug. One
 * attribute-selector rule against the `data-screen-tile` every tile carries
 * does the whole job with no client code and no state to get stale.
 *
 * The slug is guarded rather than trusted even though it comes from a stored
 * document — a stored slug came from a FILENAME, and a quote in one would
 * escape the rule. A slug that fails the guard simply gets no ring.
 */
function ActiveTile({ slug }: { slug: string }) {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) return null;
  return (
    <style>{`[data-screen-tile="${slug}"] > div:first-child{outline:2px solid var(--color-ring);outline-offset:2px}`}</style>
  );
}
