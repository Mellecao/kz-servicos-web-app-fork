import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.adminTitle}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.tagline,
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
