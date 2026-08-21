import type { ReactNode } from "react";

/**
 * The admin/tooling zone. It shares the design system with the public zone
 * but not its chrome: pages render their own `<AdminBar />` (the login page
 * deliberately doesn't).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>;
}
