import { levelFromCopies, MAX_LEVEL } from '@game/catalog';
import { Text } from 'react-native';
import { usePalette } from '@/theme';

type Props = {
  copies: number;
  /** Show this level instead of deriving it from copies (the reveal passes EXP-based levels). */
  level?: number;
  size?: number;
};

export function Stars({ copies, level: levelOverride, size = 14 }: Props) {
  const c = usePalette();
  const level = levelOverride ?? levelFromCopies(copies);
  const extra = levelOverride === undefined && copies > MAX_LEVEL ? ` +${copies - MAX_LEVEL}` : '';
  return (
    <Text style={{ fontSize: size, color: c.scheme === 'dark' ? '#FFD84D' : '#C98A00' }} accessibilityLabel={`Level ${level}`}>
      {'★'.repeat(level)}
      <Text style={{ color: c.scheme === 'dark' ? '#3A4560' : '#C9C1AC' }}>{'★'.repeat(Math.max(0, MAX_LEVEL - level))}</Text>
      <Text style={{ color: c.muted, fontSize: size * 0.85 }}>{extra}</Text>
    </Text>
  );
}
