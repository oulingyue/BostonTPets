import { getPet } from '@game/catalog';
import { Link, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PetBadge } from '@/components/PetBadge';
import { RainbowTag } from '@/components/Rainbow';
import { PetGrid } from '@/components/PetGrid';
import { PetSheet } from '@/components/PetSheet';
import { ProfileHeader } from '@/components/ProfileHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  fetchMyFollowCounts,
  fetchMyPets,
  fetchProfile,
  fetchScanHistory,
  fetchStats,
  type OwnedPet,
} from '@/lib/api';
import { signOut, useSession } from '@/lib/session';
import { useFocusedData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

type Tab = 'pets' | 'history';

export default function ProfileScreen() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>('pets');
  const [openPet, setOpenPet] = useState<OwnedPet | null>(null);

  const load = useCallback(async () => {
    const [profile, stats, pets, history, counts] = await Promise.all([
      fetchProfile(),
      fetchStats(),
      fetchMyPets(),
      fetchScanHistory(),
      // The social backend may not be deployed yet; the rest of the profile should still load.
      fetchMyFollowCounts().catch(() => ({ following: 0, followers: 0 })),
    ]);
    return { profile, stats, pets, history, counts };
  }, []);
  const { data, error, loading, refresh } = useFocusedData(load);

  if (!data && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const handle = data?.profile?.handle ?? null;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {error && <Text style={styles.error}>{error}</Text>}

        {data && (
          <ProfileHeader
            displayName={data.profile?.display_name ?? null}
            handle={handle}
            createdAt={data.profile?.created_at ?? session?.user.created_at ?? new Date().toISOString()}
            lastActiveAt={data.profile?.last_active_at ?? null}
            pets={data.pets}
            stats={data.stats}
            following={data.counts.following}
            followers={data.counts.followers}
            badge={data.profile?.is_demo ? <Text style={styles.demo}>DEMO ACCOUNT</Text> : undefined}
            onPressFollows={
              handle
                ? (t) => router.push({ pathname: '/user/[handle]/follows', params: { handle, tab: t } })
                : undefined
            }
            action={
              <Pressable
                style={({ pressed }) => [styles.addFriends, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/friends/search')}
                accessibilityRole="button"
              >
                <Text style={styles.addFriendsText}>Add friends</Text>
              </Pressable>
            }
          />
        )}

        <SegmentedControl
          options={[
            { value: 'pets', label: 'Pets' },
            { value: 'history', label: 'History' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'pets' ? (
          <PetGrid
            pets={data?.pets ?? []}
            onPressPet={setOpenPet}
            emptyText="No pets yet. Scan a code at a T station to catch your first one."
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.privateNote}>Only you can see your scan history.</Text>
            {(data?.history ?? []).length === 0 && <Text style={styles.empty}>No scans yet.</Text>}
            {(data?.history ?? []).map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <PetBadge petId={item.pet_id} owned isGold={item.is_gold} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={styles.historyNameRow}>
                    <Text style={styles.historyPet}>{getPet(item.pet_id)?.name ?? item.pet_id}</Text>
                    {item.is_gold && <RainbowTag size="sm" />}
                  </View>
                  <Text style={styles.historyMeta}>
                    {item.station_name} · {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={styles.signOut}
          onPress={() => signOut().catch((e) => Alert.alert('Sign out failed', String(e)))}
          accessibilityRole="button"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Link href="/dev/reveal" style={styles.devLink}>
          Reveal playground
        </Link>
      </ScrollView>

      <PetSheet pet={openPet} onClose={() => setOpenPet(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  historyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  container: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.danger, textAlign: 'center' },
  demo: { fontSize: 11, fontWeight: '800', color: colors.danger, letterSpacing: 1 },
  addFriends: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFriendsText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  privateNote: { fontSize: 12, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.lg },
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
  signOut: { alignItems: 'center', padding: spacing.lg },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  devLink: { textAlign: 'center', color: colors.muted, fontSize: 13, paddingBottom: spacing.lg },
});
