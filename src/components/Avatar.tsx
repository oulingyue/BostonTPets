import { LINE_INFO, LINES } from '@game/catalog';
import { StyleSheet, Text, View } from 'react-native';

// Text color per line color, picked for contrast (white fails on orange and silver).
const TEXT_ON: Record<(typeof LINES)[number], string> = {
  red: '#FFFFFF',
  orange: '#1B1B1B',
  green: '#FFFFFF',
  blue: '#FFFFFF',
  silver: '#1B1B1B',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Initials on a circle in a line color. The color is derived from `seed` so it stays the same per user. */
export function Avatar({ name, seed, size = 44 }: { name: string; seed: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const line = LINES[Math.abs(hash) % LINES.length];

  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: LINE_INFO[line].color }]}
      accessible={false}
    >
      <Text style={{ color: TEXT_ON[line], fontSize: size * 0.36, fontWeight: '800' }}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
