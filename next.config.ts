import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  // Allow images from MongoDB base64 + external sources
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // For Electron: export as standalone
  output: process.env.ELECTRON_BUILD === '1' ? 'standalone' : undefined,
};

export default nextConfig;
