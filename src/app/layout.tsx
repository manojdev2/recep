import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/components/theme";
import { siteMeta } from "@/server/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const site = siteMeta();
  return {
    title: site.title,
    description: site.description,
    icons: { icon: { url: site.favicon, type: "image/svg+xml" }, apple: "/icon-180.png" },
    manifest: "/api/pwa/manifest",
    robots: site.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: site.title,
      description: site.description,
      type: "website",
      images: site.ogImage ? [site.ogImage] : undefined,
    },
    twitter: { card: site.ogImage ? "summary_large_image" : "summary" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#181b2d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const site = siteMeta();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="bg-bg text-fg antialiased">
        <Providers>{children}</Providers>
        {site.plausibleDomain ? (
          <Script src="https://plausible.io/js/script.js" data-domain={site.plausibleDomain} strategy="afterInteractive" />
        ) : null}
        {site.gaId ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${site.gaId}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(site.gaId)});`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
