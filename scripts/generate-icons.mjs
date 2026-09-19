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

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const rOrb = size * 0.34;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const glow = Math.max(0, 1 - d / (size * 0.55));
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
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const icons = join(root, "public", "icons");
mkdirSync(icons, { recursive: true });
writeFileSync(join(icons, "icon-192.png"), png(192));
writeFileSync(join(icons, "icon-512.png"), png(512));
writeFileSync(join(root, "public", "apple-touch-icon.png"), png(180));
writeFileSync(join(root, "app", "icon.png"), png(192));
console.log("Wrote PWA icons.");
