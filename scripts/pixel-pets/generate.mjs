// Draws every pet as pixel art and writes the app's art. Run: npm run pets
//   assets/pets/<id>.png and <id>-blink.png   every pet in APP_STYLE (old_style: 32x32, dark outlines)
//   src/lib/pixelPetArt.ts                    the app's map of that art
// With --proposed it also writes both styles side by side for comparison, each with a _sheet.png:
//   assets/proposed/old_style/   32x32, dark outlines, round eyes (the style the app uses)
//   assets/proposed/new_style/   48x48, soft outlines, 3-tone shading, a wink, a "T" cap, sparkles on legendaries
// Every pet is its own design (its own pose and shapes), drawn on a 100x100 grid so a design renders in either style.
//
//   node scripts/pixel-pets/generate.mjs [--proposed]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------- colors ----------
const rgb = (c) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) =>
  `#${rgb(a)
    .map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0'))
    .join('')}`;
const M = (base, shadow, highlight = base) => ({ base, shadow, highlight });
const INK = '#1a1222';

const STYLES = {
  old_style: {
    n: 32,
    scale: 16,
    outline: (m) => mix(m.shadow, '#0e0a16', 0.6),
    tone: (m, d) => (d > 0.42 ? m.shadow : d < -0.5 ? m.highlight : m.base),
    eye: { w: 2, h: 2, color: INK },
    blush: { w: 2, color: '#ff9aa2' },
    hat: false,
    sparkles: false,
    wink: false,
  },
  new_style: {
    n: 48,
    scale: 11,
    outline: (m) => mix(m.shadow, '#2a1626', 0.32),
    tone: (m, d) =>
      d > 0.62 ? mix(m.shadow, '#2a1626', 0.18) : d > 0.22 ? m.shadow : d < -0.45 ? m.highlight : mix(m.base, '#ffffff', 0.05),
    eye: { w: 3, h: 3, color: '#2b1d2e' },
    blush: { w: 3, color: '#ffa9b8' },
    hat: true,
    sparkles: true,
    wink: true,
  },
};

// ---------- shape tests (in 100x100 design units) ----------
const ellipse = (cx, cy, rx, ry, rot = 0) => {
  const a = (rot * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  };
};
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
const and = (a, b) => (x, y) => a(x, y) && b(x, y);

// ---------- the drawing surface ----------
class Drawer {
  constructor(style, { closed }) {
    this.st = style;
    this.n = style.n;
    this.closed = closed;
    this.cells = Array.from({ length: this.n }, () => Array(this.n).fill(null));
    this.post = []; // pixel marks drawn after the outline
    this.face = { eyes: [], mode: 'normal', blush: [], mouth: null, onDark: false };
    this.legendary = false;
  }

  P(v) {
    return Math.min(this.n - 1, Math.max(0, Math.floor((v / 100) * this.n)));
  }

  shape(test, m, { shade = true, rim = false } = {}) {
    const n = this.n;
    const hit = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (test(((x + 0.5) / n) * 100, ((y + 0.5) / n) * 100)) hit.push([x, y]);
      }
    }
    if (!hit.length) return this;
    const xs = hit.map((p) => p[0]);
    const ys = hit.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    const rx = Math.max(1, (Math.max(...xs) - Math.min(...xs) + 1) / 2);
    const ry = Math.max(1, (Math.max(...ys) - Math.min(...ys) + 1) / 2);
    const inHit = new Set(hit.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of hit) {
      const d = ((x + 0.5 - cx) / rx) * 0.5 + ((y + 0.5 - cy) / ry) * 0.85;
      this.cells[y][x] = { color: shade ? this.st.tone(m, d) : mix(m.base, '#ffffff', 0), mat: m };
    }
    if (rim) {
      for (const [x, y] of hit) {
        const behind = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => !inHit.has(`${x + dx},${y + dy}`) && this.cells[y + dy]?.[x + dx]);
        if (behind) this.cells[y][x] = { color: this.st.outline(m), mat: m };
      }
    }
    return this;
  }

  e(cx, cy, rx, ry, m, o = {}) {
    return this.shape(ellipse(cx, cy, rx, ry, o.rot ?? 0), m, o);
  }
  p(pts, m, o) {
    return this.shape(poly(pts), m, o);
  }
  r(x0, y0, x1, y1, m, o) {
    return this.shape(rect(x0, y0, x1, y1), m, o);
  }
  /** A 1px line inside the drawing (before the outline), e.g. stripes or segments. */
  l(x0, y0, x1, y1, color) {
    for (const [x, y] of bresenham(this.P(x0), this.P(y0), this.P(x1), this.P(y1))) {
      if (this.cells[y][x]) this.cells[y][x] = { color, mat: this.cells[y][x].mat };
    }
    return this;
  }
  /** Pixel marks drawn after the outline (details, water, sparkles of their own). */
  m(points, color) {
    for (const [x, y] of points) this.post.push([this.P(x), this.P(y), color]);
    return this;
  }
  ml(x0, y0, x1, y1, color) {
    for (const [x, y] of bresenham(this.P(x0), this.P(y0), this.P(x1), this.P(y1))) this.post.push([x, y, color]);
    return this;
  }
  eyes(list, { mode = 'normal', onDark = false } = {}) {
    this.face.eyes = list;
    this.face.mode = mode;
    this.face.onDark = onDark;
    return this;
  }
  blush(list) {
    this.face.blush = list;
    return this;
  }
  mouth(x, y, type = 'smile') {
    this.face.mouth = { x, y, type };
    return this;
  }
  /** The white "T" cap (new style only). x, y: top of the head; w: cap width. */
  hat(x, y, w) {
    if (!this.st.hat) return this;
    const cap = M('#f7f6f2', '#d4d0c8', '#ffffff');
    this.shape(minus(ellipse(x, y, w / 2, w * 0.42), rect(0, y, 100, 100)), cap, { rim: true });
    this.shape(rect(x - w * 0.5, y - 1, x + w * 0.72, y + 2.2), cap, { shade: false });
    this.hatAt = { x: this.P(x), y: this.P(y - w * 0.2) };
    return this;
  }

  finish() {
    const n = this.n;
    // outline around the whole silhouette, tinted by the neighboring part
    const out = this.cells.map((row) => row.slice());
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (this.cells[y][x]) continue;
        const nb = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
          .map(([dx, dy]) => this.cells[y + dy]?.[x + dx])
          .find(Boolean);
        if (nb) out[y][x] = { color: nb.mat ? this.st.outline(nb.mat) : INK, mat: null };
      }
    }
    this.cells = out;
    const px = (x, y, color) => {
      if (x >= 0 && y >= 0 && x < n && y < n) this.cells[y][x] = { color, mat: null };
    };
    for (const [x, y, c] of this.post) px(x, y, c);

    // the cap's green T
    if (this.hatAt) {
      const { x, y } = this.hatAt;
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [0, 0], [0, 1]]) px(x + dx, y + dy, '#2e9e4f');
    }

    // face
    const E = this.st.eye;
    const eyes = this.face.eyes;
    eyes.forEach(([ex, ey], i) => {
      const x0 = this.P(ex) - Math.floor(E.w / 2);
      const y0 = this.P(ey) - Math.floor(E.h / 2);
      const winkThis = this.st.wink && eyes.length > 1 && i === eyes.length - 1;
      const happy = this.face.mode === 'happy';
      if (happy || winkThis || this.closed) {
        if (happy || (winkThis && !this.closed)) {
          // ^ : a happy closed eye (and the wink)
          px(x0, y0 + E.h - 1, E.color);
          for (let k = 1; k < E.w; k++) px(x0 + k, y0 + E.h - 2, E.color);
          px(x0 + E.w, y0 + E.h - 1, E.color);
        } else {
          // ‿ : a blink
          px(x0, y0 + E.h - 2, E.color);
          for (let k = 1; k < E.w; k++) px(x0 + k, y0 + E.h - 1, E.color);
          px(x0 + E.w, y0 + E.h - 2, E.color);
        }
        return;
      }
      if (this.face.mode === 'sleepy') {
        for (let k = 0; k < E.w + 1; k++) px(x0 + k, y0 + 1, E.color);
        return;
      }
      if (this.face.onDark) for (let dy = -1; dy <= E.h; dy++) for (let dx = -1; dx <= E.w; dx++) px(x0 + dx, y0 + dy, '#f4f4f6');
      for (let dy = 0; dy < E.h; dy++) for (let dx = 0; dx < E.w; dx++) px(x0 + dx, y0 + dy, E.color);
      px(x0, y0, '#ffffff');
      if (E.w >= 3) px(x0 + E.w - 1, y0 + E.h - 1, '#6b5a7a');
    });
    for (const [bx, by] of this.face.blush) for (let k = 0; k < this.st.blush.w; k++) px(this.P(bx) + k - 1, this.P(by), this.st.blush.color);
    const mo = this.face.mouth;
    if (mo) {
      const mx = this.P(mo.x);
      const my = this.P(mo.y);
      if (mo.type === 'o') {
        px(mx, my, INK);
        px(mx + 1, my, INK);
        px(mx, my + 1, INK);
        px(mx + 1, my + 1, INK);
      } else if (this.n >= 48) {
        for (const [dx, dy] of [[-2, 0], [-1, 1], [0, 0], [1, 1], [2, 0]]) px(mx + dx, my + dy, INK);
      } else {
        for (const [dx, dy] of [[-1, 0], [0, 1], [1, 0]]) px(mx + dx, my + dy, INK);
      }
    }

    // sparkles around legendaries (new style)
    if (this.st.sparkles && this.legendary) {
      const spots = [[8, 10, '#e9c98a'], [90, 12, '#a9d6ff'], [6, 58, '#a9d6ff'], [93, 64, '#e9c98a'], [16, 88, '#e9c98a']];
      for (const [sx, sy, c] of spots) {
        const x = this.P(sx);
        const y = this.P(sy);
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!this.cells[y + dy]?.[x + dx]) px(x + dx, y + dy, dx || dy ? c : '#ffffff');
        }
      }
    }
    return this.cells;
  }
}

