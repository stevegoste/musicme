// Génère les icônes MusicME (note blanche sur dégradé violet→indigo).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- Encodeur PNG ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filtre none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- Géométrie de la note (croche) en coordonnées 0..1 ----------
function inTri(px, py, a, b, c) {
  const s = (a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0]);
  const t = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  const u = (c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0]);
  return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0);
}
function noteCoverage(x, y) {
  // Tête de note (ellipse inclinée)
  const hx = 0.4, hy = 0.66, hrx = 0.155, hry = 0.125;
  const ang = -20 * Math.PI / 180;
  const dx = x - hx, dy = y - hy;
  const cos = Math.cos(-ang), sin = Math.sin(-ang);
  const rx = dx * cos - dy * sin, ry = dx * sin + dy * cos;
  if ((rx / hrx) ** 2 + (ry / hry) ** 2 <= 1) return 1;
  // Hampe
  if (x >= 0.47 && x <= 0.53 && y >= 0.2 && y <= 0.66) return 1;
  // Crochet
  if (inTri(x, y, [0.53, 0.2], [0.74, 0.24], [0.53, 0.36])) return 1;
  return 0;
}

const TOP = [139, 92, 246]; // #8B5CF6
const BOT = [67, 56, 202]; // #4338CA

// Icône pleine (carré ou rond) : dégradé + note blanche.
function render(size, round, ss) {
  const out = Buffer.alloc(size * size * 4);
  const inv = 1.0 / (size * ss);
  const n2 = ss * ss;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px * ss + sx + 0.5) * inv;
          const y = (py * ss + sy + 0.5) * inv;
          let cr = TOP[0] + (BOT[0] - TOP[0]) * y;
          let cg = TOP[1] + (BOT[1] - TOP[1]) * y;
          let cb = TOP[2] + (BOT[2] - TOP[2]) * y;
          const n = noteCoverage(x, y);
          cr += (255 - cr) * n; cg += (255 - cg) * n; cb += (255 - cb) * n;
          let alpha = 1;
          if (round) {
            const d = Math.hypot(x - 0.5, y - 0.5);
            const feather = 1.5 / size;
            alpha = Math.max(0, Math.min(1, (0.5 - d) / feather + 0.5));
            cr *= alpha; cg *= alpha; cb *= alpha;
          }
          r += cr; g += cg; b += cb; a += alpha;
        }
      }
      const ar = a / n2;
      const idx = (py * size + px) * 4;
      if (ar > 0.003) {
        out[idx] = Math.round(r / n2 / ar);
        out[idx + 1] = Math.round(g / n2 / ar);
        out[idx + 2] = Math.round(b / n2 / ar);
        out[idx + 3] = Math.round(ar * 255);
      }
    }
  }
  return out;
}

// Premier plan de l'icône adaptative : note blanche transparente (zone sûre).
function renderForeground(size, f, ss) {
  const out = Buffer.alloc(size * size * 4);
  const inv = 1.0 / (size * ss);
  const n2 = ss * ss;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px * ss + sx + 0.5) * inv;
          const y = (py * ss + sy + 0.5) * inv;
          const nx = (x - 0.5) / f + 0.49;
          const ny = (y - 0.5) / f + 0.49;
          if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) a += noteCoverage(nx, ny);
        }
      }
      const ar = a / n2;
      const idx = (py * size + px) * 4;
      out[idx] = 255; out[idx + 1] = 255; out[idx + 2] = 255; out[idx + 3] = Math.round(ar * 255);
    }
  }
  return out;
}

// ---------- Écriture ----------
const root = path.join(__dirname, '..');
const mipmaps = {
  mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192,
};
for (const [dpi, size] of Object.entries(mipmaps)) {
  const dir = path.join(root, 'android', 'app', 'src', 'main', 'res', `mipmap-${dpi}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), encodePNG(size, size, render(size, false, 4)));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), encodePNG(size, size, render(size, true, 4)));
  console.log(`mipmap-${dpi} (${size}px) OK`);
}

const assetsDir = path.join(root, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'icon.png'), encodePNG(1024, 1024, render(1024, false, 3)));
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), encodePNG(1024, 1024, renderForeground(1024, 0.8, 3)));
console.log('assets/icon.png + adaptive-icon.png OK');
