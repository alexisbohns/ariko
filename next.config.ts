import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Botanical rename (slice 1 PR1): /atom/* was the only public renamed path;
  // shared links keep working. Admin paths get no redirects (private).
  redirects: async () => [
    { source: "/atom/:id", destination: "/bean/:id", permanent: true },
    // Slice 4: the timeline is the beanstalk — the cosmology reaches the URL.
    { source: "/timeline", destination: "/beanstalk", permanent: true },
  ],
  // Server actions default to a 1MB request body; uploadImageAction carries an
  // image. Kept in step with lib/upload-input.ts's MAX_UPLOAD_BYTES, and
  // bounded by Vercel's own 4.5MB platform ceiling, which applies to a route
  // handler and a server action alike.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