function bresenham(x0, y0, x1, y1) {
  const pts = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
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
  return pts;
}

// ---------- shared materials ----------
const C = {
  white: M('#f6f7f9', '#d3d8e0', '#ffffff'),
  cream: M('#fff4e6', '#e3cdb4', '#ffffff'),
  black: M('#2b2b30', '#18181c', '#45454c'),
  water: '#8fd0f0',
  water2: '#c4ebfb',
  pink: M('#f0a0aa', '#c47884', '#ffc4cc'),
  yellowBeak: M('#f2c230', '#c09012', '#ffe066'),
  orange: M('#f0a03a', '#b8721f', '#ffc46e'),
};

// ---------- the pets (each its own design) ----------
const PETS = {
  // ===== shared commons =====
  mallard_duck(d) {
    const body = M('#b9b4ae', '#85807a', '#dad6d0');
    d.p([[22, 66], [8, 56], [12, 70], [26, 74]], M('#3a3a40', '#24242a'));
    d.e(48, 72, 30, 14, body, { rim: true });
    d.e(68, 71, 12, 11, M('#8a5a3a', '#5f3c24', '#a87450'));
    d.e(42, 68, 17, 8, M('#a39c94', '#736c64', '#c4bdb5'), { rim: true });
    d.e(72, 44, 14, 13, M('#2e7d4f', '#1e5a37', '#4fa36e'), { rim: true });
    d.p([[83, 46], [97, 49], [96, 54], [83, 53]], C.yellowBeak, { rim: true });
    d.hat(71, 33, 22);
    d.eyes([[77, 41]]).blush([[73, 48]]);
    d.m([[33, 68], [36, 68]], '#3a6fd8');
    d.ml(64, 56, 78, 56, '#ffffff');
    d.ml(4, 90, 96, 90, C.water).ml(16, 95, 84, 95, C.water2);
  },
  canada_goose(d) {
    const leg = M('#55575d', '#3a3c40');
    d.r(40, 82, 44, 95, leg).r(52, 82, 56, 95, leg).r(36, 93, 46, 96, leg).r(50, 93, 60, 96, leg);
    d.p([[22, 62], [8, 56], [14, 70]], C.black);
    d.e(44, 68, 26, 17, M('#8c7a66', '#5f5143', '#b09c86'), { rim: true });
    d.e(50, 77, 18, 8, M('#ece4d6', '#c9bba5', '#ffffff'));
    d.e(38, 64, 18, 10, M('#76654f', '#4e4233', '#9a8770'), { rim: true });
    d.p([[56, 60], [64, 58], [73, 26], [65, 24]], C.black);
    d.e(70, 20, 10, 8, C.black, { rim: true });
    d.e(67, 24, 5, 3, C.white, { shade: false });
    d.p([[78, 15], [93, 12], [80, 20]], C.black, { rim: true });
    d.p([[78, 22], [91, 27], [79, 25]], C.black, { rim: true });
    d.hat(69, 13, 18);
    d.eyes([[73, 18]], { onDark: true });
  },
  wild_turkey(d) {
    const leg = M('#e58a8a', '#b25f62');
    d.r(42, 86, 46, 97, leg).r(54, 86, 58, 97, leg);
    d.e(50, 50, 46, 40, M('#8b5a32', '#5c3a1f', '#b07a49'));
    d.e(50, 50, 37, 32, M('#d9b27a', '#a8834d', '#ecd09e'), { shade: false });
    d.e(50, 50, 29, 25, M('#5a3a20', '#3e2716', '#7a5232'), { shade: false });
    for (const a of [-60, -30, 0, 30, 60]) {
      const r = (a * Math.PI) / 180;
      d.l(50, 50, 50 + Math.sin(r) * 44, 50 - Math.cos(r) * 38, '#4a2e18');
    }
    const body = M('#6a4226', '#452a17', '#8e5c37');
    d.e(50, 70, 20, 21, body, { rim: true });
    d.e(31, 70, 7, 13, body, { rim: true }).e(69, 70, 7, 13, body, { rim: true });
    d.l(42, 64, 58, 64, '#3a2414').l(40, 73, 60, 73, '#3a2414');
    d.e(50, 40, 9, 10, M('#a9c4e0', '#7d98b6', '#d0e2f2'), { rim: true });
    d.e(55, 51, 3, 6, M('#d9332b', '#a01f19', '#ef5a52'));
    d.p([[47, 44], [53, 44], [50, 48]], M('#e8c46a', '#b8963f'));
    d.hat(50, 31, 18);
    d.eyes([[46, 38], [54, 38]]);
    d.ml(51, 43, 52, 50, '#d9332b');
  },
  pigeon(d) {
    const gray = M('#9aa0aa', '#6d727c', '#c2c7cf');
    const wing = M('#8d939d', '#62676f', '#b3b8c0');
    d.r(38, 88, 46, 96, C.pink).r(54, 88, 62, 96, C.pink);
    d.e(50, 66, 26, 26, gray, { rim: true });
    d.e(25, 68, 8, 18, wing, { rim: true }).e(75, 68, 8, 18, wing, { rim: true });
    d.l(19, 66, 30, 68, '#3c3f46').l(70, 68, 81, 66, '#3c3f46').l(19, 73, 30, 75, '#3c3f46').l(70, 75, 81, 73, '#3c3f46');
    d.e(44, 51, 10, 6, M('#4fae7a', '#2f7a50', '#7fd0a0'), { shade: false });
    d.e(56, 51, 10, 6, M('#8a5aa8', '#5e3a78', '#b088c8'), { shade: false });
    d.e(52, 30, 14, 13, gray, { rim: true });
    d.p([[48, 34], [57, 34], [52, 41]], M('#3c3f46', '#25272c'), { rim: true });
    d.hat(51, 18, 22);
    d.eyes([[46, 27], [58, 27]]).blush([[42, 34], [62, 34]]);
    d.m([[52, 34]], '#ffffff');
  },
  gray_squirrel(d) {
    const fur = M('#9da3a8', '#6e747a', '#c4c9cd');
    d.e(26, 46, 16, 30, fur);
    d.e(34, 17, 12, 11, M('#b3b8bc', '#80868c', '#d4d8db'), { rim: true });
    d.e(50, 70, 16, 22, fur, { rim: true });
    d.e(56, 72, 8, 14, C.cream);
    d.e(44, 88, 12, 7, fur, { rim: true });
    d.p([[58, 31], [62, 17], [68, 30]], fur);
    d.e(66, 40, 13, 12, fur, { rim: true });
    d.e(73, 46, 6, 4, C.cream);
    d.e(77, 59, 5, 6, M('#c9945a', '#99693a', '#e2b47c'), { rim: true });
    d.e(77, 53.5, 6, 2.5, M('#7a4e2c', '#523219', '#9a6b45'), { shade: false });
    d.e(70, 61, 4, 3, fur, { rim: true });
    d.hat(67, 29, 18);
    d.eyes([[70, 38]]).blush([[66, 45]]);
    d.m([[79, 44]], '#3a2a2a');
  },

  // ===== Red Line =====
  alewife(d) {
    const fin = M('#a9b8c5', '#7b8b99', '#cdd8e1');
    d.p([[14, 66], [2, 52], [4, 78]], fin);
    d.p([[12, 66], [24, 48], [42, 36], [62, 30], [80, 33], [91, 42], [85, 50], [64, 46], [44, 50], [26, 62], [18, 72]], M('#c9d3dc', '#93a1ae', '#eef3f7'), { rim: true });
    d.p([[22, 50], [40, 37], [62, 31], [80, 34], [78, 39], [60, 37], [42, 43], [26, 55]], M('#3e8f8a', '#2a6662', '#5fb3ad'));
    d.p([[48, 34], [55, 22], [61, 32]], fin);
    d.hat(79, 32, 16);
    d.eyes([[82, 39]]).blush([[77, 45]]);
    d.m([[89, 46]], INK);
    d.m([[10, 84], [16, 90], [24, 86], [8, 93], [30, 93]], '#9fd8ff');
  },
  northern_cardinal(d) {
    const red = M('#d8282b', '#9b1418', '#f2585a');
    const dark = M('#b51d21', '#7e1013', '#d8393c');
    const feet = M('#9a6b5a', '#6d483b');
    d.r(6, 86, 94, 92, M('#7a5a3c', '#523b25', '#9a7a58'));
    d.e(86, 82, 8, 4, M('#5aa34a', '#3a7a30', '#7ac46a'));
    d.r(46, 82, 50, 88, feet).r(56, 82, 60, 88, feet);
    d.p([[42, 76], [34, 96], [46, 96], [52, 78]], dark);
    d.e(52, 62, 20, 22, red, { rim: true });
    d.e(42, 64, 11, 15, dark, { rim: true });
    d.p([[50, 30], [47, 8], [62, 26]], red);
    d.e(56, 38, 14, 13, red, { rim: true });
    d.e(66, 43, 8, 6, M('#1e1214', '#120a0c'), { shade: false });
    d.p([[68, 38], [80, 42], [68, 46]], M('#f28c28', '#c06210', '#ffb35c'), { rim: true });
    d.eyes([[59, 35]]);
  },
  raccoon(d) {
    const fur = M('#8e8e93', '#626268', '#b6b6ba');
    const dark = M('#3a3a40', '#26262b', '#55555c');
    d.e(76, 72, 9, 20, fur);
    for (const y of [61, 71, 81]) d.shape(and(ellipse(76, 72, 9, 20), rect(0, y, 100, y + 4)), dark, { shade: false });
    d.r(38, 86, 45, 97, dark).r(55, 86, 62, 97, dark);
    d.e(50, 68, 20, 22, fur, { rim: true });
    d.e(50, 72, 11, 14, M('#c9c9cc', '#9e9ea2', '#e2e2e4'));
    d.e(33, 23, 7, 7, fur).e(67, 23, 7, 7, fur);
    d.e(50, 39, 20, 16, fur, { rim: true });
    d.e(50, 38, 17, 6, dark, { shade: false });
    d.e(41, 37, 4.5, 3.5, C.white, { shade: false }).e(59, 37, 4.5, 3.5, C.white, { shade: false });
    d.e(50, 47, 8, 5, C.white);
    d.p([[58, 50], [62, 49], [66, 64], [62, 65]], M('#f5c542', '#c99a1e', '#ffe07a'), { rim: true });
    d.e(61, 62, 5, 4, fur, { rim: true });
    d.hat(50, 24, 22);
    d.eyes([[41, 37], [59, 37]]);
    d.m([[50, 44]], '#1e1e22').mouth(50, 49);
    d.m([[33, 23], [67, 23]], '#3a3a40');
  },
  mit_beaver(d) {
    const fur = M('#8a5a3a', '#5e3c25', '#b07a55');
    const belly = M('#b58a64', '#8a6442', '#d1a983');
    const metal = M('#9aa3ad', '#6e7781', '#c4cbd2');
    d.e(50, 90, 26, 7, M('#4a3426', '#30211a', '#664a37'));
    d.e(50, 64, 22, 24, fur, { rim: true });
    d.e(50, 70, 13, 15, belly);
    d.e(35, 20, 5, 5, fur).e(65, 20, 5, 5, fur);
    d.e(50, 34, 19, 16, fur, { rim: true });
    d.e(50, 42, 10, 7, belly);
    d.r(30, 48, 70, 54, M('#a31f34', '#76121f', '#c43a4f'), { shade: false, rim: true });
    d.r(58, 52, 64, 66, M('#8a8b8c', '#5f6061', '#b0b1b2'), { shade: false });
    d.p([[64, 72], [68, 68], [82, 54], [78, 50]], metal);
    d.e(82, 50, 5, 5, metal, { rim: true });
    d.hat(50, 20, 24);
    d.eyes([[42, 31], [58, 31]]);
    d.m([[50, 39]], '#2a1a12').m([[48, 44], [51, 44], [48, 47], [51, 47]], '#ffffff');
    d.ml(30, 90, 70, 90, '#30211a');
    d.m([[82, 48]], '#5f6870');
  },
  red_tailed_hawk(d) {
    const wing = M('#7b5a3c', '#523a24', '#a07a55');
    const under = M('#e9d6b0', '#c4ad84', '#f6e8cc');
    d.p([[44, 42], [4, 26], [0, 38], [12, 48], [42, 56]], wing, { rim: true });
    d.p([[56, 42], [96, 26], [100, 38], [88, 48], [58, 56]], wing, { rim: true });
    d.p([[40, 48], [14, 40], [16, 46], [40, 53]], under).p([[60, 48], [86, 40], [84, 46], [60, 53]], under);
    d.p([[42, 70], [58, 70], [66, 88], [34, 88]], M('#c4552b', '#8e3718', '#e27a4f'), { rim: true });
    d.e(50, 56, 11, 18, under, { rim: true });
    d.e(50, 32, 10, 10, wing, { rim: true });
    d.p([[47, 36], [53, 36], [52, 42], [50, 43]], C.yellowBeak);
    d.hat(50, 22, 18);
    d.eyes([[46, 31], [54, 31]]);
    d.ml(43, 28, 47, 29, '#2b1d12').ml(53, 29, 57, 28, '#2b1d12');
    d.m([[46, 56], [54, 58], [48, 64], [52, 52]], '#9a7550').m([[2, 32], [4, 36], [97, 32], [95, 36]], '#3a2a1a');
  },
  lobster(d) {
    const shell = M('#e5402c', '#a92616', '#ff8466');
    d.legendary = true;
    d.p([[24, 86], [12, 96], [40, 98], [44, 88]], shell);
    d.e(54, 82, 16, 9, shell, { rim: true });
    d.e(58, 67, 18, 12, shell, { rim: true });
    d.p([[34, 52], [41, 56], [30, 70], [24, 66]], shell);
    d.p([[58, 52], [64, 54], [71, 62], [66, 65]], shell);
    d.e(46, 44, 20, 17, shell, { rim: true });
    d.e(23, 72, 11, 8, shell, { rim: true }).e(21, 81, 8, 4, shell, { rim: true });
    d.e(71, 66, 8, 6, shell, { rim: true }).e(77, 72, 5, 3, shell, { rim: true });
    d.l(42, 66, 74, 66, shell.shadow).l(42, 80, 66, 80, shell.shadow);
    d.hat(46, 28, 26);
    d.eyes([[40, 41], [53, 41]]).blush([[35, 48], [57, 48]]).mouth(46, 49);
    d.ml(39, 28, 26, 10, '#b8321f').ml(26, 10, 13, 8, '#b8321f').ml(53, 28, 68, 8, '#b8321f').ml(68, 8, 85, 6, '#b8321f');
  },

  // ===== Orange Line =====
  monarch_butterfly(d) {
    const wing = M('#f28c1e', '#c4640c', '#ffb052');
    const edge = M('#2b2024', '#1a1316', '#45383d');
    d.e(28, 34, 22, 22, edge).e(72, 34, 22, 22, edge).e(32, 70, 16, 16, edge).e(68, 70, 16, 16, edge);
    d.e(29, 35, 17, 17, wing).e(71, 35, 17, 17, wing).e(33, 69, 11, 11, wing).e(67, 69, 11, 11, wing);
    for (const [a, b, c, e] of [[40, 28, 16, 40], [40, 36, 14, 28], [60, 28, 84, 40], [60, 36, 86, 28], [40, 64, 28, 76], [60, 64, 72, 76]]) d.l(a, b, c, e, '#2b2024');
    d.e(50, 56, 5, 24, edge).e(50, 29, 8, 7, edge);
    d.hat(50, 22, 14);
    d.eyes([[46, 29], [54, 29]], { onDark: true });
    d.m([[8, 30], [10, 42], [92, 30], [90, 42], [20, 80], [80, 80], [18, 18], [82, 18]], '#ffffff');
    d.ml(47, 22, 40, 6, '#2b2024').ml(53, 22, 60, 6, '#2b2024').m([[40, 6], [60, 6]], '#f28c1e');
  },
  orange_tabby_cat(d) {
    const fur = M('#f2a03d', '#c0731e', '#ffc46e');
    d.e(40, 89, 26, 4, fur);
    d.e(46, 72, 32, 18, fur, { rim: true });
    d.l(26, 60, 29, 70, fur.shadow).l(36, 56, 38, 66, fur.shadow).l(46, 55, 47, 65, fur.shadow);
    d.p([[62, 44], [64, 28], [74, 40]], fur).p([[78, 40], [86, 28], [88, 46]], fur);
    d.e(74, 55, 16, 14, fur, { rim: true });
    d.e(80, 61, 8, 5, C.cream);
    d.hat(74, 42, 20);
    d.eyes([[69, 52], [80, 52]], { mode: 'happy' });
    d.m([[84, 58]], '#e8737b').m([[66, 36], [84, 36]], '#ff9aa2');
    d.ml(90, 60, 98, 58, '#8a5a30').ml(90, 63, 98, 65, '#8a5a30');
  },
  haymarket_rat(d) {
    const fur = M('#8b6d5a', '#5e4738', '#b0917c');
    const light = M('#c9b2a2', '#9e8676', '#e3d2c6');
    d.e(42, 95, 6, 3, C.pink).e(58, 95, 6, 3, C.pink);
    d.e(50, 72, 16, 20, fur, { rim: true });
    d.e(50, 77, 10, 12, light);
    d.e(50, 64, 9, 8, M('#e0352b', '#a81f18', '#ff6a5c'), { rim: true });
    d.e(42, 64, 4, 3, fur, { rim: true }).e(58, 64, 4, 3, fur, { rim: true });
    d.e(34, 27, 9, 9, fur).e(66, 27, 9, 9, fur);
    d.e(34, 27, 5, 5, C.pink, { shade: false }).e(66, 27, 5, 5, C.pink, { shade: false });
    d.e(50, 41, 15, 13, fur, { rim: true });
    d.e(50, 49, 6, 4, light);
    d.hat(50, 29, 20);
    d.eyes([[44, 39], [56, 39]]);
    d.m([[50, 48]], '#f08a96').m([[48, 56], [50, 55], [52, 56]], '#3e9a3a');
    d.ml(60, 90, 80, 92, '#e89aa4').ml(80, 92, 90, 80, '#e89aa4').ml(90, 80, 88, 68, '#e89aa4');
    d.ml(56, 48, 64, 46, '#5e4738').ml(44, 48, 36, 46, '#5e4738');
  },
  northeastern_husky(d) {
    const gray = M('#8a94a3', '#5f6876', '#aeb7c4');
    d.e(26, 56, 10, 13, gray).e(24, 46, 6, 5, C.white);
    d.e(46, 72, 18, 20, gray, { rim: true });
    d.shape(minus(ellipse(46, 72, 18, 20), rect(0, 84, 100, 100)), M('#c8102e', '#8e0a1f', '#e83a52'));
    d.shape(and(ellipse(46, 72, 18, 20), rect(0, 70, 100, 74)), C.black, { shade: false });
    d.r(48, 84, 53, 97, C.white, { rim: true }).r(56, 84, 61, 97, C.white, { rim: true });
    d.p([[52, 29], [50, 12], [60, 25]], gray).p([[60, 25], [64, 10], [70, 25]], gray);
    d.e(62, 36, 13, 12, gray, { rim: true });
    d.e(64, 41, 9, 8, C.white);
    d.p([[68, 31], [84, 17], [89, 23], [73, 41]], C.white, { rim: true });
    d.hat(60, 25, 18);
    d.eyes([[63, 34]], { mode: 'happy' }).mouth(81, 26, 'o');
    d.m([[87, 18]], '#2b2b30');
    d.ml(90, 8, 94, 4, '#ffffff').ml(93, 12, 98, 10, '#ffffff');
  },
  wentworth_leopard(d) {
    const fur = M('#e3b04b', '#b07f25', '#f5d17a');
    const hat = M('#f2c41a', '#c29510', '#ffe066');
    d.p([[18, 74], [8, 60], [10, 48], [16, 50], [14, 62], [23, 72]], fur);
    d.e(46, 74, 30, 13, fur, { rim: true });
    d.e(52, 81, 18, 6, C.cream);
    d.e(70, 86, 8, 4, fur, { rim: true }).e(82, 86, 8, 4, fur, { rim: true });
    d.e(66, 49, 4, 4, fur).e(86, 48, 4, 4, fur);
    d.e(76, 60, 14, 13, fur, { rim: true });
    d.e(82, 66, 7, 5, C.cream);
    d.shape(minus(ellipse(76, 51, 13, 8), rect(0, 52, 100, 100)), hat, { rim: true });
    d.r(62, 50, 92, 54, hat, { shade: false });
    d.eyes([[72, 59], [81, 59]]);
    d.m([[87, 64]], '#e8737b');
    d.m([[30, 66], [36, 72], [42, 64], [50, 70], [24, 74], [58, 64], [34, 78], [46, 76], [62, 72], [72, 64]], '#5a3a14');
  },
  red_fox(d) {
    const fur = M('#f07b22', '#b9540e', '#ffa452');
    d.legendary = true;
    d.e(50, 64, 28, 22, fur, { rim: true });
    d.e(44, 85, 30, 10, fur, { rim: true });
    d.e(17, 85, 9, 7, C.cream, { rim: true });
    d.e(64, 62, 8, 11, C.cream);
    d.p([[50, 29], [48, 8], [60, 23]], fur).p([[66, 23], [76, 6], [78, 27]], fur);
    d.e(62, 37, 16, 14, fur, { rim: true });
    d.e(70, 45, 9, 6, C.cream);
    d.hat(62, 24, 22);
    d.eyes([[57, 35], [68, 35]]).blush([[54, 42], [72, 42]]);
    d.m([[78, 43]], INK).mouth(72, 48);
    d.m([[51, 18], [52, 21], [72, 15], [73, 18]], '#5a2e1e');
  },

  // ===== Green Line =====
  boston_terrier(d) {
    d.e(50, 76, 18, 20, C.black, { rim: true });
    d.e(50, 74, 9, 14, C.white);
    d.r(41, 84, 47, 97, C.white, { rim: true }).r(53, 84, 59, 97, C.white, { rim: true });
    d.p([[33, 35], [24, 6], [45, 27]], C.black).p([[67, 35], [76, 6], [55, 27]], C.black);
    d.e(50, 43, 20, 17, C.black, { rim: true });
    d.r(48, 27, 52, 45, C.white, { shade: false });
    d.e(50, 51, 11, 7, C.white);
    d.hat(50, 27, 20);
    d.eyes([[41, 40], [59, 40]], { onDark: true });
    d.m([[50, 47]], '#18181c').m([[51, 55], [52, 56], [51, 56]], '#ff7a8a');
    d.ml(30, 30, 28, 16, '#e7a7a7').ml(70, 30, 72, 16, '#e7a7a7');
  },
  swan(d) {
    const white = M('#f7f7f5', '#d2d3d6', '#ffffff');
    d.p([[14, 66], [4, 58], [16, 72]], white);
    d.e(42, 72, 28, 13, white, { rim: true });
    d.p([[24, 66], [40, 50], [62, 60], [50, 72]], M('#eceef0', '#c4c8ce', '#ffffff'), { rim: true });
    d.p([[60, 68], [67, 68], [64, 50], [70, 36], [79, 27], [74, 20], [66, 30], [57, 46]], white, { rim: true });
    d.e(76, 22, 7, 6, white, { rim: true });
    d.p([[82, 21], [95, 25], [82, 27]], M('#f28c28', '#c06210', '#ffb35c'), { rim: true });
    d.hat(76, 16, 14);
    d.eyes([[77, 21]]);
    d.m([[82, 21]], '#1e1a1c');
    d.l(30, 64, 50, 58, '#c4c8ce');
    d.ml(4, 88, 96, 88, C.water).ml(14, 93, 86, 93, C.water2);
  },
  bullfrog(d) {
    const skin = M('#6ba83a', '#4a7a26', '#93cc5c');
    d.e(50, 88, 44, 10, M('#3f8f4a', '#2a6634', '#5cb066'));
    d.e(22, 76, 12, 8, skin).e(78, 76, 12, 8, skin);
    d.e(50, 64, 30, 22, skin, { rim: true });
    d.shape(minus(ellipse(50, 72, 20, 14), rect(0, 0, 100, 64)), M('#f1e6a6', '#cbbd78', '#fff8d0'));
    d.e(33, 40, 11, 10, skin, { rim: true }).e(67, 40, 11, 10, skin, { rim: true });
    d.hat(50, 42, 16);
    d.eyes([[33, 40], [67, 40]]).blush([[28, 56], [72, 56]]);
    d.ml(36, 62, 64, 62, INK).m([[34, 60], [66, 60]], INK);
  },
  bu_terrier(d) {
    d.p([[22, 54], [16, 44], [27, 50]], C.black);
    d.r(28, 66, 32, 82, C.black).r(37, 68, 41, 84, C.black).r(54, 68, 58, 84, C.black);
    d.p([[60, 64], [70, 64], [76, 72], [68, 75]], C.black);
    d.e(46, 60, 22, 13, C.black, { rim: true });
    d.shape(minus(ellipse(46, 60, 22, 13), rect(0, 68, 100, 100)), M('#cc0000', '#940000', '#ee3a3a'));
    d.shape(and(ellipse(46, 60, 22, 13), rect(0, 59, 100, 63)), C.white, { shade: false });
    d.p([[63, 36], [61, 18], [72, 31]], C.black);
    d.e(70, 43, 12, 11, C.black, { rim: true });
    d.e(78, 49, 7, 5, C.white);
    d.r(69, 32, 72, 46, C.white, { shade: false });
    d.hat(69, 32, 16);
    d.eyes([[73, 41]], { onDark: true });
    d.m([[84, 47]], '#18181c').m([[82, 53], [83, 54]], '#ff7a8a');
  },
  bc_eagle(d) {
    const brown = M('#4a3524', '#2e2016', '#6b4e35');
    const wing = M('#3e2c1e', '#271b12', '#5c432e');
    d.r(8, 90, 92, 95, M('#7a5a3c', '#523b25', '#9a7a58'));
    d.p([[42, 82], [58, 82], [56, 94], [44, 94]], C.white);
    d.e(50, 64, 18, 22, brown, { rim: true });
    d.e(34, 64, 8, 20, wing, { rim: true }).e(66, 64, 8, 20, wing, { rim: true });
    d.r(42, 86, 47, 91, C.yellowBeak).r(53, 86, 58, 91, C.yellowBeak);
    d.e(50, 33, 14, 12, C.white, { rim: true });
    d.p([[50, 35], [61, 39], [57, 46], [50, 41]], C.yellowBeak, { rim: true });
    d.r(36, 44, 64, 49, M('#7a1f2b', '#55141d', '#9a3443'), { shade: false, rim: true });
    d.r(56, 47, 61, 60, M('#c9a227', '#9a7a14', '#e6c14e'), { shade: false });
    d.hat(49, 22, 20);
    d.eyes([[44, 32], [54, 32]]);
    d.ml(41, 29, 45, 30, '#3a2a1c').ml(53, 30, 57, 29, '#3a2a1c');
  },
  snapping_turtle(d) {
    const shell = M('#4f7b3a', '#345626', '#78a94b');
    const skin = M('#9bb05a', '#6e7f3a', '#c4d184');
    d.legendary = true;
    d.e(58, 58, 24, 28, shell, { rim: true });
    d.l(46, 40, 72, 40, shell.shadow).l(44, 58, 78, 58, shell.shadow).l(46, 76, 74, 76, shell.shadow).l(60, 32, 60, 84, shell.shadow);
    d.m([[52, 36], [68, 48], [56, 66], [72, 70]], '#9fd356');
    d.e(36, 88, 8, 6, skin, { rim: true }).e(58, 88, 8, 6, skin, { rim: true });
    d.e(46, 63, 14, 19, M('#d4b46a', '#a88a43', '#ecd59a'), { rim: true });
    d.l(36, 58, 56, 58, '#a88a43').l(36, 68, 56, 68, '#a88a43');
    d.e(30, 60, 6, 9, skin, { rim: true }).e(64, 58, 6, 9, skin, { rim: true });
    d.e(43, 31, 17, 15, skin, { rim: true });
    d.hat(42, 17, 22);
    d.eyes([[36, 30], [50, 30]]).blush([[32, 37], [54, 37]]).mouth(43, 39);
    d.m([[64, 22], [64, 20], [63, 18], [65, 18]], '#7cc242');
  },

  // ===== Blue Line =====
  blue_jay(d) {
    const blue = M('#3a78c9', '#25518d', '#6fa3e3');
    d.p([[18, 52], [4, 32], [12, 28], [28, 47]], M('#3368b3', '#21477d', '#5a91d6'));
    d.l(8, 34, 14, 32, '#1b1d24').l(12, 40, 18, 38, '#1b1d24');
    d.r(44, 74, 47, 88, M('#55575d', '#3a3c40')).p([[52, 72], [60, 80], [58, 82], [50, 76]], M('#55575d', '#3a3c40'));
    d.e(44, 62, 20, 14, blue, { rim: true });
    d.e(50, 68, 12, 8, C.white);
    d.e(38, 58, 12, 8, M('#3368b3', '#21477d', '#5a91d6'), { rim: true });
    d.p([[60, 37], [57, 20], [70, 34]], blue);
    d.e(66, 44, 12, 11, blue, { rim: true });
    d.e(70, 48, 6, 5, C.white, { shade: false });
    d.p([[76, 44], [87, 46], [76, 48]], C.black, { rim: true });
    d.eyes([[68, 42]]);
    d.ml(60, 54, 74, 54, '#1b1d24').m([[34, 56], [38, 58], [42, 56]], '#ffffff').ml(30, 60, 44, 60, '#1b1d24');
  },
  horseshoe_crab(d) {
    const shell = M('#8a7a4e', '#5f5332', '#b0a06c');
    const rear = M('#7a6b42', '#54492c', '#9a8a5c');
    d.p([[14, 70], [18, 70], [6, 98], [2, 96]], rear);
    d.p([[10, 46], [34, 40], [34, 78], [12, 70]], rear, { rim: true });
    d.e(60, 58, 36, 28, shell, { rim: true });
    d.e(61, 55, 25, 19, M('#9d8d5c', '#6e6140', '#bfae78'));
    d.l(60, 32, 60, 84, shell.shadow);
    d.hat(60, 32, 18);
    d.eyes([[48, 50], [70, 50]]).blush([[42, 60], [78, 60]]).mouth(59, 63);
    d.m([[8, 52], [8, 60], [8, 68]], '#54492c');
  },
  piping_plover(d) {
    const sand = M('#d9c29a', '#a88f65', '#efddb9');
    d.r(0, 88, 100, 100, M('#efe0bd', '#d6c49a'), { shade: false });
    d.ml(46, 72, 38, 86, '#e8902a').ml(54, 72, 62, 84, '#e8902a');
    d.e(48, 62, 18, 13, sand, { rim: true });
    d.e(52, 68, 12, 7, C.white);
    d.e(42, 59, 10, 6, M('#c8b085', '#977f58', '#e2cda5'), { rim: true });
    d.e(64, 46, 11, 10, sand, { rim: true });
    d.p([[74, 46], [83, 47], [74, 49]], C.orange, { rim: true });
    d.hat(63, 36, 16);
    d.eyes([[66, 44]]).blush([[62, 50]]);
    d.ml(56, 55, 72, 55, '#1b1d24').m([[83, 47]], INK);
    d.ml(8, 56, 20, 56, '#c9bba0').ml(4, 64, 18, 64, '#c9bba0').m([[20, 94], [30, 94], [40, 94]], '#c2a978');
  },
  harbor_seal(d) {
    const fur = M('#8e99a6', '#646e7b', '#b4bec9');
    d.p([[2, 82], [14, 72], [16, 86]], fur);
    d.e(42, 76, 34, 15, fur, { rim: true });
    d.e(66, 50, 18, 18, fur, { rim: true });
    d.e(56, 88, 9, 4, fur, { rim: true });
    d.e(76, 56, 8, 6, M('#c3cbd4', '#97a1ad', '#dde3e9'));
    d.hat(66, 32, 20);
    d.eyes([[61, 47], [74, 47]]).blush([[57, 55], [80, 55]]).mouth(76, 60);
    d.m([[80, 54]], INK).m([[24, 70], [34, 76], [44, 68], [18, 78], [50, 78], [30, 66]], '#5a6370');
    d.ml(84, 56, 92, 54, '#4a525d').ml(84, 59, 92, 61, '#4a525d');
  },
  penguin(d) {
    const back = M('#2b2d35', '#1a1b20', '#44474f');
    d.r(34, 90, 46, 96, C.orange).r(54, 90, 66, 96, C.orange);
    d.e(18, 58, 7, 18, back, { rim: true }).e(82, 58, 7, 18, back, { rim: true });
    d.e(50, 56, 28, 36, back, { rim: true });
    d.e(50, 64, 20, 25, C.white);
    d.e(50, 30, 16, 11, C.white);
    d.l(30, 54, 70, 54, back.base);
    d.hat(50, 21, 22);
    d.eyes([[42, 32], [58, 32]]).blush([[36, 40], [64, 40]]);
    d.m([[48, 38], [50, 38], [52, 38], [50, 40]], '#e8902a');
    d.m([[38, 30], [62, 30]], '#ff9fb1').m([[44, 66], [56, 72], [40, 76]], '#2b2d35');
  },
  humpback_whale(d) {
    const body = M('#3f6ea6', '#294d7a', '#6194cb');
    d.legendary = true;
    d.p([[22, 52], [10, 40], [2, 26], [12, 30], [16, 18], [22, 32], [30, 46]], body, { rim: true });
    d.e(54, 58, 38, 22, body, { rim: true });
    d.shape(minus(ellipse(58, 66, 30, 13), rect(0, 0, 100, 62)), M('#dceaf5', '#a8c1d7', '#f4f9fd'));
    d.l(36, 68, 80, 68, '#a8c1d7').l(40, 74, 76, 74, '#a8c1d7');
    d.p([[48, 66], [58, 70], [42, 92], [36, 88]], M('#e8f1f8', '#b2c7d9', '#ffffff'), { rim: true });
    d.hat(62, 37, 24);
    d.eyes([[72, 56]]).blush([[68, 63]]).mouth(80, 64);
    d.m([[64, 42], [72, 44], [80, 48]], '#294d7a');
  },

  // ===== Silver Line =====
  herring_gull(d) {
    const wing = M('#a9b2bd', '#7d8794', '#c8cfd8');
    d.p([[50, 50], [62, 14], [72, 18], [58, 52]], M('#959fab', '#6c7683', '#b6bec9'));
    d.p([[26, 58], [12, 52], [14, 66]], C.white);
    d.e(48, 60, 22, 11, C.white, { rim: true });
    d.p([[40, 54], [22, 16], [34, 13], [52, 50]], wing, { rim: true });
    d.e(70, 51, 9, 8, C.white, { rim: true });
    d.p([[76, 49], [91, 47], [78, 53]], C.yellowBeak, { rim: true });
    d.p([[76, 55], [89, 59], [77, 57]], C.yellowBeak, { rim: true });
    d.hat(69, 43, 14);
    d.eyes([[72, 49]]);
    d.m([[86, 57]], '#e0352b').m([[22, 17], [26, 16], [24, 19], [62, 15], [66, 16], [12, 54], [14, 58]], '#2b2b30');
    d.ml(44, 70, 42, 76, '#e58a8a').ml(52, 70, 54, 76, '#e58a8a');
  },
  striped_bass(d) {
    const fin = M('#a9b8c5', '#7b8b99', '#cdd8e1');
    d.p([[16, 82], [2, 94], [6, 72]], fin);
    d.p([[34, 38], [46, 20], [58, 32]], fin);
    d.e(50, 56, 38, 17, M('#c9d3dc', '#93a1ae', '#eef3f7'), { rim: true, rot: -32 });
    d.shape(and(ellipse(50, 56, 38, 17, -32), (x, y) => y < 104 - x * 1.1), M('#5d7a8f', '#3f5768', '#7d9bb0'));
    for (const k of [0, 7, 14]) d.l(26 + k, 74 - k, 70 + k, 44 - k, '#3f4a55');
    d.p([[80, 26], [92, 22], [86, 34]], M('#3a2a32', '#241a20'));
    d.hat(70, 30, 16);
    d.eyes([[76, 34]]).blush([[70, 42]]);
    d.m([[92, 12], [86, 8], [96, 6]], '#9fd8ff');
  },
  moon_jellyfish(d) {
    const bell = M('#ddd6f7', '#b2a6e2', '#f4f0ff');
    for (const x of [30, 42, 58, 70]) d.ml(x, 54, x - 4, 68, '#c9bdf0').ml(x - 4, 68, x + 3, 82, '#c9bdf0').ml(x + 3, 82, x, 96, '#c9bdf0');
    d.shape(minus(ellipse(50, 48, 36, 30), rect(0, 54, 100, 100)), bell, { rim: true });
    d.r(14, 50, 86, 56, M('#cfc6f2', '#a99bdd'), { shade: false });
    for (const [x, y] of [[33, 36], [50, 28], [67, 36]]) d.e(x, y, 6, 5, M('#a58be0', '#7d63c0', '#c4adf0'), { shade: false });
    d.hat(50, 18, 18);
    d.eyes([[40, 42], [60, 42]]).blush([[34, 48], [66, 48]]).mouth(50, 47);
  },
  atlantic_cod(d) {
    const body = M('#9a8f5e', '#6e6540', '#bdb37e');
    const fin = M('#857a4c', '#5c5434', '#a69a68');
    d.p([[42, 34], [50, 16], [58, 34]], fin);
    d.p([[22, 54], [6, 44], [8, 66]], fin).p([[78, 54], [94, 44], [92, 66]], fin);
    d.e(50, 56, 30, 25, body, { rim: true });
    d.e(50, 66, 18, 10, M('#e3dcc0', '#bdb491', '#f4efdb'));
    d.e(50, 67, 7, 4, M('#7a5a4a', '#55392e'), { shade: false });
    d.hat(50, 32, 20);
    d.eyes([[38, 50], [62, 50]]).blush([[32, 58], [68, 58]]);
    d.ml(50, 72, 50, 80, '#5c5434');
    d.m([[30, 44], [70, 44], [26, 60], [74, 60], [40, 40], [60, 40]], '#5c5434');
  },
  peregrine_falcon(d) {
    const slate = M('#5b6b80', '#3d4a5a', '#7f90a6');
    const wing = M('#4f5e72', '#344050', '#71839a');
    // diving down-right: tail up top-left, wings swept back along the body
    d.p([[18, 22], [28, 12], [36, 30]], wing);
    d.p([[20, 44], [56, 42], [52, 62]], wing, { rim: true });
    d.p([[42, 14], [68, 42], [56, 48]], wing, { rim: true });
    d.e(52, 50, 24, 11, slate, { rim: true, rot: 42 });
    d.e(56, 54, 14, 6, M('#f3ede1', '#cbc3b1', '#ffffff'), { rot: 42 });
    d.e(72, 70, 10, 9, M('#2e3644', '#1c222c', '#47505f'), { rim: true });
    d.e(75, 73, 5, 4, C.white, { shade: false });
    d.p([[79, 72], [86, 80], [79, 79]], M('#3c3f46', '#25272c'), { rim: true });
    d.hat(71, 61, 14);
    d.eyes([[73, 68]], { onDark: true });
    d.ml(8, 40, 20, 46, '#c4cbd6').ml(14, 54, 28, 60, '#c4cbd6').ml(30, 20, 38, 30, '#c4cbd6');
  },
  snowy_owl(d) {
    const feather = M('#f7f9fc', '#ccd4e0', '#ffffff');
    const wing = M('#e6ebf2', '#b7c1cf', '#f7f9fc');
    d.legendary = true;
    d.r(38, 88, 46, 94, M('#e2c98f', '#b39859')).r(54, 88, 62, 94, M('#e2c98f', '#b39859'));
    d.e(50, 64, 27, 26, feather, { rim: true });
    d.e(26, 66, 11, 20, wing, { rim: true }).e(74, 66, 11, 20, wing, { rim: true });
    d.e(50, 35, 25, 20, feather, { rim: true });
    // big yellow eyes: the snowy owl's signature
    d.e(39, 34, 7, 7, M('#f6c21c', '#c99510', '#ffe36b'), { rim: true }).e(61, 34, 7, 7, M('#f6c21c', '#c99510', '#ffe36b'), { rim: true });
    d.hat(50, 15, 24);
    d.eyes([[39, 34], [61, 34]]).blush([[30, 44], [70, 44]]);
    d.m([[48, 40], [50, 40], [52, 40], [50, 42]], '#4b4f5c');
    d.m([[40, 64], [52, 70], [60, 62], [46, 78], [34, 72], [58, 78], [24, 58], [76, 60], [28, 74], [72, 74]], '#323844');
  },
};

