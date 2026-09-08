import Link from "next/link";
import { SideSheet } from "@/app/admin/_components/side-sheet";

/**
 * A screen that is no longer there, said inside the panel.
 *
 * The page module calls `notFound()` for an unknown slug, and without a
 * boundary HERE that would surface the admin's not-found and replace the whole
 * page — grid included. But the way this is reached is a stale tile clicked
 * while the contact sheet is up (a screen deleted in another tab, a bookmarked
 * slug), and losing the grid to say so is the wrong trade. The boundary keeps
 * the loss the size of the panel.
 *
 * It is the shell plus one sentence: there is nothing to edit, so there is no
 * form, and the only way out is back to the library.
 */
export default function ScreenSheetNotFound() {
  return (
    <SideSheet>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          That screen is gone.
        </p>
        <Link
          href="/admin/screens"
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          ← library
        </Link>
      </div>
    </SideSheet>
  );
}
