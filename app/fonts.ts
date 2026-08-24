import localFont from "next/font/local";

/**
 * Inclusive Sans (SIL OFL 1.1 — see `app/fonts/OFL.txt`), the default typeface
 * for every zone. Variable weight axis, upright + italic.
 */
export const inclusiveSans = localFont({
  src: [
    {
      path: "./fonts/InclusiveSans-VariableFont_wght.ttf",
      weight: "300 700",
      style: "normal",
    },
    {
      path: "./fonts/InclusiveSans-Italic-VariableFont_wght.ttf",
      weight: "300 700",
      style: "italic",
    },
  ],
  variable: "--font-inclusive-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

/**
 * Profane (v0.1, Regular) — the public zone's display face, licensed from
 * Flavia Zimbardi.
 *
 * NOT a `localFont`, and the .woff2 is deliberately absent from this repo
 * (`.gitignore` keeps it out). The licence permits serving the face from a site
 * we control, in WOFF2, through an `@font-face` rule (EULA §3.2, §3.3) — but
 * §7 also requires "all reasonable precautions to ensure the Fonts are not
 * accessible to unlicensed third parties or to the general public" and §7(b)
 * forbids distributing a copy. `alexisbohns/ariko` is a PUBLIC repo, so a
 * committed binary would be exactly that distribution, separate from serving
 * the site. It lives on our Cloudinary instead, and the `@font-face` that
 * points at it is hand-written in `app/globals.css`.
 *
 * Consequence worth knowing: none of next/font's build-time work applies here
 * — no self-hosted rewrite, and no synthesised fallback metrics, so the swap
 * from the mono fallback shifts the headings slightly. The preload link on the
 * one page that uses the face (`app/(public)/page.tsx`) is what keeps that
 * window short.
 *
 * Keep this in sync with the `src:` URL in `app/globals.css` — two literals,
 * one asset, by necessity: CSS cannot read a TS constant.
 */
export const PROFANE_WOFF2_URL =
  "https://res.cloudinary.com/t5gexxs5/raw/upload/v1787598622/ariko/fonts/profane-regular.woff2";
