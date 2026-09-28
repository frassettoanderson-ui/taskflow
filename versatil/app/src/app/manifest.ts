import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Versátil — Melhor preço da região",
    short_name: "Versátil",
    start_url: "/",
    display: "standalone",
    background_color: "#EDEDED",
    theme_color: "#F0CD67",
    icons: [
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
