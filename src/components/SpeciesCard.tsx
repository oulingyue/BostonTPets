import { GOLD_COLOR, LINE_INFO, LINES, SPECIES_INFO, type Species } from '@game/catalog';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OwnedPet } from '@/lib/api';
import { colors, spacing } from '@/theme';

type Props = { species: Species; owned: OwnedPet[]; onPress: () => void };

/** One card per species, with a dot per T line: filled = collected, ring = gold. */
export function SpeciesCard({ species, owned, onPress }: Props) {
  const info = SPECIES_INFO[species];
  const byLine = new Map(owned.filter((p) => p.species === species).map((p) => [p.line, p]));

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{info.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{info.name}</Text>
          <Text style={styles.rarity}>{info.rarity}</Text>
        </View>
      </View>
      <View style={styles.dots}>
        {LINES.map((line) => {
          const pet = byLine.get(line);
          return (
            <View
              key={line}
              accessibilityLabel={`${LINE_INFO[line].name}: ${pet ? 'collected' : 'not found'}`}
              style={[
                styles.dot,
                pet
                  ? { backgroundColor: LINE_INFO[line].color }
                  : { borderWidth: 2, borderColor: LINE_INFO[line].color },
                pet?.is_gold && { borderWidth: 3, borderColor: GOLD_COLOR },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.count}>
        {byLine.size}/{LINES.length}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emoji: { fontSize: 32 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  rarity: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  count: { fontSize: 13, color: colors.muted, fontWeight: '600' },
});
