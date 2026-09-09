import ScreenPage from "@/app/admin/screens/[slug]/page";
import { activeTileCss } from "@/lib/screens";

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

  // No <SideSheet> here: the panel is the segment's LAYOUT, so that walking
  // the library with the arrows swaps this content inside a frame that never
  // unmounts. See `../layout.tsx`.
  return (
    <>
      <ActiveTile slug={slug} />
      <ScreenPage {...props} />
    </>
  );
}

/**
 * Which tile is open, said in CSS by the panel.
 *
 * The rule itself — and the guard on the slug that goes into it — is
 * `activeTileCss` in lib/screens.ts, which is where the rest of the library's
 * arithmetic lives and where a test can reach it. This is the render, and
 * nothing else.
 */
function ActiveTile({ slug }: { slug: string }) {
  const css = activeTileCss(slug);
  return css ? <style>{css}</style> : null;
}
