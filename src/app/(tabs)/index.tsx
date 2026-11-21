import { SPECIES, TOTAL_PETS } from '@game/catalog';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SpeciesCard } from '@/components/SpeciesCard';
import { fetchMyPets } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

export default function CollectionScreen() {
  const { data: pets, error, loading, refresh } = useFocusedData(fetchMyPets);

  if (!pets && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const owned = pets ?? [];
  const golds = owned.filter((p) => p.is_gold).length;

  // 2 x 2 grid of species cards
  const rows = [SPECIES.slice(0, 2), SPECIES.slice(2, 4)];

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

      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((species) => (
            <SpeciesCard
              key={species}
              species={species}
              owned={owned}
              onPress={() => router.push({ pathname: '/species/[species]', params: { species } })}
            />
          ))}
        </View>
      ))}

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
  row: { flexDirection: 'row', gap: spacing.md },
  error: { color: colors.danger, textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.lg },
});
