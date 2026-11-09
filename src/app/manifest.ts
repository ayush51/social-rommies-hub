import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Abingdon Bros",
    short_name: "Abingdon",
    description: "Our private living room.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#7c3aed",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
