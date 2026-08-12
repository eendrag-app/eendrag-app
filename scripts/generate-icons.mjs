// Regenerates the app icons in public/icons from the SVG below.
//
//   node scripts/generate-icons.mjs
//
// Run it when the res colours change or the mark does; commit the PNGs it
// writes. It rasterises with Playwright (already a dev dependency, so nothing
// new to install) rather than an image library, because the only thing being
// drawn is four gold rectangles on a maroon square and a browser draws those
// exactly the same way every time.
//
// Why PNGs at all: Android's install prompt wants 192 and 512, an adaptive
// icon wants a `maskable` one with its art inside the middle 80%, and iOS
// wants an apple-touch-icon. SVG covers none of those reliably.
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const MAROON = "#5c1220"; // --header in globals.css, light mode
const GOLD = "#d9a62c"; // --gold

/** The mark: a bold gold E on the res maroon. `scale` shrinks it for maskable icons. */
function svg(scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${MAROON}"/>
  <g fill="${GOLD}" transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <rect x="160" y="128" width="46" height="256"/>
    <rect x="160" y="128" width="192" height="46"/>
    <rect x="160" y="233" width="160" height="46"/>
    <rect x="160" y="338" width="192" height="46"/>
  </g>
</svg>`;
}

const ICONS = [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  // Maskable: Android crops to a circle/squircle, so the mark lives inside
  // the middle 80% and the maroon bleeds to the edges.
  { file: "icon-maskable-512.png", size: 512, scale: 0.62 },
  { file: "apple-touch-icon.png", size: 180, scale: 1 },
];

const browser = await chromium.launch();
for (const { file, size, scale } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0">${svg(scale).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`,
  );
  await page.screenshot({ path: path.join(OUT, file), omitBackground: false });
  await page.close();
  console.log(`wrote ${file} (${size}×${size})`);
}
await browser.close();
