import { memo } from 'react';
import { View } from 'react-native';

// Pixel icons drawn from tiny bitmaps: '#' is a filled pixel. Each row's runs become one View,
// so an icon is a few dozen Views at most and needs no SVG library.
const ICONS = {
  habitat: [
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '.##########.',
    '############',
    '.##......##.',
    '.##.####.##.',
    '.##.#..#.##.',
    '.##.#..#.##.',
    '.##.#..#.##.',
    '.##########.',
  ],
  collection: [
    '............',
    '.####..####.',
    '#....##....#',
    '#....##....#',
    '#....##....#',
    '#....##....#',
    '#....##....#',
    '#....##....#',
    '#....##....#',
    '#.###..###.#',
    '.####..####.',
    '............',
  ],
  scan: [
    '............',
    '....####....',
    '.##########.',
    '#..........#',
    '#....##....#',
    '#...#..#...#',
    '#...#..#...#',
    '#....##....#',
    '#..........#',
    '.##########.',
    '............',
    '............',
  ],
  leaderboard: [
    '............',
    '.##########.',
    '#.########.#',
    '#.########.#',
    '.#.######.#.',
    '...######...',
    '....####....',
    '.....##.....',
    '.....##.....',
    '....####....',
    '...######...',
    '............',
  ],
  profile: [
    '....####....',
    '...######...',
    '...######...',
    '...######...',
    '....####....',
    '............',
    '..########..',
    '.##########.',
    '.##########.',
    '.##########.',
    '.##########.',
    '............',
  ],
  back: ['....##', '...##.', '..##..', '.##...', '..##..', '...##.', '....##'],
  plus: ['...##...', '...##...', '...##...', '########', '########', '...##...', '...##...', '...##...'],
  swap: [
    '.....#..',
    '.....##.',
    '########',
    '.....##.',
    '.##..#..',
    '##......',
    '########',
    '.##.....',
  ],
} as const;

export type PixelIconName = keyof typeof ICONS;

type Run = { x: number; y: number; w: number };

function runsOf(rows: readonly string[]): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      const on = row[x] === '#';
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        runs.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  });
  return runs;
}

const RUNS = Object.fromEntries(Object.entries(ICONS).map(([name, rows]) => [name, runsOf(rows)])) as Record<
  PixelIconName,
  Run[]
>;

/** A pixel icon `size` points tall, in `color`. */
export const PixelIcon = memo(function PixelIcon({
  name,
  size = 24,
  color,
}: {
  name: PixelIconName;
  size?: number;
  color: string;
}) {
  const rows = ICONS[name];
  const px = size / rows.length;
  return (
    <View style={{ width: rows[0].length * px, height: size }} accessible={false}>
      {RUNS[name].map((r, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: r.x * px, top: r.y * px, width: r.w * px, height: px, backgroundColor: color }}
        />
      ))}
    </View>
  );
});
