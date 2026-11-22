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
  equipped?: boolean;
  width: number;
  onPress: () => void;
};

const CIRCLE = 56;

/**
 * One cell of the collection grid: the pet's badge, name and rarity.
 * Gold pets get PetBadge's gold ring, GOLD stamp, and shine.
 * Pets the player hasn't found show as a silhouette named "???".
 */
export function CreatureBadge({ petId, owned, equipped, width, onPress }: Props) {
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
        {equipped && (
          <View style={styles.equippedDot} accessibilityLabel="Equipped">
            <Text style={styles.equippedDotText}>●</Text>
          </View>
        )}
      </View>
      <Text style={[styles.name, !isOwned && { color: colors.muted }]} numberOfLines={2}>
        {isOwned ? pet.name : '???'}
      </Text>
      {pet.rarity === 'legendary' ? (
        // Gold text dark enough to read looks brown, so legendaries get a gold pill instead (dimmed until found).
        <Text style={[styles.rarity, styles.legendaryPill, !isOwned && { opacity: 0.55 }]}>{rarityLabel}</Text>
      ) : (
        <Text style={[styles.rarity, { color: isOwned ? rarityStyle[pet.rarity].fg : colors.muted }]}>{rarityLabel}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center' },
  art: { marginBottom: 6, position: 'relative' },
  equippedDot: {
    position: 'absolute',
    right: -2,
    top: -2,
    backgroundColor: colors.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equippedDotText: { color: '#fff', fontSize: 10, lineHeight: 12, fontWeight: '900' },
  name: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center', minHeight: 28 },
  rarity: { fontSize: 10, fontWeight: '700', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  legendaryPill: {
    backgroundColor: rarityStyle.legendary.bg,
    color: rarityStyle.legendary.fg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
