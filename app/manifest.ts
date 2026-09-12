import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/lib/site";

/**
 * `/manifest.webmanifest`, and the whole installability bar: Chrome and Edge
 * dropped the service-worker requirement, so an HTTPS origin with this file is
 * installable. `public/sw.js` buys the offline page, not the install.
 *
 * ONE app, scope "/", rather than one manifest per zone. Two manifests would
 * give the author a real studio window — and put a browser boundary across the
 * path from writing a sprout to reading it, which is the commonest path there
 * is through this app.
 *
 * The icons live in `public/icons/`, not under `app/`: Next's `app/icon.*`
 * convention emits a hashed URL, which is right for a <link> Next writes itself
 * and wrong for a JSON file naming a path.
 *
 * `maskable` is a SEPARATE entry, not a purpose added to the 512. A maskable
 * icon is padded artwork; the same file used as `any` renders as a small mark
 * adrift in whitespace.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
