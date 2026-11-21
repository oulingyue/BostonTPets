// Draws pet art as 32x32 pixel sprites and writes them as PNGs to assets/pets/. Run: npm run pets
// Each pet is built from simple shapes; the script adds 16-bit style shading (light from the top left),
// a dark outline in each part's own color, and a hand-placed face. Every pet also gets an eyes-closed
// "-blink" frame, which the app uses to make pets blink. After adding a pet here, add it to src/lib/petArt.ts.
//
//   node scripts/pixel-pets/generate.mjs [--sheet path/to/preview.png]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const N = 32; // sprite size in pixels
const SCALE = 16; // written PNGs are 512x512 with hard edges, so they stay crisp when the app scales them
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'pets');

// ---------- color helpers ----------
const rgb = (c) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) =>
  `#${rgb(a)
    .map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0'))
    .join('')}`;
/** A material: base color plus shadow/highlight, and a dark outline tinted to match. */
const mat = (base, shadow, highlight = base) => ({ base, shadow, highlight, outline: mix(shadow, '#0e0a16', 0.6) });
const INK = '#1a1222';
const GLINT = '#ffffff';

// ---------- shape tests (pixel centers) ----------
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
const poly = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const minus = (a, b) => (x, y) => a(x, y) && !b(x, y);

class Sprite {
  constructor() {
    this.cells = Array.from({ length: N }, () => Array(N).fill(null));
  }

  /** Fills a shape with a shaded material. rim: outline the shape where it overlaps parts behind it. */
  shape(test, m, { shade = true, rim = false } = {}) {
    const hit = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (test(x + 0.5, y + 0.5)) hit.push([x, y]);
    if (!hit.length) return this;
    const xs = hit.map((p) => p[0]);
    const ys = hit.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    const rx = Math.max(1, (Math.max(...xs) - Math.min(...xs) + 1) / 2);
    const ry = Math.max(1, (Math.max(...ys) - Math.min(...ys) + 1) / 2);
    const inHit = new Set(hit.map(([x, y]) => `${x},${y}`));
    const before = hit.map(([x, y]) => [x, y, this.cells[y][x]]);
    for (const [x, y] of hit) {
      const d = ((x + 0.5 - cx) / rx) * 0.5 + ((y + 0.5 - cy) / ry) * 0.85;
      const tone = !shade ? 'base' : d > 0.42 ? 'shadow' : d < -0.5 ? 'highlight' : 'base';
      this.cells[y][x] = { color: m[tone], mat: m };
    }
    if (rim) {
      for (const [x, y] of hit) {
        const touchesBehind = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => !inHit.has(`${x + dx},${y + dy}`) && this.cells[y + dy]?.[x + dx]);
        if (touchesBehind) this.cells[y][x] = { color: m.outline, mat: m };
      }
    }
    void before;
    return this;
  }

  px(x, y, color) {
    if (x < 0 || y < 0 || x >= N || y >= N) return this;
    this.cells[y][x] = { color, mat: this.cells[y][x]?.mat ?? null };
    return this;
  }

  pts(list, color) {
    for (const [x, y] of list) this.px(x, y, color);
    return this;
  }

  line(x0, y0, x1, y1, color) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** 1px outline around the whole silhouette, tinted by the neighboring part's material. */
  outline() {
    const out = this.cells.map((row) => row.slice());
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (this.cells[y][x]) continue;
        const neighbor = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
          .map(([dx, dy]) => this.cells[y + dy]?.[x + dx])
          .find(Boolean);
        if (neighbor) out[y][x] = { color: neighbor.mat?.outline ?? INK, mat: null };
      }
    }
    this.cells = out;
    return this;
  }
}

/** A round eye: dark, with a glint. Closed: a curved lash line. */
function eye(s, x, y, { closed, w = 2, h = 3, color = INK } = {}) {
  if (closed) {
    for (let i = 0; i < w + 1; i++) s.px(x - 0 + i, y + h - 1 - (i === 0 || i === w ? 1 : 0), color);
    return;
  }
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) s.px(x + dx, y + dy, color);
  s.px(x, y, GLINT);
}

