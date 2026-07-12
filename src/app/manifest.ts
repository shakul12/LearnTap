import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LearnTap",
    short_name: "LearnTap",
    description:
      "Live 1-on-1 tutoring, on demand. Post what you're stuck on and a real teacher joins you in minutes.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfcfa",
    theme_color: "#1e1e2f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
