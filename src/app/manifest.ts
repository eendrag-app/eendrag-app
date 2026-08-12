import type { MetadataRoute } from "next";

// What makes "Get app" possible: the browser reads this to decide the app can
// be installed, and what it looks like on the home screen once it is.
//
// The icons come from scripts/generate-icons.mjs — regenerate and commit them
// if the res colours or the mark change.
//
// `display: "standalone"` is the point of the whole exercise: installed, the
// app opens without browser chrome, and on an iPhone that is also the ONLY
// place web push is allowed to work (docs/OPERATIONS.md → Notifications).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eendrag",
    short_name: "Eendrag",
    description: "The official app of Eendrag residence, Stellenbosch",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f0e6", // the cream page, so the splash is not white
    theme_color: "#5c1220", // the maroon bar
    lang: "en-ZA",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Calendar", url: "/calendar" },
      { name: "Intersection", url: "/intersection" },
    ],
  };
}
