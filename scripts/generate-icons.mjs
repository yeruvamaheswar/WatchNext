import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcSrc = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSrc));
  return Buffer.concat([len, t, data, crc]);
}

/** Dark purple field with a luminous orb. `orbScale` ~0.34 any, ~0.22 maskable safe-zone. */
function png(width, height = width, { orbScale = 0.34 } = {}) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const minSide = Math.min(width, height);
  const rOrb = minSide * orbScale;
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 4;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const glow = Math.max(0, 1 - d / (minSide * 0.55));
      let r = 12 + 40 * glow;
      let g = 6 + 18 * glow;
      let b = 20 + 70 * glow;
      if (d < rOrb) {
        const nx = (x - cx) / rOrb;
        const ny = (y - cy) / rOrb;
        const highlight = Math.max(0, 1 - Math.hypot(nx + 0.35, ny + 0.4));
        r = 109 + 110 * highlight;
        g = 40 + 140 * highlight;
        b = 217 + 20 * highlight;
      }
      raw[i] = Math.min(255, r);
      raw[i + 1] = Math.min(255, g);
      raw[i + 2] = Math.min(255, b);
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((img) => img.data)]);
}

const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="WatchNext">
  <rect width="512" height="512" fill="#0c0614"/>
  <defs>
    <radialGradient id="orb" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="#f3e8ff"/>
      <stop offset="42%" stop-color="#c084fc"/>
      <stop offset="78%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="174" fill="url(#orb)"/>
</svg>
`;

const maskSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <circle cx="8" cy="8" r="5.5" fill="#000"/>
</svg>
`;

const browserConfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/icons/icon-144.png"/>
      <square310x310logo src="/icons/icon-512.png"/>
      <TileColor>#6d28d9</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const icons = join(root, "public", "icons");
const splash = join(root, "public", "splash");
const appDir = join(root, "app");
mkdirSync(icons, { recursive: true });
mkdirSync(splash, { recursive: true });

const anySizes = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512];
for (const size of anySizes) {
  writeFileSync(join(icons, `icon-${size}.png`), png(size));
}
writeFileSync(join(icons, "icon-192-maskable.png"), png(192, 192, { orbScale: 0.22 }));
writeFileSync(join(icons, "icon-512-maskable.png"), png(512, 512, { orbScale: 0.22 }));
writeFileSync(join(icons, "favicon-16x16.png"), png(16));
writeFileSync(join(icons, "favicon-32x32.png"), png(32));
writeFileSync(join(icons, "apple-touch-icon-120.png"), png(120));
writeFileSync(join(icons, "apple-touch-icon-152.png"), png(152));
writeFileSync(join(icons, "apple-touch-icon-167.png"), png(167));
writeFileSync(join(icons, "apple-touch-icon-180.png"), png(180));

const favicon = ico([
  { size: 16, data: png(16) },
  { size: 32, data: png(32) },
  { size: 48, data: png(48) },
]);
writeFileSync(join(appDir, "favicon.ico"), favicon);
writeFileSync(join(root, "public", "favicon.ico"), favicon);
writeFileSync(join(appDir, "icon.png"), png(32));
writeFileSync(join(appDir, "apple-icon.png"), png(180));
writeFileSync(join(appDir, "icon.svg"), iconSvg);
writeFileSync(join(appDir, "opengraph-image.png"), png(1200, 630));
writeFileSync(join(appDir, "twitter-image.png"), png(1200, 630));
writeFileSync(join(root, "public", "apple-touch-icon.png"), png(180));
writeFileSync(join(root, "public", "apple-touch-icon-precomposed.png"), png(180));
writeFileSync(join(root, "public", "safari-pinned-tab.svg"), maskSvg);
writeFileSync(join(root, "public", "browserconfig.xml"), browserConfig);

const appleSplash = [
  { w: 640, h: 1136 },
  { w: 750, h: 1334 },
  { w: 828, h: 1792 },
  { w: 1080, h: 2340 },
  { w: 1125, h: 2436 },
  { w: 1170, h: 2532 },
  { w: 1179, h: 2556 },
  { w: 1206, h: 2622 },
  { w: 1242, h: 2208 },
  { w: 1242, h: 2688 },
  { w: 1284, h: 2778 },
  { w: 1290, h: 2796 },
  { w: 1320, h: 2868 },
  { w: 1536, h: 2048 },
  { w: 1668, h: 2388 },
  { w: 2048, h: 2732 },
];
for (const { w, h } of appleSplash) {
  writeFileSync(join(splash, `apple-splash-${w}x${h}.png`), png(w, h, { orbScale: 0.16 }));
}

console.log("Wrote PWA icons, Apple splash, favicon, and social images.");
