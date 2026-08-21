import type { ReactNode } from "react";

/** The public exhibition zone: site header + a reading-width column. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-4">
          <a href="/" className="font-heading text-sm font-medium tracking-tight">
            ariko
          </a>
          <ul className="flex items-center gap-4 text-sm text-muted-foreground">
            <li>
              <a href="/" className="transition-colors hover:text-foreground">
                Directory
              </a>
            </li>
            <li>
              <a href="/beanstalk" className="transition-colors hover:text-foreground">
                Beanstalk
              </a>
            </li>
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </>
  );
}
