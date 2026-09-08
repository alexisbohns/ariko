import type { ReactNode } from "react";
import { AdminChrome, AdminMain } from "./_components/admin-chrome";

/**
 * The admin/tooling zone. It shares the design system with the public zone but
 * not its chrome: the floating rail and the top-right actions are rendered
 * here, once, and withdraw themselves on the login page.
 *
 * The column's padding clears those two fixed clusters — the rail on the left,
 * the account actions top-right — while keeping the centred max-width column.
 * It lives in AdminMain rather than here because it is route-dependent (the
 * login page has no chrome to clear) and a server component cannot read the
 * pathname.
 *
 * THE `sheet` SLOT is the screen library's side panel (a parallel route filled
 * by `@sheet/(.)screens/…`, and `@sheet/default.tsx` — null — everywhere else).
 * The page slides left when one is open, and the whole of that is the CSS
 * below: `:has(~ [data-screen-sheet])` asks whether a panel exists beside this
 * wrapper, which needs no open flag, no client state and no knowledge of the
 * route. It is the idiom `plant-inside.tsx` already uses to hold its plate open
 * under a portaled popover.
 *
 * `transition-transform` and nothing else, for that file's reason: a transform
 * does not re-flow the document, so the contact sheet keeps its columns and its
 * scroll position while the panel arrives. Below `lg` the panel covers instead
 * — sliding a narrow column that far would only push it under the chrome's own
 * rail.
 */
export default function AdminLayout({
  children,
  sheet,
}: {
  children: ReactNode;
  sheet: ReactNode;
}) {
  return (
    <>
      <AdminChrome />
      <div className="transition-transform duration-200 ease-out lg:[&:has(~[data-screen-sheet])]:-translate-x-56">
        <AdminMain>{children}</AdminMain>
      </div>
      {sheet}
    </>
  );
}
