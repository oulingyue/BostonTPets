import { CATALOG, getPet, type Pet } from '@game/catalog';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PetBadge } from '@/components/PetBadge';
import { Stars } from '@/components/Stars';
import type { PublicPet } from '@/lib/api';
import { colors, spacing } from '@/theme';

const CATALOG_ORDER = Object.keys(CATALOG);

/** Catalog order. Pets whose pet_id this app version doesn't know are skipped. */
function sortPets<P extends PublicPet>(pets: P[]): { pet: P; info: Pet }[] {
  return pets
    .flatMap((pet) => {
      const info = getPet(pet.pet_id);
      return info ? [{ pet, info }] : [];
    })
    .sort((a, b) => CATALOG_ORDER.indexOf(a.info.petId) - CATALOG_ORDER.indexOf(b.info.petId));
}

/** Owned pets, 4 per row. Tap one to open its detail sheet. */
export function PetGrid<P extends PublicPet>({
  pets,
  onPressPet,
  emptyText,
}: {
  pets: P[];
  onPressPet: (pet: P) => void;
  emptyText: string;
}) {
  if (pets.length === 0) return <Text style={styles.empty}>{emptyText}</Text>;

  return (
    <View style={styles.grid}>
      {sortPets(pets).map(({ pet, info }) => {
        return (
          <Pressable
            key={pet.pet_id}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
            onPress={() => onPressPet(pet)}
            accessibilityRole="button"
            accessibilityLabel={`${pet.is_gold ? 'Gold ' : ''}${info.name}. Show details`}
          >
            <PetBadge petId={pet.pet_id} owned isGold={pet.is_gold} size={56} />
            <Text style={styles.name} numberOfLines={2}>
              {info.name}
            </Text>
            <Stars copies={pet.copies} size={11} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  tile: { width: '25%', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  name: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center', lineHeight: 14 },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.lg },
});
