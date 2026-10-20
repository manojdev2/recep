import type { NextConfig } from "next";

// Frontend-only deploy (e.g. Vercel): API_ORIGIN is the backend that runs server.mjs (e.g. Render).
// Every /api request is proxied there, so the browser stays on one origin and cookies keep working.
const apiOrigin = (process.env.API_ORIGIN ?? "").trim().replace(/\/$/, "");

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
    return {
      beforeFiles: apiOrigin ? [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }] : [],
      afterFiles: [
        { source: "/docs", destination: "/docs/index.html" },
        { source: "/docs/", destination: "/docs/index.html" },
      ],
      fallback: [],
    };
  },
  async redirects() {
    return [
      { source: "/app/tools", destination: "/app/apps", permanent: false },
      { source: "/app/calls/:campaignId", destination: "/app/campaigns/:campaignId", permanent: false },
    ];
  },
};

export default nextConfig;
