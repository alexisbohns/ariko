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
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminChrome />
      <AdminMain>{children}</AdminMain>
    </>
  );
}
