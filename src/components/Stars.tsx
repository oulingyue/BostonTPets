import { levelFromCopies, MAX_LEVEL } from '@game/catalog';
import { Text } from 'react-native';

type Props = {
  copies: number;
  /** Show this level instead of deriving it from copies (the reveal passes EXP-based levels). */
  level?: number;
  size?: number;
};

export function Stars({ copies, level: levelOverride, size = 14 }: Props) {
  const level = levelOverride ?? levelFromCopies(copies);
  const extra = levelOverride === undefined && copies > MAX_LEVEL ? ` +${copies - MAX_LEVEL}` : '';
  return (
    <Text style={{ fontSize: size, color: '#E8A100' }} accessibilityLabel={`Level ${level}`}>
      {'★'.repeat(level)}
      <Text style={{ color: '#CFCFCF' }}>{'★'.repeat(Math.max(0, MAX_LEVEL - level))}</Text>
      <Text style={{ color: '#6B6B6B', fontSize: size * 0.85 }}>{extra}</Text>
    </Text>
  );
}
