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

// ---------- templates for the rest of the roster ----------
const BLUSH = '#ff9aa2';
const r = (v) => Math.round(v);

/** A perched bird facing right. Colors are materials; the rest are optional tweaks. */
function bird(o, { closed }) {
  const s = new Sprite();
  const hx = o.hx ?? 21;
  const hy = o.hy ?? 11.5;
  const legs = o.legs ?? mat('#e8a33a', '#b37522');
  if (!o.noLegs) {
    s.shape(rect(13, 25, 15, 30), legs, { shade: false });
    s.shape(rect(17, 25, 19, 30), legs, { shade: false });
    s.shape(rect(12, 29, 16, 30), legs, { shade: false });
    s.shape(rect(16, 29, 20, 30), legs, { shade: false });
  }
  o.behind?.(s);
  s.shape(poly(o.tailPts ?? [[2, 16], [9, 15.5], [10, 21], [3, 21.5]]), o.tail ?? o.wing ?? o.body);
  s.shape(ellipse(14.5, 20, o.brx ?? 8, o.bry ?? 6.2), o.body, { rim: true });
  if (o.belly) s.shape(minus(ellipse(16.5, 22.5, 5.8, 3.9), rect(0, 0, 32, 19)), o.belly);
  s.shape(ellipse(12, 19.5, 5.4, 3.6), o.wing ?? o.body, { rim: true });
  if (o.neck) s.shape(poly(o.neck), o.neckMat ?? o.head ?? o.body);
  if (o.crest) s.shape(poly(o.crest), o.crestMat ?? o.head ?? o.body);
  s.shape(ellipse(hx, hy, o.hrx ?? 5.2, o.hry ?? 4.8), o.head ?? o.body, { rim: true });
  s.shape(poly(o.beakPts ?? [[hx + 4, hy - 0.5], [hx + 7.5, hy + 1], [hx + 4, hy + 2.2]]), o.beak, { rim: true });
  o.details?.(s, hx, hy);
  s.outline();
  o.face?.(s, hx, hy);
  eye(s, r(hx), r(hy - 2), { closed, w: 2, h: o.eyeH ?? 2 });
  if (!o.noBlush) s.px(r(hx), r(hy + 1), BLUSH);
  return s;
}

/** A sitting mammal facing right (same pose as the fox). */
function critter(o, { closed }) {
  const s = new Sprite();
  const paws = o.paws ?? o.fur;
  o.tail?.(s);
  s.shape(ellipse(16, 22, 6.2, 7.2), o.fur, { rim: true });
  if (o.chest) s.shape(ellipse(18.5, 21.5, 3, 4.6), o.chest);
  o.bodyDetails?.(s);
  s.shape(rect(16, 26, 19, 31), paws, { rim: true });
  s.shape(rect(20, 26, 23, 31), paws, { rim: true });
  const ears = o.ears ?? 'pointy';
  const earMat = o.earMat ?? o.fur;
  if (ears === 'pointy') {
    s.shape(poly([[13, 9], [14.5, 2.5], [18.5, 8]]), earMat);
    s.shape(poly([[19.5, 7.5], [23, 1.5], [24.5, 8]]), earMat);
  } else if (ears === 'round') {
    s.shape(ellipse(14.5, 7.5, 2.6, 2.6), earMat);
    s.shape(ellipse(22.5, 6.5, 2.6, 2.6), earMat);
  } else if (ears === 'bat') {
    s.shape(poly([[12.5, 10], [13, 1.5], [18, 8]]), earMat);
    s.shape(poly([[20, 7.5], [25, 0.5], [25.5, 9]]), earMat);
  } else if (ears === 'big') {
    s.shape(ellipse(14, 6.5, 3.6, 3.6), earMat);
    s.shape(ellipse(23.5, 5.5, 3.6, 3.6), earMat);
  }
  if (o.innerEar) {
    if (ears === 'round' || ears === 'big') s.pts([[14, 7], [23, 6], [14, 6], [23, 5]], o.innerEar);
    else s.pts([[15, 6], [15, 7], [16, 7], [22, 5], [22, 6], [23, 6]], o.innerEar);
  }
  s.shape(ellipse(19.5, 12.5, 6.8, 5.6), o.fur, { rim: true });
  if (o.muzzle) s.shape(ellipse(23, 15, 4, 2.6), o.muzzle);
  o.details?.(s);
  s.outline();
  o.face?.(s);
  s.pts([[27, 14], [27, 13]], o.nose ?? INK);
  eye(s, 17, 10, { closed, w: 2, h: 2, color: o.eyeColor ?? INK });
  eye(s, 22, 10, { closed, w: 2, h: 3, color: o.eyeColor ?? INK });
  s.pts([[19, 15], [20, 15]], BLUSH);
  if (!o.noSmile) s.pts([[24, 16], [25, 17], [26, 16]], INK);
  return s;
}

