import type { NextConfig } from "next";
import { MAX_UPLOAD_BYTES } from "./lib/upload-input";

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
};

export default nextConfig;
