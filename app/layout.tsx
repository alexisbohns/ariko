import type { ReactNode } from "react";

export const metadata = {
  title: "Ariko",
  description: "An atomic portfolio of creative and professional work.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            <ul>
              <li>
                <a href="/">Directory</a>
              </li>
              <li>
                <a href="/timeline">Timeline</a>
              </li>
            </ul>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
