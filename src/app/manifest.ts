import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.adminTitle}`,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: BRAND.colors.primary,
    lang: "pt-AO",
    icons: [
      { src: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
