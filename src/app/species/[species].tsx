import { isSpecies, LINES, parsePetId, petName, SPECIES_INFO } from '@game/catalog';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PetBadge } from '@/components/PetBadge';
import { Stars } from '@/components/Stars';
import { fetchMyPets } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

export default function SpeciesDetail() {
  const { species } = useLocalSearchParams<{ species: string }>();
  const { data: pets, loading } = useFocusedData(fetchMyPets);

  if (!species || !isSpecies(species)) return <Text style={styles.empty}>Unknown pet.</Text>;
  if (!pets && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const info = SPECIES_INFO[species];
  const byLine = new Map(
    (pets ?? [])
      .map((p) => ({ p, slot: parsePetId(p.pet_id) }))
      .filter((x) => x.slot?.species === species)
      .map((x) => [x.slot!.line, x.p] as const),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: info.name }} />
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>{info.emoji}</Text>
        <Text style={styles.rarity}>{info.rarity}</Text>
        <Text style={styles.blurb}>{info.blurb}</Text>
      </View>

      {LINES.map((line) => {
        const pet = byLine.get(line);
        return (
          <View key={line} style={styles.row}>
            <PetBadge species={species} line={line} owned={!!pet} isGold={pet?.is_gold} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.petName, !pet && { color: colors.muted }]}>
                {pet?.is_gold ? 'Gold ' : ''}
                {petName(line, species)}
              </Text>
              {pet ? (
                <>
                  <Stars copies={pet.copies} />
                  <Text style={styles.meta}>
                    First caught{pet.first_station ? ` at ${pet.first_station}` : ''} ·{' '}
                    {new Date(pet.first_caught_at).toLocaleDateString()}
                  </Text>
                </>
              ) : (
                <Text style={styles.meta}>Not found yet</Text>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  heroEmoji: { fontSize: 64 },
  rarity: { fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  blurb: { fontSize: 15, color: colors.text, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  petName: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  empty: { textAlign: 'center', padding: spacing.lg, color: colors.muted },
});
