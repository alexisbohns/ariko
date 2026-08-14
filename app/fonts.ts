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
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
