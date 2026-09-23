import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/keyring"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
