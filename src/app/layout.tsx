import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panelly",
  description:
    "Compose photos and videos into a 1080×1920 story, right in your browser. Nothing is uploaded.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0d0d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        {/* Anonymous, cookieless page views and Core Web Vitals, served from this
            site's own domain. No file or its contents is ever sent (SPEC §10). */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
