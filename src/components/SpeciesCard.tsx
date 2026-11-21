import { getPet } from '@game/catalog';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OwnedPet } from '@/lib/api';
import { colors, spacing } from '@/theme';
import { PetBadge } from './PetBadge';

type Props = { petId: string; owned?: OwnedPet; onPress: () => void };

/** Temporary one-pet card. Collection layout belongs to the collection teammate. */
export function SpeciesCard({ petId, owned, onPress }: Props) {
  const info = getPet(petId);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]} onPress={onPress}>
      <PetBadge petId={petId} owned={!!owned} isGold={owned?.is_gold} size={48} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={2}>
          {info?.name ?? petId}
        </Text>
        <Text style={styles.rarity}>{owned ? (owned.is_gold ? 'gold' : 'collected') : (info?.rarity ?? '')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  rarity: { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
});
