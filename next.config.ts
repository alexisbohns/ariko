import type { NextConfig } from "next";
import { MAX_UPLOAD_BYTES } from "./lib/upload-input";
import { EMBED_FRAME_HOSTS } from "./lib/embed-src";

const nextConfig: NextConfig = {
  // Botanical rename (slice 1 PR1): /atom/* was the only public renamed path;
  // shared links keep working. Admin paths get no redirects (private).
  redirects: async () => [
    { source: "/atom/:id", destination: "/bean/:id", permanent: true },
    // Slice 4: the timeline is the beanstalk — the cosmology reaches the URL.
    { source: "/timeline", destination: "/beanstalk", permanent: true },
  ],
  // Server actions default to a 1MB request body; uploadImageAction carries an
  // image. This is deliberately ABOVE lib/upload-input.ts's MAX_UPLOAD_BYTES
  // rather than equal to it: bodySizeLimit bounds the WHOLE multipart body
  // (boundaries, Content-Disposition headers, field framing), so a file of
  // exactly MAX_UPLOAD_BYTES yields a body slightly larger than that. Equal
  // limits would let the platform reject — with an opaque 413, before the
  // action runs — a file checkUploadFile explicitly accepts, which is the very
  // failure that guard exists to prevent. The headroom keeps the app-level
  // guard the binding constraint. Still well under Vercel's own 4.5MB ceiling,
  // which applies to a route handler and a server action alike.
  experimental: {
    serverActions: { bodySizeLimit: MAX_UPLOAD_BYTES + 64 * 1024 },
  },
  // The repo's first CSP, and deliberately ONE directive.
  //
  // A policy containing only `frame-src` constrains frames and nothing else —
  // there is no `default-src`, so scripts, styles and fonts are untouched and
  // no nonces are needed. That is what makes it safe to add in the same slice
  // as the feature it guards, instead of as its own project.
  //
  // Built from EMBED_FRAME_HOSTS (lib/embed-src.ts) rather than a hand-copied
  // list, so the allowlist and the URL table it mirrors cannot drift.
  // lib/embed-src.test.ts asserts the correspondence in both directions, and
  // fails loudly if a provider is added without an allowlist entry.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          // object-src too: frame-src governs <iframe>, but <object> and
          // <embed> are a SEPARATE directive, so restricting only frames
          // leaves the policy short of the thing it exists to do. Nothing in
          // the repo uses either element, so 'none' costs nothing today and
          // closes the gap before someone finds it.
          value: `frame-src 'self' ${EMBED_FRAME_HOSTS.join(" ")}; object-src 'none';`,
        },
      ],
    },
  ],
};

export default nextConfig;
