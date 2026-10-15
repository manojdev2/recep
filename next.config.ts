import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["pg", "nodemailer", "ws"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/docs", destination: "/docs/index.html" },
      { source: "/docs/", destination: "/docs/index.html" },
    ];
  },
  async redirects() {
    return [
      { source: "/app/tools", destination: "/app/apps", permanent: false },
      { source: "/app/calls/:campaignId", destination: "/app/campaigns/:campaignId", permanent: false },
    ];
  },
};

export default nextConfig;
