import { getPet, GOLD_COLOR } from '@game/catalog';
import { Link, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AvatarPickerModal } from '@/components/AvatarPickerModal';
import { PetBadge } from '@/components/PetBadge';
import { PetGrid } from '@/components/PetGrid';
import { PetSheet } from '@/components/PetSheet';
import { ProfileHeader } from '@/components/ProfileHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Button } from '@/components/ui/Button';
import {
  fetchMyFollowCounts,
  fetchHabitat,
  fetchMyPets,
  fetchProfile,
  fetchScanHistory,
  fetchStats,
  setAvatarPet,
  type OwnedPet,
} from '@/lib/api';
import { signOut, useSession } from '@/lib/session';
import { useFocusedData } from '@/lib/useAsync';
import { cardStyle, fonts, spacing, useStyles, type Palette } from '@/theme';

type Tab = 'pets' | 'history';

export default function ProfileScreen() {
  const styles = useStyles(makeStyles);
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>('pets');
  const [openPet, setOpenPet] = useState<OwnedPet | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const load = useCallback(async () => {
    const [profile, stats, pets, habitat, history, counts] = await Promise.all([
      fetchProfile(),
      fetchStats(),
      fetchMyPets(),
      fetchHabitat(),
      fetchScanHistory(),
      // The social backend may not be deployed yet; the rest of the profile should still load.
      fetchMyFollowCounts().catch(() => ({ following: 0, followers: 0 })),
    ]);
    return { profile, stats, pets, habitat, history, counts };
  }, []);
  const { data, error, loading, refresh } = useFocusedData(load);

  if (!data && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const handle = data?.profile?.handle ?? null;
  const equippedIds = new Set((data?.habitat ?? []).map((slot) => slot.pet_id));
  const avatarPetId = data?.profile?.avatar_pet_id ?? null;
  const avatarIsGold = (data?.pets ?? []).find((p) => p.pet_id === avatarPetId)?.is_gold ?? false;

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
            avatarPetId={avatarPetId}
            avatarIsGold={avatarIsGold}
            onPressAvatar={() => setAvatarOpen(true)}
            onPressFollows={
              handle
                ? (t) => router.push({ pathname: '/user/[handle]/follows', params: { handle, tab: t } })
                : undefined
            }
            action={
              <Button title="Add friends" onPress={() => router.push('/friends/search')} />
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
                  <Text style={styles.historyPet}>
                    {getPet(item.pet_id)?.name ?? item.pet_id}
                    {item.is_gold && <Text style={styles.goldTag}> GOLD </Text>}
                  </Text>
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

      <PetSheet
        pet={openPet}
        onClose={() => setOpenPet(null)}
        showEquip
        equippedPetIds={equippedIds}
        onEquipChange={refresh}
      />
      <AvatarPickerModal
        visible={avatarOpen}
        pets={data?.pets ?? []}
        currentPetId={avatarPetId}
        onClose={() => setAvatarOpen(false)}
        onSelect={async (petId) => {
          try {
            await setAvatarPet(petId);
            await refresh();
          } catch (e) {
            Alert.alert('Could not update photo', e instanceof Error ? e.message : String(e));
          }
        }}
      />
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    goldTag: { backgroundColor: GOLD_COLOR, color: '#3a2a00', fontFamily: fonts.heavy, fontSize: 11 },
    container: { padding: spacing.md, gap: spacing.md },
    error: { fontFamily: fonts.bold, color: c.danger, textAlign: 'center' },
    demo: { fontFamily: fonts.pixelBold, fontSize: 11, color: c.danger, letterSpacing: 1 },
    privateNote: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
    empty: { fontFamily: fonts.bold, textAlign: 'center', color: c.muted, padding: spacing.lg },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, ...cardStyle(c), borderRadius: 12 },
    historyPet: { fontFamily: fonts.heavy, fontSize: 15, color: c.text },
    historyMeta: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
    signOut: { alignItems: 'center', padding: spacing.lg },
    signOutText: { fontFamily: fonts.heavy, color: c.danger, fontSize: 16 },
    devLink: { fontFamily: fonts.bold, textAlign: 'center', color: c.muted, fontSize: 13, paddingBottom: spacing.lg },
  });