// ---------- PNG ----------
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- main ----------
/** The style the app uses. */
const APP_STYLE = 'old_style';

function draw(style, id, closed) {
  const d = new Drawer(style, { closed });
  PETS[id](d);
  return d.finish();
}

function writePet(dir, id, style, cells, closed) {
  const size = style.n * style.scale;
  writeFileSync(
    path.join(dir, `${id}${closed ? '-blink' : ''}.png`),
    png(size, size, (x, y) => {
      const c = cells[Math.floor(y / style.scale)][Math.floor(x / style.scale)];
      return c ? [...rgb(c.color), 255] : [0, 0, 0, 0];
    }),
  );
}

/** _sheet.png: every pet in roster order, 7 per row, on a light checkerboard. */
function writeSheet(dir, style, sheet) {
  const cell = 4 * (48 / style.n); // so both styles' sheets come out the same size
  const tile = style.n * cell;
  const gap = 8;
  const cols = 7;
  const rows = Math.ceil(sheet.length / cols);
  writeFileSync(
    path.join(dir, '_sheet.png'),
    png(cols * (tile + gap) + gap, rows * (tile + gap) + gap, (x, y) => {
      const col = Math.floor((x - gap) / (tile + gap));
      const row = Math.floor((y - gap) / (tile + gap));
      const i = row * cols + col;
      const fx = x - gap - col * (tile + gap);
      const fy = y - gap - row * (tile + gap);
      if (col >= 0 && col < cols && i < sheet.length && fx >= 0 && fx < tile && fy >= 0 && fy < tile) {
        const c = sheet[i][Math.floor(fy / cell)][Math.floor(fx / cell)];
        if (c) return [...rgb(c.color), 255];
      }
      const v = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 ? 226 : 238;
      return [v, v, v, 255];
    }),
  );
}

