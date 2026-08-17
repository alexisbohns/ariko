import type { ReactNode } from "react";
import { inclusiveSans } from "./fonts";

export const metadata = {
  title: "Ariko",
  description: "An atomic portfolio of creative and professional work.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inclusiveSans.className}>
      <head>
        {/* Two-tone favicon: the dark-ink mark on light UI, the light-ink mark
            on dark UI. Browsers that ignore `media` fall back to the first. */}
        <link
          rel="icon"
          type="image/png"
          href="/icon-light.png"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          type="image/png"
          href="/icon-dark.png"
          media="(prefers-color-scheme: dark)"
        />
        <link rel="apple-touch-icon" href="/icon-light.png" />
      </head>
      <body>
        <header>
          <nav>
            <ul>
              <li>
                <a href="/">Directory</a>
              </li>
              <li>
                <a href="/beanstalk">Beanstalk</a>
              </li>
            </ul>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
