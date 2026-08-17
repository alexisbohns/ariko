import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Botanical rename (slice 1 PR1): /atom/* was the only public renamed path;
  // shared links keep working. Admin paths get no redirects (private).
  redirects: async () => [
    { source: "/atom/:id", destination: "/bean/:id", permanent: true },
    // Slice 4: the timeline is the beanstalk — the cosmology reaches the URL.
    { source: "/timeline", destination: "/beanstalk", permanent: true },
  ],
};

export default nextConfig;
