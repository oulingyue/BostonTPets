import { CATALOG, TOTAL_PETS, type Pet, type Rarity } from '@game/catalog';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SpeciesCard } from '@/components/SpeciesCard';
import { fetchMyPets } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

function rowsOf(pets: Pet[]): Pet[][] {
  const rows: Pet[][] = [];
  for (let i = 0; i < pets.length; i += 2) rows.push(pets.slice(i, i + 2));
  return rows;
}

export default function CollectionScreen() {
  const { data: pets, error, loading, refresh } = useFocusedData(fetchMyPets);

  if (!pets && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const owned = pets ?? [];
  const ownedById = new Map(owned.map((pet) => [pet.pet_id, pet]));
  const golds = owned.filter((pet) => pet.is_gold).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={styles.summary}>
        <Text style={styles.big}>
          {owned.length}
          <Text style={styles.of}> / {TOTAL_PETS}</Text>
        </Text>
        <Text style={styles.label}>collected{golds > 0 ? ` · ${golds} gold ✨` : ''}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Temporary rarity list so the 65-pet catalog typechecks. Collection layout belongs to the collection teammate. */}
      {RARITY_ORDER.map((rarity) => {
        const group = Object.values(CATALOG)
          .filter((pet) => pet.rarity === rarity)
          .sort((a, b) => a.name.localeCompare(b.name));
        return (
          <View key={rarity} style={styles.section}>
            <Text style={styles.sectionTitle}>{rarity}</Text>
            {rowsOf(group).map((row) => (
              <View key={row[0].petId} style={styles.row}>
                {row.map((pet) => (
                  <SpeciesCard
                    key={pet.petId}
                    petId={pet.petId}
                    owned={ownedById.get(pet.petId)}
                    onPress={() => router.push({ pathname: '/species/[species]', params: { species: pet.petId } })}
                  />
                ))}
                {row.length === 1 && <View style={{ flex: 1 }} />}
              </View>
            ))}
          </View>
        );
      })}

      {owned.length === 0 && !error && (
        <Text style={styles.empty}>No pets yet. Tap the 📷 button and scan a code at a T station.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md },
  summary: { alignItems: 'center', paddingVertical: spacing.md },
  big: { fontSize: 48, fontWeight: '800', color: colors.text },
  of: { fontSize: 24, color: colors.muted, fontWeight: '600' },
  label: { fontSize: 15, color: colors.muted },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  error: { color: colors.danger, textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.lg },
});
