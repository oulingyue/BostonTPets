import { getPet } from '@game/catalog';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PetBadge } from '@/components/PetBadge';
import { Stars } from '@/components/Stars';
import { fetchMyPets } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

export default function SpeciesDetail() {
  // Temporary single-pet view. The route param is a pet_id. Collection layout belongs to the collection teammate.
  const { species } = useLocalSearchParams<{ species: string }>();
  const petId = Array.isArray(species) ? species[0] : species;
  const { data: pets, loading } = useFocusedData(fetchMyPets);
  const info = petId ? getPet(petId) : undefined;

  if (!info) return <Text style={styles.empty}>Unknown pet.</Text>;
  if (!pets && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const owned = (pets ?? []).find((pet) => pet.pet_id === info.petId);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: info.name }} />
      <View style={styles.hero}>
        <PetBadge petId={info.petId} owned={!!owned} isGold={owned?.is_gold} size={120} />
        <Text style={styles.rarity}>{info.rarity}</Text>
        <Text style={styles.blurb}>{info.blurb}</Text>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.petName, !owned && { color: colors.muted }]}>
            {owned?.is_gold ? 'Gold ' : ''}
            {info.name}
          </Text>
          {owned ? (
            <>
              <Stars copies={owned.copies} />
              <Text style={styles.meta}>
                First caught{owned.first_station ? ` at ${owned.first_station}` : ''} ·{' '}
                {new Date(owned.first_caught_at).toLocaleDateString()}
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>Not found yet</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
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