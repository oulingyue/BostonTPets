import { DAILY_BONUS, GOLD_MULTIPLIER, POINTS_DUPLICATE, POINTS_NEW } from '@game/points';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { SegmentedControl } from '@/components/SegmentedControl';
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardScope } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

// Points leaderboard: Global (everyone with points) and Friends (you + people you follow).
// Scoring rules: supabase/functions/_shared/game/points.ts. Ranking rules: the leaderboard SQL function.

const MEDALS = ['🥇', '🥈', '🥉'];

const HOW_POINTS_WORK =
  `New pet ${POINTS_NEW.common}–${POINTS_NEW.legendary} · duplicate ${POINTS_DUPLICATE.common}–${POINTS_DUPLICATE.legendary}` +
  ` · gold ×${GOLD_MULTIPLIER} · +${DAILY_BONUS} for your first scan of the day`;

const formatPoints = (n: number) => n.toLocaleString('en-US');

export default function LeaderboardScreen() {
  const [scope, setScope] = useState<LeaderboardScope>('global');

  // Both boards load together, so switching between them is instant.
  const load = useCallback(async () => {
    const [global, friends] = await Promise.all([fetchLeaderboard('global'), fetchLeaderboard('friends')]);
    return { global, friends };
  }, []);
  const { data, error, loading, refresh } = useFocusedData(load);

  if (!data && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const board = data?.[scope];
  const entries = board?.entries ?? [];
  const me = board?.me ?? null;
  const meBelow = me && !entries.some((e) => e.is_me) ? me : null;
  const onlyMe = scope === 'friends' && entries.length <= 1;

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
            <Text style={styles.rules}>{HOW_POINTS_WORK}</Text>
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          error ? undefined : <Text style={styles.empty}>No one has scored yet. Scan a code to take first place.</Text>
        }
        ListFooterComponent={
          onlyMe ? (
            <View style={styles.invite}>
              <Text style={styles.empty}>Follow people to see how you stack up.</Text>
              <Pressable
                style={({ pressed }) => [styles.addFriends, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/friends/search')}
                accessibilityRole="button"
              >
                <Text style={styles.addFriendsText}>Add friends</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      />
      {/* Your own row stays in view when you're outside the top 50 (or not on Global yet). */}
      {data && (meBelow || (scope === 'global' && !me && entries.length > 0)) && (
        <View style={styles.pinned}>
          {meBelow ? <Row entry={meBelow} /> : <Text style={styles.pinnedHint}>Scan a code to get on the board.</Text>}
        </View>
      )}
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
      <Avatar name={name} seed={entry.handle} size={36} />
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
  rules: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.md },
  invite: { alignItems: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  addFriends: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFriendsText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
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
