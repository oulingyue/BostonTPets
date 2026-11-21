import { LINES, petName, TOTAL_PETS } from '@game/catalog';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PetBadge } from '@/components/PetBadge';
import { fetchMyPets, fetchProfile, fetchScanHistory, fetchStats } from '@/lib/api';
import { IS_PREVIEW } from '@/lib/preview';
import { signOut, useSession } from '@/lib/session';
import { useFocusedData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const { session } = useSession();
  const load = useCallback(
    async () => {
      const [profile, stats, pets, history] = await Promise.all([
        fetchProfile(),
        fetchStats(),
        fetchMyPets(),
        fetchScanHistory(),
      ]);
      return { profile, stats, pets, history };
    },
    [],
  );
  const { data, error, loading, refresh } = useFocusedData(load);

  if (!data && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const tiles = data
    ? [
        { label: 'Collected', value: `${data.pets.length}/${TOTAL_PETS}` },
        { label: 'Gold', value: String(data.pets.filter((p) => p.is_gold).length) },
        { label: 'Scans', value: String(data.stats.total_scans) },
        { label: 'Lines visited', value: `${data.stats.lines_visited}/${LINES.length}` },
      ]
    : [];

  return (
    <FlatList
      data={data?.history ?? []}
      keyExtractor={(item) => String(item.id)}
      refreshing={loading}
      onRefresh={refresh}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          <View style={styles.header}>
            <Text style={styles.name}>{data?.profile?.display_name ?? 'Rider'}</Text>
            <Text style={styles.email}>{session?.user.email}</Text>
            {data?.profile?.is_demo && <Text style={styles.demo}>DEMO ACCOUNT</Text>}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.tiles}>
            {tiles.map((t) => (
              <View key={t.label} style={styles.tile}>
                <Text style={styles.tileValue}>{t.value}</Text>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.section}>Scan history</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.historyRow}>
          <PetBadge species={item.species} line={item.line} owned isGold={item.is_gold} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.historyPet}>
              {item.is_gold ? 'Gold ' : ''}
              {petName(item.line, item.species)}
            </Text>
            <Text style={styles.historyMeta}>
              {item.station_name} · {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No scans yet.</Text>}
      ListFooterComponent={
        <View>
          <Pressable
            style={styles.signOut}
            onPress={() => signOut().catch((e) => Alert.alert('Sign out failed', String(e)))}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
          {(__DEV__ || IS_PREVIEW) && (
            <Link href="/dev/reveal" style={styles.devLink}>
              Reveal playground (dev only)
            </Link>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm },
  header: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  email: { fontSize: 14, color: colors.muted },
  demo: { fontSize: 11, fontWeight: '800', color: colors.danger, letterSpacing: 1 },
  error: { color: colors.danger, textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  tileLabel: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
  },
  historyPet: { fontSize: 15, fontWeight: '600', color: colors.text },
  historyMeta: { fontSize: 12, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.lg },
  signOut: { alignItems: 'center', padding: spacing.lg },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  devLink: { textAlign: 'center', color: colors.muted, fontSize: 13, paddingBottom: spacing.lg },
});
