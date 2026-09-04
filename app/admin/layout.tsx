import type { ReactNode } from "react";
import { AdminChrome } from "./_components/admin-chrome";

/**
 * The admin/tooling zone. It shares the design system with the public zone but
 * not its chrome: the floating rail and the top-right actions are rendered
 * here, once, and withdraw themselves on the login page.
 *
 * The padding clears the two fixed clusters — the rail on the left, the account
 * actions top-right — while keeping the centred max-width column.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminChrome />
      <main className="mx-auto max-w-5xl py-8 pl-20 pr-16">{children}</main>
    </>
  );
}
