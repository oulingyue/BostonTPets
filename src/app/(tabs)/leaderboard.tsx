import { router, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { UserAvatar } from '@/components/UserAvatar';
import { PointsInfoSheet } from '@/components/PointsInfoSheet';
import { SegmentedControl } from '@/components/SegmentedControl';
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardScope } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

// Points leaderboard: Global (everyone with points) and Friends (you + people you follow).
// Scoring rules: supabase/functions/_shared/game/points.ts. Ranking rules: the leaderboard SQL function.

const MEDALS = ['🥇', '🥈', '🥉'];

const formatPoints = (n: number) => n.toLocaleString('en-US');

export default function LeaderboardScreen() {
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [infoOpen, setInfoOpen] = useState(false);
  const navigation = useNavigation();

  // ⓘ in the header's top-right opens the points rules.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setInfoOpen(true)}
          style={({ pressed }) => [styles.infoButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="How points work"
          hitSlop={8}
        >
          <Text style={styles.infoText}>i</Text>
        </Pressable>
      ),
    });
  }, [navigation]);
  const infoSheet = <PointsInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />;

  // Both boards load together, so switching between them is instant.
  const load = useCallback(async () => {
    const [global, friends] = await Promise.all([fetchLeaderboard('global'), fetchLeaderboard('friends')]);
    return { global, friends };
  }, []);
  const { data, error, loading, refresh } = useFocusedData(load);

  if (!data && loading) {
    return (
      <>
        <ActivityIndicator style={{ flex: 1 }} />
        {infoSheet}
      </>
    );
  }

  const board = data?.[scope];
  const entries = board?.entries ?? [];
  const me = board?.me ?? null;
  const meBelow = me && !entries.some((e) => e.is_me) ? me : null;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.user_id}
        renderItem={({ item }) => <Row entry={item} />}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.xs }}>
            <SegmentedControl
              options={[
                { value: 'global', label: 'Global' },
                { value: 'friends', label: 'Friends' },
              ]}
              value={scope}
              onChange={setScope}
            />
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          error ? undefined : <Text style={styles.empty}>No one has scored yet. Scan a code to take first place.</Text>
        }
      />
      {/* Your own row stays in view when you're outside the top 50 (or not on Global yet). */}
      {data && (meBelow || (scope === 'global' && !me && entries.length > 0)) && (
        <View style={styles.pinned}>
          {meBelow ? <Row entry={meBelow} /> : <Text style={styles.pinnedHint}>Scan a code to get on the board.</Text>}
        </View>
      )}
      {infoSheet}
    </View>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const name = entry.display_name ?? `@${entry.handle}`;
  const open = () =>
    entry.is_me ? router.navigate('/profile') : router.push({ pathname: '/user/[handle]', params: { handle: entry.handle } });

  return (
    <Pressable
      style={({ pressed }) => [styles.row, entry.is_me && styles.rowMe, pressed && { opacity: 0.7 }]}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${entry.rank}, ${name}${entry.is_me ? ' (you)' : ''}, ${entry.points} points. Open profile`}
    >
      <Text style={[styles.rank, entry.rank <= 3 && styles.medal]}>{MEDALS[entry.rank - 1] ?? entry.rank}</Text>
      <UserAvatar
        name={name}
        seed={entry.handle}
        size={36}
        avatarPetId={entry.avatar_pet_id}
        avatarIsGold={entry.avatar_is_gold}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
          {entry.is_me ? ' (you)' : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          @{entry.handle} · {entry.pet_count} {entry.pet_count === 1 ? 'pet' : 'pets'}
        </Text>
      </View>
      <View style={styles.pointsBox}>
        <Text style={styles.points}>{formatPoints(entry.points)}</Text>
        <Text style={styles.pointsLabel}>pts</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm },
  error: { color: colors.danger, textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.md },
  infoButton: {
    marginRight: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { color: colors.primary, fontSize: 15, fontWeight: '800', fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rowMe: { borderColor: colors.primary, backgroundColor: '#EEF3FB' },
  rank: { width: 30, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.muted },
  medal: { fontSize: 22 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  pointsBox: { alignItems: 'flex-end' },
  points: { fontSize: 17, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  pointsLabel: { fontSize: 10, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  pinned: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  pinnedHint: { textAlign: 'center', color: colors.muted, fontSize: 13, paddingVertical: spacing.xs },
});
