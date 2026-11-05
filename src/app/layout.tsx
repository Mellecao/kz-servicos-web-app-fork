import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.adminTitle}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.tagline,
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.colors.primary,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-AO" className="h-full antialiased" suppressHydrationWarning>

      <body className="min-h-full flex flex-col font-body" suppressHydrationWarning>
        <Script id="onesignal-deferred-bootstrap" strategy="beforeInteractive">
          {`window.OneSignalDeferred = window.OneSignalDeferred || [];`}
        </Script>
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="afterInteractive"
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