// ---------- the pets ----------
const PETS = {
  lobster: ({ closed }) => {
    const shell = mat('#e5402c', '#a92616', '#ff8466');
    const s = new Sprite();
    // little legs under the body
    for (const [x0, x1] of [[10, 12], [13, 15], [17, 19], [20, 22]]) s.shape(rect(x0, 23, x1, 28), shell, { shade: false });
    // tail curling down and back
    s.shape(ellipse(8.5, 23, 4.6, 3.8), shell);
    s.shape(ellipse(5, 26, 3.6, 3), shell, { rim: true });
    s.shape(poly([[0.5, 27.5], [4, 25], [5.5, 30.5], [1, 31]]), shell, { rim: true });
    // arms reaching up to the claws
    s.shape(poly([[9.5, 15.5], [12, 14], [8, 9], [6, 10.5]]), shell);
    s.shape(poly([[20, 14], [22.5, 15.5], [26, 9.5], [24, 8.5]]), shell);
    // back claw (smaller, up-left)
    s.shape(ellipse(5.5, 5.5, 3.6, 2.4), shell, { rim: true });
    s.shape(ellipse(4.2, 9, 2.6, 1.8), shell, { rim: true });
    // round body with a big face
    s.shape(ellipse(16, 18, 7.6, 6.8), shell, { rim: true });
    s.line(10, 21, 22, 21, shell.shadow); // shell segment
    // front claw (bigger, up-right)
    s.shape(ellipse(26.5, 4.5, 4.6, 3), shell, { rim: true });
    s.shape(ellipse(25.5, 8.6, 3.4, 2.1), shell, { rim: true });
    s.outline();
    // antennae
    s.line(13, 11, 10, 6, '#b8321f').line(10, 6, 10, 2, '#b8321f');
    s.line(18, 11, 20, 6, '#b8321f').line(20, 6, 22, 1, '#b8321f');
    // face
    eye(s, 12, 14, { closed, w: 2, h: 3 });
    eye(s, 18, 14, { closed, w: 2, h: 3 });
    s.pts([[10, 18], [11, 18], [20, 18], [21, 18]], '#ff9aa2'); // blush
    s.pts([[14, 18], [15, 19], [16, 19], [17, 18]], INK); // smile
    return s;
  },

  snapping_turtle: ({ closed }) => {
    const shell = mat('#4f7b3a', '#345626', '#78a94b');
    const skin = mat('#a3ad5f', '#737f3c', '#c9cd82');
    const rim = mat('#c4ae66', '#937e3e', '#e0cd8a');
    const moss = '#9fd356';
    const s = new Sprite();
    // legs and tail behind the shell
    s.shape(ellipse(7.5, 25.5, 2.8, 2.6), skin);
    s.shape(ellipse(22.5, 25.5, 2.8, 2.6), skin);
    s.shape(poly([[1, 22.5], [5, 20], [5.5, 23.5]]), skin);
    // neck and head
    s.shape(rect(21, 17, 25, 22), skin);
    s.shape(ellipse(26.5, 18.5, 4.5, 4), skin, { rim: true });
    // shell rim, then the dome
    s.shape(ellipse(14, 21.5, 11, 3.2), rim, { rim: true });
    s.shape(minus(ellipse(14, 17.5, 10, 7.5), rect(0, 21, 32, 32)), shell, { rim: true });
    // scutes (ridged plates)
    s.line(8, 15, 20, 15, shell.shadow).line(7, 19, 21, 19, shell.shadow);
    for (const [x0, y0, y1] of [[10, 11, 20], [14, 10, 20], [18, 11, 20]]) s.line(x0, y0, x0, y1, shell.shadow);
    s.pts([[9, 12], [13, 11], [16, 12], [11, 16], [17, 16], [8, 17]], moss); // moss
    s.outline();
    // sprout on top
    s.pts([[14, 9], [14, 8], [13, 7], [15, 7], [16, 6]], '#7cc242');
    // beak and face
    s.pts([[30, 19], [30, 20], [29, 21]], '#5b6230');
    if (closed) s.pts([[26, 17], [27, 18], [28, 18], [29, 17]], INK);
    else {
      s.pts([[26, 17], [27, 17], [28, 17], [29, 17]], skin.shadow); // sleepy lid
      s.pts([[27, 18], [28, 18]], INK);
      s.px(27, 18, '#3a3046');
    }
    s.pts([[25, 20], [26, 21], [27, 21]], INK); // tiny smile
    s.px(28, 20, '#ff9aa2');
    return s;
  },

  red_fox: ({ closed }) => {
    const fur = mat('#f07b22', '#b9540e', '#ffa452');
    const cream = mat('#fff4e6', '#e3cdb4', '#ffffff');
    const sock = mat('#3a2620', '#22140f');
    const s = new Sprite();
    // bushy tail curling around the left
    s.shape(ellipse(8, 22, 6.2, 7.5), fur);
    s.shape(ellipse(5, 27.5, 3.6, 2.8), cream, { rim: true });
    // body
    s.shape(ellipse(16, 22, 6.2, 7.2), fur, { rim: true });
    s.shape(ellipse(18.5, 21.5, 3, 4.6), cream);
    // legs (black socks)
    s.shape(rect(16, 26, 19, 31), sock, { rim: true });
    s.shape(rect(20, 26, 23, 31), sock, { rim: true });
    // ears
    s.shape(poly([[13, 9], [14.5, 2.5], [18.5, 8]]), fur);
    s.shape(poly([[19.5, 7.5], [23, 1.5], [24.5, 8]]), fur);
    s.pts([[15, 6], [15, 7], [16, 7], [22, 5], [22, 6], [23, 6]], '#5a2e1e');
    // head and muzzle
    s.shape(ellipse(19.5, 12.5, 6.8, 5.6), fur, { rim: true });
    s.shape(ellipse(23, 15, 4, 2.6), cream);
    s.outline();
    s.pts([[27, 14], [27, 13]], INK); // nose
    eye(s, 17, 10, { closed, w: 2, h: 2 });
    eye(s, 22, 10, { closed, w: 2, h: 3 });
    s.pts([[19, 15], [20, 15]], '#ff9aa2'); // blush
    s.pts([[24, 16], [25, 17], [26, 16]], INK); // smile
    return s;
  },

  humpback_whale: ({ closed }) => {
    const body = mat('#3f6ea6', '#294d7a', '#6194cb');
    const belly = mat('#dceaf5', '#a8c1d7', '#f4f9fd');
    const fin = mat('#e8f1f8', '#b2c7d9', '#ffffff');
    const spout = mat('#bfe8ff', '#7cc6ef', '#ffffff');
    const s = new Sprite();
    // tail flukes raised at the left
    s.shape(poly([[7, 17], [3.5, 13], [1, 8], [4.5, 10], [6, 6], [7.5, 11], [10, 15]]), body);
    // body
    s.shape(ellipse(17, 18, 12, 7), body, { rim: true });
    // belly with throat grooves
    s.shape(minus(ellipse(18.5, 21, 9.5, 3.8), rect(0, 0, 32, 20)), belly);
    for (const y of [21, 23]) s.line(13, y, 25, y, belly.shadow);
    // long white flipper hanging down
    s.shape(poly([[14, 20], [18, 21.5], [12.5, 29], [10, 28]]), fin, { rim: true });
    // bumps on the head
    s.pts([[22, 13], [25, 14], [27, 16]], body.shadow);
    // water spout from the blowhole
    s.shape(ellipse(21, 6.5, 2.6, 2), spout);
    s.shape(ellipse(18.5, 8.5, 1.6, 1.4), spout);
    s.shape(ellipse(23.5, 8.5, 1.6, 1.4), spout);
    s.shape(rect(20, 8, 22, 11), spout, { shade: false });
    s.outline();
    eye(s, 24, 17, { closed, w: 2, h: 2 });
    s.pts([[25, 20], [26, 20], [27, 19]], INK); // smile
    s.px(23, 20, '#ff9aa2');
    return s;
  },

  snowy_owl: ({ closed }) => {
    const feather = mat('#f7f9fc', '#ccd4e0', '#ffffff');
    const wing = mat('#e6ebf2', '#b7c1cf', '#f7f9fc');
    const fleck = '#323844';
    const s = new Sprite();
    // feet
    s.shape(rect(12, 28, 15, 30), mat('#e2c98f', '#b39859'));
    s.shape(rect(18, 28, 21, 30), mat('#e2c98f', '#b39859'));
    // body and wings
    s.shape(ellipse(16, 20.5, 8.5, 8.5), feather);
    s.shape(ellipse(8.5, 21, 3.6, 6.5), wing, { rim: true });
    s.shape(ellipse(23.5, 21, 3.6, 6.5), wing, { rim: true });
    // round head
    s.shape(ellipse(16, 11.5, 8.2, 6.8), feather, { rim: true });
    // black flecks
    s.pts([[13, 21], [17, 23], [20, 20], [15, 26], [11, 24], [19, 26], [7, 18], [9, 23], [24, 19], [23, 24], [22, 13], [10, 9]], fleck);
    s.pts([[14, 21], [18, 23], [21, 20], [16, 26]], fleck);
    s.outline();
    // big yellow eyes
    for (const ex of [11, 18]) {
      if (closed) {
        s.pts([[ex, 12], [ex + 1, 13], [ex + 2, 13], [ex + 3, 12]], INK);
      } else {
        for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) s.px(ex + dx, 10 + dy, '#f6c21c');
        s.pts([[ex + 1, 11], [ex + 2, 11], [ex + 1, 12], [ex + 2, 12]], INK);
        s.px(ex + 1, 11, GLINT);
      }
    }
    s.pts([[15, 13], [16, 13], [15, 14]], '#4b4f5c'); // beak
    s.pts([[9, 14], [22, 14]], '#ffb3bd'); // blush
    return s;
  },
};

