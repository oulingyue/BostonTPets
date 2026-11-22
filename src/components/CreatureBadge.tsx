import { getPet } from '@game/catalog';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OwnedPet } from '@/lib/api';
import { colors, rarityStyle } from '@/theme';
import { PetBadge } from './PetBadge';

type Props = {
  /** Catalog pet id, e.g. `lobster`. */
  petId: string;
  /** The player's user_pets row for this pet, if they own it. */
  owned?: OwnedPet;
  width: number;
  onPress: () => void;
};

const CIRCLE = 56;

/**
 * One cell of the collection grid: the pet's badge, name and rarity.
 * Rainbow pets (is_gold) cycle through the rainbow and get PetBadge's RAINBOW stamp.
 * Pets the player hasn't found show as a silhouette named "???".
 */
export function CreatureBadge({ petId, owned, width, onPress }: Props) {
  const pet = getPet(petId);
  if (!pet) return null;
  const isOwned = !!owned;
  const rarityLabel = pet.rarity[0].toUpperCase() + pet.rarity.slice(1);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isOwned ? `${pet.name}, ${rarityLabel}` : `Not found yet, ${rarityLabel}`}
      style={({ pressed }) => [styles.badge, { width, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.art}>
        <PetBadge petId={petId} owned={isOwned} isGold={owned?.is_gold} size={CIRCLE} />
      </View>
      <Text style={[styles.name, !isOwned && { color: colors.muted }]} numberOfLines={2}>
        {isOwned ? pet.name : '???'}
      </Text>
      <Text style={[styles.rarity, { color: isOwned ? rarityStyle[pet.rarity].fg : colors.muted }]}>{rarityLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center' },
  art: { marginBottom: 6 },
  name: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center', minHeight: 28 },
  rarity: { fontSize: 10, fontWeight: '700', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
});
