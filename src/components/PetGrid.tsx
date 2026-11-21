import { LINE_INFO, LINES, parsePetId, SPECIES, SPECIES_INFO, type Line, type Species } from '@game/catalog';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PetBadge } from '@/components/PetBadge';
import { Stars } from '@/components/Stars';
import type { PublicPet } from '@/lib/api';
import { colors, spacing } from '@/theme';

type Slotted<P> = { pet: P; species: Species; line: Line };

/** Catalog order: by species, then by line. Pets whose pet_id this app version doesn't know are skipped. */
function sortPets<P extends PublicPet>(pets: P[]): Slotted<P>[] {
  return pets
    .flatMap((pet) => {
      const slot = parsePetId(pet.pet_id);
      return slot ? [{ pet, ...slot }] : [];
    })
    .sort((a, b) => SPECIES.indexOf(a.species) - SPECIES.indexOf(b.species) || LINES.indexOf(a.line) - LINES.indexOf(b.line));
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
      {sortPets(pets).map(({ pet, species, line }) => {
        const shortName = `${LINE_INFO[line].name.replace(' Line', '')} ${SPECIES_INFO[species].name}`;
        return (
          <Pressable
            key={pet.pet_id}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
            onPress={() => onPressPet(pet)}
            accessibilityRole="button"
            accessibilityLabel={`${pet.is_gold ? 'Gold ' : ''}${LINE_INFO[line].name} ${SPECIES_INFO[species].name}. Show details`}
          >
            <PetBadge species={species} line={line} owned isGold={pet.is_gold} size={56} />
            <Text style={styles.name} numberOfLines={2}>
              {shortName}
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
