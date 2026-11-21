import { getPet, LINE_INFO } from '@game/catalog';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OwnedPet } from '@/lib/api';
import { colors, rarityStyle } from '@/theme';
import { PetBadge } from './PetBadge';

type Props = {
  /** Catalog pet id, e.g. `lobster` or `red_line_lobster`. */
  petId: string;
  /** The player's user_pets row for this pet, if they own it. */
  owned?: OwnedPet;
  width: number;
  onPress: () => void;
};

const CIRCLE = 52;
const RING = 4;

/**
 * One cell of the collection grid: the pet's badge, name and rarity.
 * Line variants get an outer ring in their line color; gold pets get PetBadge's gold border.
 * Pets the player hasn't found show as a silhouette named "???".
 */
export function CreatureBadge({ petId, owned, width, onPress }: Props) {
  const pet = getPet(petId);
  if (!pet) return null;
  const isOwned = !!owned;
  const ring = pet.isLineVariant && pet.line ? LINE_INFO[pet.line].color : 'transparent';
  const rarityLabel = pet.rarity[0].toUpperCase() + pet.rarity.slice(1);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isOwned ? `${pet.name}, ${rarityLabel}` : `Not found yet, ${rarityLabel}`}
      style={({ pressed }) => [styles.badge, { width, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.ring, { borderColor: isOwned ? ring : pet.isLineVariant ? colors.locked : 'transparent' }]}>
        <PetBadge petId={petId} owned={isOwned} isGold={owned?.is_gold} size={CIRCLE} />
      </View>
      <Text style={[styles.name, !isOwned && { color: colors.muted }]} numberOfLines={2}>
        {isOwned ? (pet.isLineVariant ? pet.name.replace(/ Line /, ' ') : pet.name) : '???'}
      </Text>
      <Text style={[styles.rarity, { color: isOwned ? rarityStyle[pet.rarity].fg : colors.muted }]}>{rarityLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center' },
  ring: {
    width: CIRCLE + RING * 2 + 4,
    height: CIRCLE + RING * 2 + 4,
    borderRadius: (CIRCLE + RING * 2 + 4) / 2,
    borderWidth: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  name: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center', minHeight: 28 },
  rarity: { fontSize: 10, fontWeight: '700', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
});