// ---------- PNG writing ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(0);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** pixels: function (x, y) => [r, g, b, a] for a width x height image. */
function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixels(x, y);
      raw.set([r, g, b, a], y * (width * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const pixelOf = (cells, scale) => (x, y) => {
  const cell = cells[Math.floor(y / scale)][Math.floor(x / scale)];
  return cell ? [...rgb(cell.color), 255] : [0, 0, 0, 0];
};

// ---------- main ----------
const sheetArg = process.argv.indexOf('--sheet');
mkdirSync(OUT_DIR, { recursive: true });
const frames = [];
for (const [id, draw] of Object.entries(PETS)) {
  for (const closed of [false, true]) {
    const cells = draw({ closed }).cells;
    const file = path.join(OUT_DIR, `${id}${closed ? '-blink' : ''}.png`);
    writeFileSync(file, encodePng(N * SCALE, N * SCALE, pixelOf(cells, SCALE)));
    frames.push(cells);
  }
  console.log(`${id}.png + ${id}-blink.png`);
}

// Optional preview sheet: every frame side by side on a checkerboard, for reviewing the art.
if (sheetArg > 0) {
  const s = 6;
  const gap = 4;
  const w = frames.length * (N * s + gap) + gap;
  const h = N * s + gap * 2;
  const png = encodePng(w, h, (x, y) => {
    const i = Math.floor((x - gap) / (N * s + gap));
    const fx = x - gap - i * (N * s + gap);
    const fy = y - gap;
    if (i >= 0 && i < frames.length && fx >= 0 && fx < N * s && fy >= 0 && fy < N * s) {
      const cell = frames[i][Math.floor(fy / s)][Math.floor(fx / s)];
      if (cell) return [...rgb(cell.color), 255];
    }
    const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 214 : 232;
    return [checker, checker, checker, 255];
  });
  writeFileSync(process.argv[sheetArg + 1], png);
  console.log(`preview sheet: ${process.argv[sheetArg + 1]}`);
}
