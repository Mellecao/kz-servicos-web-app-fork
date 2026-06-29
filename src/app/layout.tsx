import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Painel ADM",
  description: "Painel administrativo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>

      <body className="min-h-full flex flex-col font-body" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
      <Script id="onesignal-deferred-bootstrap" strategy="beforeInteractive">
        {`window.OneSignalDeferred = window.OneSignalDeferred || [];`}
      </Script>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
    </html>
  );
}
