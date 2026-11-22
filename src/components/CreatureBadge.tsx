import { getPet } from '@game/catalog';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OwnedPet } from '@/lib/api';
import { fonts, useStyles, type Palette } from '@/theme';
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

const TILE = 62;

/**
 * One cell of the collection grid: the pet's badge, name and rarity.
 * Gold pets get PetBadge's gold ring, GOLD stamp, and shine.
 * Pets the player hasn't found show as a silhouette named "???".
 */
export function CreatureBadge({ petId, owned, equipped, width, onPress }: Props) {
  const styles = useStyles(makeStyles);
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
        <PetBadge petId={petId} owned={isOwned} isGold={owned?.is_gold} size={TILE} />
        {equipped && (
          <View style={styles.equippedDot} accessibilityLabel="Equipped">
            <Text style={styles.equippedDotText}>●</Text>
          </View>
        )}
      </View>
      <Text style={[styles.name, !isOwned && styles.unknown]} numberOfLines={2}>
        {isOwned ? pet.name : '???'}
      </Text>
      {pet.rarity === 'legendary' ? (
        // Gold text dark enough to read looks brown, so legendaries get a gold pill instead (dimmed until found).
        <Text style={[styles.rarity, styles.legendaryPill, !isOwned && { opacity: 0.55 }]}>{rarityLabel}</Text>
      ) : (
        <Text style={[styles.rarity, isOwned ? styles[pet.rarity] : styles.unknown]}>{rarityLabel}</Text>
      )}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    badge: { alignItems: 'center' },
    art: { marginBottom: 6, position: 'relative' },
    equippedDot: {
      position: 'absolute',
      right: -4,
      top: -4,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.scheme === 'dark' ? c.shadow : c.border,
      borderRadius: 9,
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    equippedDotText: { color: c.onAccent, fontSize: 9, lineHeight: 11, fontWeight: '900' },
    name: { fontFamily: fonts.heavy, fontSize: 12, lineHeight: 14, color: c.text, textAlign: 'center', minHeight: 28 },
    unknown: { color: c.muted },
    rarity: { fontFamily: fonts.heavy, fontSize: 10, marginTop: 1 },
    common: { color: c.rarity.common.fg },
    rare: { color: c.rarity.rare.fg },
    epic: { color: c.rarity.epic.fg },
    legendary: { color: c.rarity.legendary.fg },
    legendaryPill: {
      backgroundColor: c.rarity.legendary.bg,
      color: c.rarity.legendary.fg,
      borderWidth: 1.5,
      borderColor: c.scheme === 'dark' ? c.shadow : c.border,
      paddingHorizontal: 8,
      paddingVertical: 1,
      borderRadius: 999,
      overflow: 'hidden',
    },
  });
