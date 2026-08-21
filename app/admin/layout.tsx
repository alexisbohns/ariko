import type { ReactNode } from "react";

/**
 * The admin zone opts OUT of the design system: it stays bare-functional HTML
 * (see CLAUDE.md) until an artistic direction is set. `.admin-zone` reverts
 * Tailwind's global preflight back to user-agent styles — see
 * `app/globals.css`.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-zone">{children}</div>;
}