/** A fish swimming right, with bubbles. */
function fish(o, { closed }) {
  const s = new Sprite();
  s.shape(poly([[1.5, 9], [8.5, 15.5], [1.5, 23], [4, 16]]), o.fin ?? o.body);
  s.shape(poly(o.dorsal ?? [[11, 11], [15, 6.5], [19.5, 10.5]]), o.fin ?? o.body);
  s.shape(ellipse(16.5, 16, 11, 6.4), o.body, { rim: true });
  if (o.back) s.shape(minus(ellipse(16.5, 16, 11, 6.4), rect(0, 14, 32, 32)), o.back);
  if (o.belly) s.shape(minus(ellipse(17, 18, 9, 3.6), rect(0, 0, 32, 17.5)), o.belly);
  s.shape(ellipse(17.5, 18.5, 2.6, 1.6), o.fin ?? o.body, { rim: true });
  o.details?.(s);
  s.outline();
  eye(s, 22, 13, { closed, w: 2, h: 2 });
  s.pts([[26, 17], [25, 17]], INK); // mouth
  s.px(23, 16, BLUSH);
  o.face?.(s);
  for (const [x, y] of [[28, 8], [26, 5], [29, 3]]) s.px(x, y, '#9fd8ff');
  return s;
}

// ---- reusable materials ----
const M = {
  ink: mat('#2b2b30', '#18181c', '#45454c'),
  white: mat('#f6f7f9', '#d3d8e0', '#ffffff'),
  cream: mat('#fff4e6', '#e3cdb4', '#ffffff'),
  orangeLeg: mat('#f0a03a', '#b8721f'),
  yellow: mat('#f6c21c', '#c99510', '#ffe36b'),
  pinkLeg: mat('#e58a8a', '#b25f62'),
  grayLeg: mat('#7d7f86', '#55575d'),
};

