import { levelFromCopies, MAX_LEVEL } from '@game/catalog';
import { Text } from 'react-native';

export function Stars({ copies, size = 14 }: { copies: number; size?: number }) {
  const level = levelFromCopies(copies);
  const extra = copies > MAX_LEVEL ? ` +${copies - MAX_LEVEL}` : '';
  return (
    <Text style={{ fontSize: size, color: '#E8A100' }} accessibilityLabel={`Level ${level}`}>
      {'★'.repeat(level)}
      <Text style={{ color: '#CFCFCF' }}>{'★'.repeat(MAX_LEVEL - level)}</Text>
      <Text style={{ color: '#6B6B6B', fontSize: size * 0.85 }}>{extra}</Text>
    </Text>
  );
}
