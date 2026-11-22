import { router, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { UserAvatar } from '@/components/UserAvatar';
import { PointsInfoSheet } from '@/components/PointsInfoSheet';
import { SegmentedControl } from '@/components/SegmentedControl';
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardScope } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { cardStyle, fonts, spacing, useStyles, type Palette } from '@/theme';

// Points leaderboard: Global (everyone with points) and Friends (you + people you follow).
// Scoring rules: supabase/functions/_shared/game/points.ts. Ranking rules: the leaderboard SQL function.

/** Gold, silver and bronze rank badges for the top three. */
const MEDALS = ['#F2C230', '#D5DAE3', '#E0A26A'];

const formatPoints = (n: number) => n.toLocaleString('en-US');

export default function LeaderboardScreen() {
  const styles = useStyles(makeStyles);
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
  }, [navigation, styles]);
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
  const styles = useStyles(makeStyles);
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
      <View style={[styles.rankBox, entry.rank <= 3 && [styles.medal, { backgroundColor: MEDALS[entry.rank - 1] }]]}>
        <Text style={[styles.rank, entry.rank <= 3 && styles.medalText]}>{entry.rank}</Text>
      </View>
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { padding: spacing.md, gap: 10 },
    error: { fontFamily: fonts.bold, color: c.danger, textAlign: 'center' },
    empty: { fontFamily: fonts.bold, textAlign: 'center', color: c.muted, padding: spacing.md },
    infoButton: {
      marginRight: 4,
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: '#E8ECF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoText: { fontFamily: fonts.pixelBold, color: c.signText, fontSize: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, ...cardStyle(c) },
    rowMe: { backgroundColor: c.mine, borderColor: c.scheme === 'dark' ? c.accent : c.border },
    rankBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    medal: { borderWidth: 2, borderColor: c.scheme === 'dark' ? c.shadow : c.border },
    rank: { fontFamily: fonts.pixelBold, fontSize: 14, color: c.muted },
    medalText: { color: '#10131C' },
    name: { fontFamily: fonts.heavy, fontSize: 15, color: c.text },
    meta: { fontFamily: fonts.bold, fontSize: 12, color: c.muted },
    pointsBox: { alignItems: 'flex-end' },
    points: { fontFamily: fonts.heavy, fontSize: 17, fontVariant: ['tabular-nums'], color: c.scheme === 'dark' ? c.accent : c.text },
    pointsLabel: { fontFamily: fonts.bold, fontSize: 11, color: c.muted },
    pinned: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, backgroundColor: c.background },
    pinnedHint: { fontFamily: fonts.bold, textAlign: 'center', color: c.muted, fontSize: 13, paddingVertical: spacing.xs },
  });
