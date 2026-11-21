// Pixel art for the pull reveal, drawn as rows of palette keys (see PixelSprite).
// Vehicles face left: they pull in from the right side of the screen.
//
// Vehicle keys: k outline, b body (line color), d body shade, l white stripe, w window, h window glint,
// y headlight, i lit interior (the doorway), g undercarriage, t tire, r rim
import type { Palette } from './PixelSprite';

export const VEHICLE_COLS = 40;
export const DOOR_COLS = 6; // the doorway; each door panel covers half of it
export const DOOR_ROWS = 11;

export type Vehicle = { rows: readonly string[]; door: { col: number; row: number } };

export const TRAIN: Vehicle = {
  door: { col: 18, row: 3 },
  rows: [
    '...kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    '..kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk',
    '.kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk',
    'kbbbbbbbbbbbbbbbbkiiiiiikbbbbbbbbbbbbbbk',
    'kwwwbbwwwwwwwwwbbkiiiiiikbbwwwwwwwwwwbbk',
    'khwwbbhwwwwwwwwbbkiiiiiikbbhwwwwwwwwwbbk',
    'kwwwbbwwwwwwwwwbbkiiiiiikbbwwwwwwwwwwbbk',
    'kwwwbbwwwwwwwwwbbkiiiiiikbbwwwwwwwwwwbbk',
    'kbbbbbbbbbbbbbbbbkiiiiiikbbbbbbbbbbbbbbk',
    'kllllllllllllllllkiiiiiikllllllllllllllk',
    'kbbbbbbbbbbbbbbbbkiiiiiikbbbbbbbbbbbbbbk',
    'kybbbbbbbbbbbbbbbkiiiiiikbbbbbbbbbbbbbbk',
    'kddddddddddddddddkiiiiiikddddddddddddddk',
    'kddddddddddddddddkiiiiiikddddddddddddddk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    '.gggggggggggggggggggggggggggggggggggggg.',
    '...trrt...trrt............trrt...trrt...',
    '....tt.....tt..............tt.....tt....',
  ],
};

/** Silver Line: a bus, with its door near the front. */
export const BUS: Vehicle = {
  door: { col: 8, row: 2 },
  rows: [
    '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
    '.kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk',
    'kbbbbbbkiiiiiikbbbbbbbbbbbbbbbbbbbbbbbbk',
    'kwwwwbbkiiiiiikbwwwwwwwwbwwwwwwwwbwwwwbk',
    'khwwwbbkiiiiiikbhwwwwwwwbhwwwwwwwbhwwwbk',
    'kwwwwbbkiiiiiikbwwwwwwwwbwwwwwwwwbwwwwbk',
    'kwwwwbbkiiiiiikbwwwwwwwwbwwwwwwwwbwwwwbk',
    'kwwwwbbkiiiiiikbwwwwwwwwbwwwwwwwwbwwwwbk',
    'kbbbbbbkiiiiiikbbbbbbbbbbbbbbbbbbbbbbbbk',
    'kllllllkiiiiiikllllllllllllllllllllllllk',
    'kybbbbbkiiiiiikbbbbbbbbbbbbbbbbbbbbbbbbk',
    'kddddddkiiiiiikddddddddddddddddddddddddk',
    'kddddddkiiiiiikddddddddddddddddddddddddk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    '.gggggggggggggggggggggggggggggggggggggg.',
    '...trrt.......................trrt......',
    '....tt.........................tt.......',
  ],
};

/** Door panels sit over the doorway and slide apart. The stripe row lines up with the body stripe. */
export const DOOR_LEFT = ['bbk', 'bwk', 'bhk', 'bwk', 'bwk', 'bbk', 'llk', 'bbk', 'bbk', 'ddk', 'ddk'];
export const DOOR_RIGHT = ['kbb', 'kwb', 'khb', 'kwb', 'kwb', 'kbb', 'kll', 'kbb', 'kbb', 'kdd', 'kdd'];

/** Fare card. L = line-color stripe, c = chip, s = printed lines. */
export const CARD = [
  'kkkkkkkkkkkkkkkk',
  'kLLLLLLLLLLLLLLk',
  'kLLLLLLLLLLLLLLk',
  'kwwwwwwwwwwwwwwk',
  'kwccwwwwwwwwwwwk',
  'kwccwwwwwwwwwwwk',
  'kwwwwwwwwwwssssk',
  'kwwwwwwwwwwwwwwk',
  'kwwwwssssssswwwk',
  'kkkkkkkkkkkkkkkk',
];

/** Fare reader on a post. m = screen, o = tap target, a = status light. */
export const READER = [
  '.kkkkkkkkkk.',
  'kssssssssssk',
  'ksmmmmmmmmsk',
  'ksmmoooommsk',
  'ksmommmmomsk',
  'ksmommmmomsk',
  'ksmmoooommsk',
  'ksmmmmmmmmsk',
  'kssssssssssk',
  'kssssaassssk',
  'kssssssssssk',
  'kkkkkkkkkkkk',
  '....kssk....',
  '....kssk....',
  '....kssk....',
  '...kkkkkk...',
];

export const SPARKLE = ['..c..', '..c..', 'ccWcc', '..c..', '..c..'];

export const SHADOW = ['..kkkkkk..', '.kkkkkkkk.', '..kkkkkk..'];

/** Lightens (amount > 0) or darkens (amount < 0) a #RRGGBB color. */
export function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function vehiclePalette(lineColor: string): Palette {
  return {
    k: '#10131C',
    b: lineColor,
    d: shade(lineColor, -0.3),
    l: '#F4F1E8',
    w: '#79B4E3',
    h: '#D8F0FF',
    y: '#FFE066',
    i: '#FFE9B0',
    g: '#2B303D',
    t: '#1A1D26',
    r: '#8A91A3',
  };
}

export function cardPalette(lineColor: string): Palette {
  return { k: '#10131C', L: lineColor, w: '#F7F5EF', c: '#E8B923', s: '#B9BECB' };
}

export const READER_PALETTE: Palette = { k: '#10131C', s: '#A7AEBD', m: '#1B2B3A', o: '#5FE3C0', a: '#3BFF8A' };
export const SHADOW_PALETTE: Palette = { k: 'rgba(0,0,0,0.22)' };

export function sparklePalette(color: string): Palette {
  return { c: color, W: '#FFFFFF' };
}

/** Level-up arrow: rises from the pet. */
export const ARROW = ['...k...', '..kck..', '.kccck.', 'kccccck', '.kccck.', '.kccck.', '.kkkkk.'];
export const ARROW_PALETTE: Palette = { k: '#10131C', c: '#4ADE80' };