const MORE_PETS = {
  // ----- shared commons -----
  mallard_duck: (f) =>
    bird(
      {
        body: mat('#b9b4ae', '#85807a', '#dad6d0'),
        wing: mat('#a39c94', '#736c64', '#c4bdb5'),
        head: mat('#2e7d4f', '#1e5a37', '#4fa36e'),
        beak: mat('#f2c230', '#c09012', '#ffe066'),
        legs: M.orangeLeg,
        details: (s) => s.shape(ellipse(19.5, 21, 3.6, 3.4), mat('#8a5a3a', '#5f3c24', '#a87450')),
        face: (s) => s.pts([[18, 16], [19, 16], [20, 16], [21, 16]], '#ffffff').pts([[11, 20], [12, 20]], '#3a6fd8'),
      },
      f,
    ),
  canada_goose: (f) =>
    bird(
      {
        body: mat('#8c7a66', '#5f5143', '#b09c86'),
        belly: mat('#ece4d6', '#c9bba5', '#ffffff'),
        wing: mat('#76654f', '#4e4233', '#9a8770'),
        head: M.ink,
        neckMat: M.ink,
        neck: [[17.5, 17], [21.5, 16.5], [24.5, 9], [21, 8.5]],
        hx: 23,
        hy: 7.5,
        hrx: 4.4,
        hry: 4,
        beak: M.ink,
        legs: M.grayLeg,
        face: (s) => s.pts([[22, 9], [23, 9], [22, 10], [23, 10], [24, 10]], '#ffffff'),
      },
      f,
    ),
  wild_turkey: (f) =>
    bird(
      {
        body: mat('#7a4e2c', '#4f3119', '#a06b3e'),
        wing: mat('#6a4226', '#452a17', '#8e5c37'),
        head: mat('#a9c4e0', '#7d98b6', '#d0e2f2'),
        hrx: 3.8,
        hry: 3.8,
        hx: 22,
        hy: 12,
        beak: mat('#e8c46a', '#b8963f'),
        legs: M.pinkLeg,
        tailPts: [[10, 18], [4, 4], [9, 1], [15, 3], [16, 16]],
        tail: mat('#8b5a32', '#5c3a1f', '#b07a49'),
        behind: (s) => {
          s.shape(ellipse(10, 9.5, 8.5, 8.5), mat('#8b5a32', '#5c3a1f', '#b07a49'));
          s.shape(minus(ellipse(10, 9.5, 8.5, 8.5), ellipse(10, 9.5, 6.8, 6.8)), mat('#d9b27a', '#a8834d'), { shade: false });
          s.shape(minus(ellipse(10, 9.5, 5, 5), ellipse(10, 9.5, 3.4, 3.4)), mat('#3e2716', '#2a1a0e'), { shade: false });
        },
        face: (s) => s.pts([[25, 14], [25, 15], [26, 15], [24, 16]], '#d9332b'),
      },
      f,
    ),
  pigeon: (f) =>
    bird(
      {
        body: mat('#9aa0aa', '#6d727c', '#c2c7cf'),
        wing: mat('#aeb4be', '#7d838d', '#ccd1d8'),
        beak: mat('#3c3f46', '#25272c'),
        legs: M.pinkLeg,
        brx: 8.5,
        bry: 6.6,
        details: (s) => {
          s.pts([[18, 15], [19, 15], [20, 16], [19, 16], [18, 16]], '#4fae7a');
          s.pts([[18, 17], [19, 17], [20, 17], [21, 17]], '#8a5aa8');
          s.line(9, 19, 13, 20, '#4c5058').line(9, 21, 13, 22, '#4c5058');
        },
        face: (s, hx, hy) => s.px(r(hx + 4), r(hy - 1), '#ffffff'),
      },
      f,
    ),
  gray_squirrel: (f) =>
    critter(
      {
        fur: mat('#9da3a8', '#6e747a', '#c4c9cd'),
        chest: M.cream,
        muzzle: M.cream,
        ears: 'round',
        innerEar: '#e7a7a7',
        tail: (s) => {
          s.shape(ellipse(7.5, 15, 5.8, 10), mat('#9da3a8', '#6e747a', '#c4c9cd'));
          s.shape(ellipse(10, 5.5, 3.6, 3.4), mat('#b3b8bc', '#80868c', '#d4d8db'));
        },
        details: (s) => {
          s.shape(ellipse(20.5, 22, 2.2, 2.4), mat('#c9945a', '#99693a', '#e2b47c'));
          s.shape(rect(18.5, 19, 22.5, 21), mat('#7a4e2c', '#523219'), { shade: false });
        },
      },
      f,
    ),

  // ----- Red Line -----
  alewife: (f) =>
    fish(
      {
        body: mat('#c9d3dc', '#93a1ae', '#eef3f7'),
        back: mat('#3e8f8a', '#2a6662', '#5fb3ad'),
        fin: mat('#a9b8c5', '#7b8b99', '#cdd8e1'),
        details: (s) => s.line(8, 16, 25, 16, '#e9eff4'),
      },
      f,
    ),
  northern_cardinal: (f) =>
    bird(
      {
        body: mat('#d8282b', '#9b1418', '#f2585a'),
        wing: mat('#b51d21', '#7e1013', '#d8393c'),
        beak: mat('#f28c28', '#c06210', '#ffb35c'),
        crest: [[17, 9], [16, 3], [21.5, 7.5]],
        legs: mat('#9a6b5a', '#6d483b'),
        face: (s, hx, hy) => s.pts([[r(hx + 3), r(hy)], [r(hx + 3), r(hy + 1)], [r(hx + 2), r(hy + 1)], [r(hx + 3), r(hy + 2)], [r(hx + 4), r(hy + 2)]], '#1e1214'),
        noBlush: true,
      },
      f,
    ),
  raccoon: (f) =>
    critter(
      {
        fur: mat('#8e8e93', '#626268', '#b6b6ba'),
        chest: mat('#c9c9cc', '#9e9ea2', '#e2e2e4'),
        muzzle: M.white,
        ears: 'round',
        innerEar: '#3a3a40',
        tail: (s) => {
          s.shape(ellipse(8, 22, 5.6, 7.4), mat('#8e8e93', '#626268', '#b6b6ba'));
          for (const y of [17, 21, 25]) s.shape(rect(2, y, 14, y + 2), mat('#3a3a40', '#26262b'), { shade: false });
        },
        face: (s) => {
          s.pts([[15, 10], [16, 10], [16, 11], [17, 12], [18, 12], [19, 12], [20, 11], [21, 12], [22, 13], [23, 13], [24, 12], [24, 11]], '#2a2a30');
          s.pts([[21, 23], [22, 22], [23, 21], [24, 20]], '#f5c542'); // a french fry
        },
      },
      f,
    ),
  mit_beaver: (f) =>
    critter(
      {
        fur: mat('#8a5a3a', '#5e3c25', '#b07a55'),
        chest: mat('#b58a64', '#8a6442', '#d1a983'),
        muzzle: mat('#b58a64', '#8a6442', '#d1a983'),
        ears: 'round',
        innerEar: '#5e3c25',
        tail: (s) => {
          s.shape(ellipse(6.5, 26.5, 5.5, 3.2), mat('#4a3426', '#30211a', '#664a37'));
          s.line(3, 26, 10, 26, '#30211a').line(4, 28, 9, 28, '#30211a');
        },
        bodyDetails: (s) => {
          s.shape(rect(11, 15, 25, 18), mat('#a31f34', '#76121f', '#c43a4f'), { shade: false }); // scarf
          s.shape(rect(13, 15, 16, 22), mat('#8a8b8c', '#5f6061', '#b0b1b2'), { shade: false });
        },
        face: (s) => {
          s.pts([[25, 17], [26, 17], [25, 18], [26, 18]], '#ffffff'); // big front teeth
          s.pts([[22, 24], [23, 24], [24, 24], [24, 23], [24, 25]], '#9aa3ad'); // tiny wrench
        },
        noSmile: true,
      },
      f,
    ),
  red_tailed_hawk: (f) =>
    bird(
      {
        body: mat('#7b5a3c', '#523a24', '#a07a55'),
        belly: mat('#f1e3c8', '#cdb994', '#fff6e4'),
        wing: mat('#6a4c31', '#46321f', '#8f6a48'),
        tail: mat('#c4552b', '#8e3718', '#e27a4f'),
        head: mat('#7b5a3c', '#523a24', '#a07a55'),
        beak: mat('#f2c230', '#c09012', '#ffe066'),
        beakPts: [[25, 11], [28.5, 12.5], [27, 15], [25, 13.5]],
        legs: M.yellow,
        details: (s) => s.pts([[15, 23], [17, 24], [19, 23], [16, 26], [18, 25]], '#9a7550'),
        face: (s) => s.pts([[20, 8], [21, 8], [22, 9], [28, 14]], '#2b1d12'),
      },
      f,
    ),

  // ----- Orange Line -----
  monarch_butterfly: ({ closed }) => {
    const wing = mat('#f28c1e', '#c4640c', '#ffb052');
    const edge = mat('#2b2024', '#1a1316');
    const s = new Sprite();
    s.shape(ellipse(9, 11, 7.5, 7.5), edge);
    s.shape(ellipse(23, 11, 7.5, 7.5), edge);
    s.shape(ellipse(10.5, 23, 5.6, 5.6), edge);
    s.shape(ellipse(21.5, 23, 5.6, 5.6), edge);
    s.shape(ellipse(9.5, 11.5, 6, 6), wing);
    s.shape(ellipse(22.5, 11.5, 6, 6), wing);
    s.shape(ellipse(11, 22.5, 4.2, 4.2), wing);
    s.shape(ellipse(21, 22.5, 4.2, 4.2), wing);
    for (const [a, b, c, d] of [[13, 8, 6, 14], [13, 12, 5, 9], [19, 8, 26, 14], [19, 12, 27, 9], [13, 21, 9, 26], [19, 21, 23, 26]]) s.line(a, b, c, d, '#2b2024');
    s.shape(ellipse(16, 17, 2, 8), mat('#2b2024', '#1a1316', '#45383d'));
    s.shape(ellipse(16, 9, 3.4, 3), mat('#2b2024', '#1a1316', '#45383d'));
    s.outline();
    s.pts([[2, 8], [3, 12], [29, 8], [28, 12], [5, 24], [26, 24], [6, 5], [25, 5]], '#ffffff');
    s.line(15, 6, 12, 1, '#2b2024').line(17, 6, 20, 1, '#2b2024');
    s.pts([[12, 1], [20, 1]], '#f28c1e');
    if (closed) s.pts([[15, 9], [17, 9]], '#ffffff');
    else s.pts([[15, 8], [17, 8], [15, 9], [17, 9]], '#ffffff');
    return s;
  },
  orange_tabby_cat: (f) =>
    critter(
      {
        fur: mat('#f2a03d', '#c0731e', '#ffc46e'),
        chest: M.cream,
        muzzle: M.cream,
        innerEar: '#ff9aa2',
        nose: '#e8737b',
        tail: (s) => {
          s.shape(ellipse(8, 25, 6, 3), mat('#f2a03d', '#c0731e', '#ffc46e'));
          s.pts([[4, 24], [4, 25], [7, 24], [7, 25], [10, 24], [10, 25]], '#c0731e');
        },
        details: (s) => {
          s.pts([[18, 8], [19, 8], [20, 7], [17, 9], [21, 8], [12, 19], [12, 20], [13, 23], [12, 24]], '#c0731e');
        },
        face: (s) => s.pts([[28, 15], [29, 14], [28, 17], [29, 18]], '#5a3a20'), // whiskers
      },
      f,
    ),
  haymarket_rat: (f) =>
    critter(
      {
        fur: mat('#8b6d5a', '#5e4738', '#b0917c'),
        chest: mat('#c9b2a2', '#9e8676', '#e3d2c6'),
        muzzle: mat('#c9b2a2', '#9e8676', '#e3d2c6'),
        ears: 'big',
        innerEar: '#f0a0aa',
        nose: '#f08a96',
        tail: (s) => {
          s.line(11, 27, 6, 28, '#e89aa4').line(6, 28, 3, 25, '#e89aa4').line(3, 25, 3, 21, '#e89aa4');
        },
        details: (s) => {
          s.shape(ellipse(20.5, 22.5, 2.8, 2.6), mat('#e0352b', '#a81f18', '#ff6a5c')); // tomato
          s.pts([[20, 19], [21, 19], [19, 20]], '#3e9a3a');
        },
      },
      f,
    ),
  northeastern_husky: (f) =>
    critter(
      {
        fur: mat('#8a94a3', '#5f6876', '#aeb7c4'),
        chest: M.white,
        muzzle: M.white,
        innerEar: '#e7a7a7',
        eyeColor: '#2a70c8',
        tail: (s) => {
          s.shape(ellipse(8, 18, 4.6, 7), mat('#8a94a3', '#5f6876', '#aeb7c4'));
          s.shape(ellipse(7.5, 12.5, 2.8, 2.6), M.white);
        },
        bodyDetails: (s) => {
          s.shape(minus(ellipse(16, 22, 6.2, 7.2), rect(0, 26, 32, 32)), mat('#c8102e', '#8e0a1f', '#e83a52')); // varsity sweater
          s.shape(rect(9, 19, 23, 21), M.ink, { shade: false });
        },
        details: (s) => s.shape(ellipse(20.5, 13.5, 4.2, 3), M.white),
      },
      f,
    ),
  wentworth_leopard: (f) =>
    critter(
      {
        fur: mat('#e3b04b', '#b07f25', '#f5d17a'),
        chest: M.cream,
        muzzle: M.cream,
        ears: 'round',
        innerEar: '#8a5a20',
        tail: (s) => {
          s.line(11, 28, 5, 28, '#b07f25').line(5, 28, 3, 24, '#b07f25').line(3, 24, 4, 20, '#b07f25');
          s.line(11, 27, 5, 27, '#e3b04b').line(4, 27, 2, 24, '#e3b04b');
        },
        details: (s) => {
          s.pts([[12, 19], [13, 22], [11, 24], [14, 26], [18, 7], [21, 6], [15, 13], [24, 9]], '#5a3a14');
          // hard hat
          s.shape(ellipse(19.5, 6.5, 6.5, 3.6), mat('#f2c41a', '#c29510', '#ffe066'));
          s.shape(rect(12, 7, 28, 9), mat('#f2c41a', '#c29510'), { shade: false });
        },
      },
      f,
    ),

  // ----- Green Line -----
  boston_terrier: (f) =>
    critter(
      {
        fur: M.ink,
        chest: M.white,
        muzzle: M.white,
        ears: 'bat',
        innerEar: '#e7a7a7',
        details: (s) => s.shape(rect(19, 8, 21, 13), M.white, { shade: false }),
        face: (s) => s.pts([[25, 18], [26, 18], [25, 19]], '#ff7a8a'), // tongue
        noSmile: true,
      },
      f,
    ),
  swan: (f) =>
    bird(
      {
        body: mat('#f7f7f5', '#d2d3d6', '#ffffff'),
        wing: mat('#eceef0', '#c4c8ce', '#ffffff'),
        neck: [[16, 17], [20, 17], [22.5, 9], [19.5, 8.5]],
        hx: 22,
        hy: 7,
        hrx: 3.8,
        hry: 3.4,
        beak: mat('#f28c28', '#c06210', '#ffb35c'),
        noLegs: true,
        tailPts: [[3, 15], [9, 16], [9, 21], [4, 19]],
        face: (s) => {
          s.pts([[25, 6], [25, 7]], '#1e1a1c'); // knob
          for (let x = 4; x < 28; x += 3) s.pts([[x, 27], [x + 1, 27]], '#8fd0f0');
          for (let x = 6; x < 26; x += 4) s.px(x, 29, '#b8e4f8');
        },
      },
      f,
    ),
  bullfrog: ({ closed }) => {
    const skin = mat('#6ba83a', '#4a7a26', '#93cc5c');
    const s = new Sprite();
    s.shape(ellipse(16, 27.5, 13, 3.4), mat('#3f8f4a', '#2a6634', '#5cb066')); // lily pad
    s.shape(ellipse(7.5, 24, 4, 2.6), skin);
    s.shape(ellipse(24.5, 24, 4, 2.6), skin);
    s.shape(ellipse(16, 19.5, 9.5, 7), skin, { rim: true });
    s.shape(minus(ellipse(16, 22, 6.5, 4.4), rect(0, 0, 32, 20)), mat('#f1e6a6', '#cbbd78', '#fff8d0'));
    s.shape(ellipse(10.5, 12.5, 3.6, 3.4), skin, { rim: true });
    s.shape(ellipse(21.5, 12.5, 3.6, 3.4), skin, { rim: true });
    s.outline();
    for (const ex of [9, 20]) {
      if (closed) s.pts([[ex, 13], [ex + 1, 14], [ex + 2, 14], [ex + 3, 13]], INK);
      else {
        s.pts([[ex + 1, 11], [ex + 2, 11], [ex + 1, 12], [ex + 2, 12], [ex + 1, 13], [ex + 2, 13]], INK);
        s.px(ex + 1, 11, GLINT);
      }
    }
    s.line(11, 19, 21, 19, INK);
    s.pts([[10, 18], [22, 18]], INK);
    s.pts([[9, 17], [23, 17]], BLUSH);
    return s;
  },
  bu_terrier: (f) =>
    critter(
      {
        fur: M.ink,
        chest: M.white,
        muzzle: M.white,
        ears: 'bat',
        innerEar: '#e7a7a7',
        bodyDetails: (s) => {
          s.shape(minus(ellipse(16, 22, 6.2, 7.2), rect(0, 26, 32, 32)), mat('#cc0000', '#940000', '#ee3a3a')); // varsity sweater
          s.shape(rect(9, 20, 23, 22), M.white, { shade: false });
        },
        details: (s) => s.shape(rect(19, 8, 21, 13), M.white, { shade: false }),
        face: (s) => s.pts([[25, 18], [26, 18], [25, 19]], '#ff7a8a'),
        noSmile: true,
      },
      f,
    ),
  bc_eagle: (f) =>
    bird(
      {
        body: mat('#4a3524', '#2e2016', '#6b4e35'),
        wing: mat('#3e2c1e', '#271b12', '#5c432e'),
        tail: M.white,
        head: M.white,
        beak: mat('#f2c230', '#c09012', '#ffe066'),
        beakPts: [[25, 11], [28.5, 12.5], [27, 15], [25, 13.5]],
        legs: M.yellow,
        details: (s) => {
          s.shape(rect(15, 15, 24, 17.5), mat('#7a1f2b', '#55141d', '#9a3443'), { shade: false }); // scarf
          s.shape(rect(15, 17, 17.5, 22), mat('#c9a227', '#9a7a14', '#e6c14e'), { shade: false });
        },
        face: (s) => s.pts([[20, 8], [21, 8], [22, 9]], '#3a2a1c'),
        noBlush: true,
      },
      f,
    ),

  // ----- Blue Line -----
  blue_jay: (f) =>
    bird(
      {
        body: mat('#3a78c9', '#25518d', '#6fa3e3'),
        belly: M.white,
        wing: mat('#3368b3', '#21477d', '#5a91d6'),
        crest: [[17, 9], [16.5, 2.5], [21.5, 7.5]],
        beak: M.ink,
        legs: M.grayLeg,
        details: (s) => s.line(17, 16, 24, 16, '#1b1d24'),
        face: (s) => s.pts([[22, 13], [23, 13], [23, 12]], '#ffffff').pts([[8, 19], [10, 20], [12, 19], [9, 21], [11, 21]], '#ffffff'),
      },
      f,
    ),
  horseshoe_crab: ({ closed }) => {
    const shell = mat('#8a7a4e', '#5f5332', '#b0a06c');
    const rear = mat('#7a6b42', '#54492c', '#9a8a5c');
    const s = new Sprite();
    s.shape(poly([[3.5, 21], [5.5, 21], [2, 31], [0.5, 30.5]]), rear); // long tail spike
    s.shape(poly([[3, 15], [11, 13], [11, 25], [4, 22]]), rear, { rim: true }); // rear section
    for (const y of [15, 18, 21]) s.px(3, y, '#54492c'); // side spines
    // horseshoe-shaped front shell: a dome with a lighter inner plate and a center ridge
    s.shape(ellipse(19, 19, 11.5, 9), shell, { rim: true });
    s.shape(ellipse(19.5, 18, 8, 6.2), mat('#9d8d5c', '#6e6140', '#bfae78'));
    s.line(19, 11, 19, 25, shell.shadow);
    s.outline();
    eye(s, 15, 15, { closed, w: 2, h: 2 });
    eye(s, 22, 15, { closed, w: 2, h: 2 });
    s.pts([[18, 20], [19, 21], [20, 20]], INK);
    s.pts([[13, 19], [25, 19]], BLUSH);
    return s;
  },
  piping_plover: (f) =>
    bird(
      {
        body: mat('#d9c29a', '#a88f65', '#efddb9'),
        belly: M.white,
        wing: mat('#c8b085', '#977f58', '#e2cda5'),
        head: mat('#d9c29a', '#a88f65', '#efddb9'),
        beak: mat('#f0a03a', '#b8721f'),
        legs: M.orangeLeg,
        brx: 7.4,
        bry: 5.8,
        details: (s) => s.line(17, 16, 23, 16, '#1b1d24'),
        face: (s, hx, hy) => s.pts([[r(hx + 7), r(hy + 1)], [r(hx - 1), r(hy - 4)], [r(hx), r(hy - 4)], [r(hx + 1), r(hy - 4)]], '#1b1d24'),
      },
      f,
    ),
  harbor_seal: ({ closed }) => {
    const fur = mat('#8e99a6', '#646e7b', '#b4bec9');
    const s = new Sprite();
    s.shape(poly([[1, 26], [6, 22], [7, 28]]), fur); // rear flippers
    s.shape(ellipse(14, 23, 11, 5.5), fur, { rim: true });
    s.shape(ellipse(22, 15, 6.5, 6.5), fur, { rim: true });
    s.shape(ellipse(19, 26, 3.4, 1.8), fur, { rim: true }); // front flipper
    s.shape(ellipse(25.5, 17, 3, 2.2), mat('#c3cbd4', '#97a1ad', '#dde3e9'));
    s.pts([[9, 21], [12, 24], [15, 20], [6, 24], [17, 23], [11, 19]], '#5a6370');
    s.outline();
    eye(s, 20, 12, { closed, w: 3, h: 3 });
    eye(s, 25, 12, { closed, w: 2, h: 3 });
    s.pts([[27, 16], [28, 16]], INK); // nose
    s.pts([[29, 17], [30, 16], [29, 18], [30, 19]], '#4a525d'); // whiskers
    s.pts([[25, 18], [26, 19], [27, 18]], INK);
    s.pts([[19, 16], [20, 16]], BLUSH);
    return s;
  },
  penguin: ({ closed }) => {
    const back = mat('#2b2d35', '#1a1b20', '#44474f');
    const s = new Sprite();
    s.shape(rect(11, 28, 15, 30), M.orangeLeg, { shade: false });
    s.shape(rect(17, 28, 21, 30), M.orangeLeg, { shade: false });
    s.shape(ellipse(6.5, 19, 2.6, 6), back); // flippers out
    s.shape(ellipse(25.5, 19, 2.6, 6), back);
    s.shape(ellipse(16, 18, 9, 11), back, { rim: true });
    s.shape(ellipse(16, 21, 6.5, 7.5), M.white);
    s.shape(ellipse(16, 10, 5, 3.6), M.white);
    s.line(10, 17, 22, 17, back.base); // chest band
    s.outline();
    s.pts([[14, 22], [18, 24], [12, 25]], back.base);
    s.pts([[12, 9], [13, 9], [19, 9], [20, 9]], '#ff9fb1'); // pink eye patches
    eye(s, 13, 10, { closed, w: 2, h: 2 });
    eye(s, 18, 10, { closed, w: 2, h: 2 });
    s.pts([[15, 12], [16, 12], [16, 13]], '#2b2d35');
    s.pts([[11, 13], [21, 13]], BLUSH);
    return s;
  },

  // ----- Silver Line -----
  herring_gull: (f) =>
    bird(
      {
        body: M.white,
        wing: mat('#a9b2bd', '#7d8794', '#c8cfd8'),
        tail: M.ink,
        head: M.white,
        beak: mat('#f2c230', '#c09012', '#ffe066'),
        beakPts: [[25, 10], [29, 10.5], [25, 12]],
        legs: M.pinkLeg,
        details: (s) => s.shape(poly([[25, 13], [29, 14], [25, 14.5]]), mat('#f2c230', '#c09012')), // open beak
        face: (s) => s.pts([[27, 11], [28, 13]], '#e0352b').pts([[4, 17], [6, 18]], '#ffffff'),
      },
      f,
    ),
  striped_bass: (f) =>
    fish(
      {
        body: mat('#c9d3dc', '#93a1ae', '#eef3f7'),
        back: mat('#5d7a8f', '#3f5768', '#7d9bb0'),
        fin: mat('#a9b8c5', '#7b8b99', '#cdd8e1'),
        details: (s) => {
          for (const y of [14, 16, 18, 20]) for (let x = 9; x < 25; x += 2) s.px(x + (y % 4 ? 1 : 0), y, '#3f4a55');
        },
      },
      f,
    ),
  moon_jellyfish: ({ closed }) => {
    const bell = mat('#ddd6f7', '#b2a6e2', '#f4f0ff');
    const s = new Sprite();
    for (const x of [9, 13, 17, 21]) {
      s.line(x, 18, x - 1, 22, '#c9bdf0').line(x - 1, 22, x + 1, 26, '#c9bdf0').line(x + 1, 26, x, 30, '#c9bdf0');
    }
    s.shape(minus(ellipse(16, 15, 11, 9), rect(0, 17, 32, 32)), bell, { rim: true });
    s.shape(rect(5, 16, 27, 18), mat('#cfc6f2', '#a99bdd'), { shade: false });
    for (const [x, y] of [[10, 11], [16, 9], [22, 11]]) s.shape(ellipse(x, y, 2, 1.7), mat('#a58be0', '#7d63c0', '#c4adf0'), { shade: false });
    s.outline();
    eye(s, 12, 13, { closed, w: 2, h: 2 });
    eye(s, 19, 13, { closed, w: 2, h: 2 });
    s.pts([[15, 15], [16, 16], [17, 15]], INK);
    s.pts([[10, 15], [22, 15]], BLUSH);
    return s;
  },
  atlantic_cod: (f) =>
    fish(
      {
        body: mat('#9a8f5e', '#6e6540', '#bdb37e'),
        belly: mat('#e3dcc0', '#bdb491', '#f4efdb'),
        fin: mat('#857a4c', '#5c5434', '#a69a68'),
        dorsal: [[8, 11], [11, 7], [14, 10.5], [16, 6.5], [19, 10.5], [21, 7.5], [23, 11]],
        details: (s) => {
          s.line(7, 16, 25, 15, '#efe9d2');
          s.pts([[10, 13], [13, 12], [16, 13], [19, 12], [12, 18], [15, 19], [9, 16], [20, 18]], '#5c5434');
        },
        face: (s) => s.pts([[25, 18], [25, 19]], '#5c5434'), // chin barbel
      },
      f,
    ),
  peregrine_falcon: (f) =>
    bird(
      {
        body: mat('#5b6b80', '#3d4a5a', '#7f90a6'),
        belly: mat('#f3ede1', '#cbc3b1', '#ffffff'),
        wing: mat('#4f5e72', '#344050', '#71839a'),
        head: mat('#2e3644', '#1c222c', '#47505f'),
        beak: mat('#3c3f46', '#25272c'),
        beakPts: [[25, 11], [28.5, 12.5], [27, 15], [25, 13.5]],
        legs: M.yellow,
        details: (s) => {
          s.shape(ellipse(22.5, 13.5, 2.6, 2), M.white); // cheek
          for (const [x, y] of [[15, 23], [17, 24], [19, 23], [16, 25], [18, 26]]) s.pts([[x, y], [x + 1, y]], '#3d4a5a');
        },
        face: (s) => s.pts([[21, 13], [21, 14], [21, 15]], '#1c222c').px(25, 11, '#f6c21c'),
      },
      f,
    ),
};
Object.assign(PETS, MORE_PETS);

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
/**
 * The pet's shape in translucent black, for pets the player hasn't found. It's a separate file rather than a
 * tintColor because iOS can leave a recycled Image tinted after the tint is removed, darkening found pets.
 */
