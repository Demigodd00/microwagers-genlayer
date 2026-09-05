import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MicroWagers by demigodd00",
    short_name: "MicroWagers",
    description: "Source-bound peer predictions on GenLayer StudioNet.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0912",
    theme_color: "#0b0912",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
