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

function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}

function roundedRectD(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = Math.abs(px - cx) - (w / 2 - r);
  const dy = Math.abs(py - cy) - (h / 2 - r);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-8) return false;
  const u = (dot11 * dot02 - dot01 * dot12) / denom;
  const v = (dot00 * dot12 - dot01 * dot02) / denom;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function cover(d) {
  return clamp(0.6 - d);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

/** Dark field + stacked poster cards + play skip. `markScale` ~0.62 any, ~0.42 maskable. */
function png(width, height = width, { markScale = 0.62 } = {}) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const minSide = Math.min(width, height);
  const mark = minSide * markScale;
  const ox = (width - mark) / 2;
  const oy = (height - mark) / 2;
  const s = mark / 40;
  const back = { x: 15.6, y: 6, w: 20, h: 22.8, r: 6.4 };
  const front = { x: 4.4, y: 11.2, w: 20, h: 22.8, r: 6.4 };

  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 4;
      const dx = x - width / 2;
      const dy = y - height / 2;
      const glow = Math.max(0, 1 - Math.hypot(dx, dy) / (minSide * 0.58));
      let r = 12 + 38 * glow;
      let g = 6 + 16 * glow;
      let b = 20 + 68 * glow;

      const mx = (x - ox) / s;
      const my = (y - oy) / s;
      const aa = Math.max(0.08, 0.85 / s);
      const dBack = roundedRectD(mx, my, back.x, back.y, back.w, back.h, back.r);
      const dFront = roundedRectD(mx, my, front.x, front.y, front.w, front.h, front.r);
      const aBack = cover(dBack / aa);
      const aFront = cover(dFront / aa);
      const aPlay = inTriangle(mx, my, 10, 19.15, 10, 26.85, 16.48, 23)
        ? 1
        : 0;

      if (aBack > 0) {
        r = mix(r, 76, aBack);
        g = mix(g, 29, aBack);
        b = mix(b, 149, aBack);
      }
      if (aFront > 0) {
        const nx = (mx - front.x) / front.w;
        const ny = (my - front.y) / front.h;
        const highlight = Math.max(0, 1 - Math.hypot(nx - 0.3, ny - 0.22) * 1.65);
        r = mix(r, 109 + 78 * highlight, aFront);
        g = mix(g, 40 + 96 * highlight, aFront);
        b = mix(b, 217 + 18 * highlight, aFront);
      }
      if (aPlay > 0 && aFront > 0.35) {
        r = mix(r, 243, aPlay);
        g = mix(g, 232, aPlay);
        b = mix(b, 255, aPlay);
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
  <g transform="translate(56 56) scale(10)">
    <rect x="15.6" y="6" width="20" height="22.8" rx="6.4" fill="#4c1d95"/>
    <rect x="15.6" y="6" width="20" height="22.8" rx="6.4" stroke="#a78bfa" stroke-opacity="0.4" stroke-width="0.75"/>
    <rect x="4.4" y="11.2" width="20" height="22.8" rx="6.4" fill="#6d28d9"/>
    <ellipse cx="10.4" cy="16.4" rx="6.8" ry="5.2" fill="#c084fc" fill-opacity="0.42"/>
    <path d="M11.2 19.15c-.52-.32-1.2.05-1.2.66v6.38c0 .61.68.98 1.2.66l5.28-3.19c.48-.29.48-1.03 0-1.32l-5.28-3.19Z" fill="#f3e8ff"/>
  </g>
</svg>
`;

const maskSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <rect x="6.2" y="2.2" width="8" height="9.2" rx="2.2" fill="#000"/>
  <rect x="1.8" y="4.4" width="8" height="9.2" rx="2.2" fill="#000"/>
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
writeFileSync(join(icons, "icon-192-maskable.png"), png(192, 192, { markScale: 0.42 }));
writeFileSync(join(icons, "icon-512-maskable.png"), png(512, 512, { markScale: 0.42 }));
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
  writeFileSync(join(splash, `apple-splash-${w}x${h}.png`), png(w, h, { markScale: 0.22 }));
}

console.log("Wrote PWA icons, Apple splash, favicon, and social images.");
