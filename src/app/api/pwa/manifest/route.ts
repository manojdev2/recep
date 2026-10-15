import { branding } from "@/server/settings";

export function GET() {
  const { name } = branding();
  return Response.json(
    {
      name,
      short_name: name,
      start_url: "/app",
      display: "standalone",
      background_color: "#181b2d",
      theme_color: "#181b2d",
      icons: [
        { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
        { src: "/icon-180.png", sizes: "180x180", type: "image/png" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
