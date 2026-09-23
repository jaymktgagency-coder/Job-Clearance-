import type { NextConfig } from "next";

// AVIF first, WebP fallback: the photos are the heaviest thing on the page,
// and most visitors are on phones.
const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  poweredByHeader: false,
};

export default nextConfig;
