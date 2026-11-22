import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SegmentedControl } from '@/components/SegmentedControl';
import { UserRow } from '@/components/UserRow';
import { fetchFollows, type FollowKind } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { fonts, spacing, usePalette, useStyles, type Palette } from '@/theme';

/** Who a user follows and who follows them. `?tab=followers` opens the second tab. */
export default function FollowList() {
  const styles = useStyles(makeStyles);
  const c = usePalette();
  const params = useLocalSearchParams<{ handle: string; tab?: string }>();
  const handle = params.handle ?? '';
  const [tab, setTab] = useState<FollowKind>(params.tab === 'followers' ? 'followers' : 'following');

  // Results are tagged with their tab so the previous tab's rows never show under the new one.
  const load = useCallback(async () => ({ tab, users: await fetchFollows(handle, tab) }), [handle, tab]);
  const { data, error, loading, refresh } = useFocusedData(load);
  const rows = data?.tab === tab ? data.users : [];

  return (
    <>
      <Stack.Screen options={{ title: `@${handle}` }} />
      <FlatList
        data={rows}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => <UserRow user={item} />}
        contentContainerStyle={styles.container}
        refreshing={loading && rows.length > 0}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.sm }}>
            <SegmentedControl
              options={[
                { value: 'following', label: 'Following' },
                { value: 'followers', label: 'Followers' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
        }
        ListEmptyComponent={
          error && !loading ? (
            <Text style={[styles.empty, { color: c.danger }]}>{error}</Text>
          ) : loading || data?.tab !== tab ? (
            <ActivityIndicator style={{ marginTop: spacing.lg }} />
          ) : (
            <Text style={styles.empty}>
              {tab === 'following' ? `@${handle} isn't following anyone yet.` : `No one follows @${handle} yet.`}
            </Text>
          )
        }
      />
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { padding: spacing.md, gap: 10 },
    empty: { fontFamily: fonts.bold, textAlign: 'center', color: c.muted, padding: spacing.lg },
  });