// 1. The app's art: every pet in APP_STYLE, with its blink frame, plus the art map.
{
  const style = STYLES[APP_STYLE];
  const dir = path.join(ROOT, 'assets', 'pets');
  mkdirSync(dir, { recursive: true });
  for (const id of Object.keys(PETS)) for (const closed of [false, true]) writePet(dir, id, style, draw(style, id, closed), closed);
  const entries = Object.keys(PETS)
    .sort()
    .map((id) => `  ${id}: { base: require('../../assets/pets/${id}.png'), blink: require('../../assets/pets/${id}-blink.png') },`);
  writeFileSync(
    path.join(ROOT, 'src', 'lib', 'pixelPetArt.ts'),
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
  console.log(`${APP_STYLE}: ${entries.length} pets + blink frames -> assets/pets, art map -> src/lib/pixelPetArt.ts`);
}

// 2. --proposed: both styles side by side for comparison.
if (process.argv.includes('--proposed')) {
  for (const [styleName, style] of Object.entries(STYLES)) {
    const dir = path.join(ROOT, 'assets', 'proposed', styleName);
    mkdirSync(dir, { recursive: true });
    const sheet = [];
    for (const id of Object.keys(PETS)) {
      for (const closed of [false, true]) {
        const cells = draw(style, id, closed);
        writePet(dir, id, style, cells, closed);
        if (!closed) sheet.push(cells);
      }
    }
    writeSheet(dir, style, sheet);
    console.log(`${styleName}: ${Object.keys(PETS).length} pets + blink frames + _sheet.png -> assets/proposed/${styleName}`);
  }
}
