import { PROFANE_WOFF2_URL } from "@/app/fonts";

/**
 * The preload for the display face, extracted the moment it gained a second
 * wearer (the public plant page).
 *
 * Profane is NOT bundled — it is served from our Cloudinary (app/fonts.ts
 * records the licence reasoning), so next/font does no build-time work for it
 * and nothing preloads it for us. React hoists this <link> into <head>.
 *
 * `crossOrigin` is required, not decorative: a font fetch is always an
 * anonymous CORS request, and without it the browser downloads the file twice.
 *
 * The rule it preserves: ONLY pages that wear the face ask for it. Two callers
 * today — the landing and the plant page. Do not move this into a layout.
 */
export function ProfanePreload() {
  return (
    <link
      rel="preload"
      href={PROFANE_WOFF2_URL}
      as="font"
      type="font/woff2"
      crossOrigin="anonymous"
    />
  );
}
