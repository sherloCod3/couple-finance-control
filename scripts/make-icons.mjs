/**
 * Rasterises `public/icons/icon.svg` into the PNG sizes the PWA needs.
 *
 * Why hand-rolled instead of sharp / resvg: this project ships no runtime or
 * build dependency it does not need, and the artwork is four concentric circles
 * on a solid background. A ~120-line analytic rasteriser plus Node's built-in
 * zlib produces byte-identical output on every machine and on every platform,
 * with nothing to install and no network access.
 *
 * Run:  node scripts/make-icons.mjs
 *
 * Outputs (public/icons/):
 *   icon-192.png        192x192  purpose "any"
 *   icon-512.png        512x512  purpose "any"
 *   maskable-512.png    512x512  purpose "maskable" (art inside the safe zone)
 *   apple-touch-icon.png 180x180 iOS home-screen icon
 *
 * Keep this file in sync with public/icons/icon.svg if the artwork changes.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "icons");

/** The SVG's coordinate space. */
const VIEW = 512;

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

// --- artwork, mirroring public/icons/icon.svg ------------------------------
// Each layer is a stroked circle: an annulus of width `w` centred on radius `r`.
const BACKGROUND = rgb("#0A2115");

const LAYERS = [
  { cx: 256, cy: 256, r: 196, w: 3, color: rgb("#175734"), alpha: 0.35 },
  { cx: 256, cy: 256, r: 228, w: 3, color: rgb("#175734"), alpha: 0.18 },
  { cx: 204, cy: 256, r: 104, w: 36, color: rgb("#C99B3F"), alpha: 1 },
  { cx: 308, cy: 256, r: 104, w: 36, color: rgb("#8FBA9B"), alpha: 1 },
];

/** Source-over composite of every layer at one point, in viewBox coordinates. */
function sample(x, y) {
  let [r, g, b] = BACKGROUND;
  for (const layer of LAYERS) {
    const d = Math.hypot(x - layer.cx, y - layer.cy);
    if (d < layer.r - layer.w / 2 || d > layer.r + layer.w / 2) continue;
    const a = layer.alpha;
    r = r * (1 - a) + layer.color[0] * a;
    g = g * (1 - a) + layer.color[1] * a;
    b = b * (1 - a) + layer.color[2] * a;
  }
  return [r, g, b];
}

/**
 * Renders an RGBA buffer at `size`, with the artwork scaled by `artScale`
 * about the centre. `artScale < 1` pulls the rings inward, which is what the
 * maskable and iOS variants need so a platform mask cannot clip them.
 */
function render(size, artScale) {
  const SS = 4; // 4x4 supersampling per pixel → smooth circle edges
  const out = Buffer.alloc(size * size * 4);
  const step = VIEW / size;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (px + (sx + 0.5) / SS) * step;
          const fy = (py + (sy + 0.5) / SS) * step;
          const [r, g, b] = sample(VIEW / 2 + (fx - VIEW / 2) / artScale, VIEW / 2 + (fy - VIEW / 2) / artScale);
          sr += r;
          sg += g;
          sb += b;
        }
      }
      const n = SS * SS;
      const o = (py * size + px) * 4;
      out[o] = Math.round(sr / n);
      out[o + 1] = Math.round(sg / n);
      out[o + 2] = Math.round(sb / n);
      out[o + 3] = 255; // opaque: iOS and Android both want a solid icon
    }
  }
  return out;
}

// --- minimal PNG encoder ---------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgba, size) {
  const stride = size * 4;
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour + alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- outputs ---------------------------------------------------------------
// Maskable icons are cropped to a circle of radius 40% of the icon, and the
// outermost ring sits at 44.5%, so it has to come in. iOS rounds its corners
// aggressively too, so the touch icon gets a little breathing room.
const TARGETS = [
  { file: "icon-192.png", size: 192, artScale: 1 },
  { file: "icon-512.png", size: 512, artScale: 1 },
  { file: "maskable-512.png", size: 512, artScale: 0.8 },
  { file: "apple-touch-icon.png", size: 180, artScale: 0.86 },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const { file, size, artScale } of TARGETS) {
  const png = encodePNG(render(size, artScale), size);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file.padEnd(22)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}
