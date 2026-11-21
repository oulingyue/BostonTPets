import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/** Maps each character in a sprite's rows to a color. Characters without a color are transparent. */
export type Palette = Readonly<Record<string, string>>;

type Run = { x: number; y: number; w: number; color: string };

/** Merges each row's same-colored pixels into runs, so a sprite is a few dozen Views instead of hundreds. */
export function toRuns(rows: readonly string[], palette: Palette): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      const color = palette[row[x]];
      if (color) runs.push({ x, y, w: end - x, color });
      x = end;
    }
  });
  return runs;
}

type Props = {
  rows: readonly string[];
  palette: Palette;
  /** Size of one sprite pixel in screen points. Use whole numbers so rows meet without seams. */
  pixel: number;
  style?: StyleProp<ViewStyle>;
};

/** Draws pixel art from rows of characters, e.g. ['.kk.', 'kbbk']. */
export const PixelSprite = memo(function PixelSprite({ rows, palette, pixel, style }: Props) {
  const runs = useMemo(() => toRuns(rows, palette), [rows, palette]);
  const cols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return (
    <View style={[{ width: cols * pixel, height: rows.length * pixel }, style]}>
      {runs.map((run, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: run.x * pixel,
            top: run.y * pixel,
            width: run.w * pixel,
            height: pixel,
            backgroundColor: run.color,
          }}
        />
      ))}
    </View>
  );
});
