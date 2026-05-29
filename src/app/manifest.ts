import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Walk Window",
    short_name: "Walk Window",
    description:
      "Find the best times to exercise outside or walk your dog based on weather and pavement estimates.",
    start_url: "/",
    display: "standalone",
    background_color: "#7dd3fc",
    theme_color: "#7dd3fc",
    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
