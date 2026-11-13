import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgsSwap",
    short_name: "AgsSwap",
    description:
      "Texas-first marketplace for farm & ranch gear, hay, fencing, implements and livestock. Swap first; sell when it helps.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6e9",
    theme_color: "#4f7a2a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