const SILHOUETTE = [0, 0, 0, 71]; // black at 28%
const silhouetteOf = (cells, scale) => (x, y) =>
  cells[Math.floor(y / scale)][Math.floor(x / scale)] ? SILHOUETTE : [0, 0, 0, 0];

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
    if (!closed) writeFileSync(path.join(OUT_DIR, `${id}-silhouette.png`), encodePng(N * SCALE, N * SCALE, silhouetteOf(cells, SCALE)));
  }
  console.log(`${id}.png + ${id}-blink.png + ${id}-silhouette.png`);
}

// The app's map of generated art (src/lib/petArt.ts merges it with any hand-made art).
const ART_MAP = path.resolve(OUT_DIR, '..', '..', 'src', 'lib', 'pixelPetArt.ts');
const entries = Object.keys(PETS)
  .sort()
  .map(
    (id) =>
      `  ${id}: { base: require('../../assets/pets/${id}.png'), blink: require('../../assets/pets/${id}-blink.png'), silhouette: require('../../assets/pets/${id}-silhouette.png') },`,
  );
writeFileSync(
  ART_MAP,
  [
    '// Generated by scripts/pixel-pets/generate.mjs (npm run pets). Do not edit by hand.',
    "import type { PetArt } from './petArt';",
    '',
    'export const PIXEL_PET_ART: Record<string, PetArt> = {',
    ...entries,
    '};',
    '',
  ].join('\n'),
);
console.log(`art map: ${path.relative(process.cwd(), ART_MAP)} (${entries.length} pets)`);

// Optional preview sheet: every pet (eyes open) in a grid on a checkerboard, in roster order.
// Add --blink to show the eyes-closed frames instead.
if (sheetArg > 0) {
  const shown = frames.filter((_, i) => i % 2 === (process.argv.includes('--blink') ? 1 : 0));
  const s = 4;
  const gap = 6;
  const cols = 7;
  const rows = Math.ceil(shown.length / cols);
  const cell = N * s + gap;
  const png = encodePng(cols * cell + gap, rows * cell + gap, (x, y) => {
    const col = Math.floor((x - gap) / cell);
    const row = Math.floor((y - gap) / cell);
    const i = row * cols + col;
    const fx = x - gap - col * cell;
    const fy = y - gap - row * cell;
    if (col >= 0 && col < cols && i < shown.length && fx >= 0 && fx < N * s && fy >= 0 && fy < N * s) {
      const c = shown[i][Math.floor(fy / s)][Math.floor(fx / s)];
      if (c) return [...rgb(c.color), 255];
    }
    const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 214 : 232;
    return [checker, checker, checker, 255];
  });
  writeFileSync(process.argv[sheetArg + 1], png);
  console.log(`preview sheet: ${process.argv[sheetArg + 1]}`);
}
