import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import type { PublicPet, Stats } from '@/lib/api';
import { formatDate, isActiveNow, lastActiveLabel } from '@/lib/time';
import { colors, spacing } from '@/theme';

type Props = {
  displayName: string | null;
  handle: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  followsYou?: boolean;
  pets: PublicPet[];
  stats: Stats;
  following: number;
  followers: number;
  /** Opens the follow list on that tab. Omit to make the counts plain text. */
  onPressFollows?: (tab: 'following' | 'followers') => void;
  /** Rendered between the counts and the stat tiles: "Add friends" or a Follow button. */
  action?: ReactNode;
  /** Shown under the name, e.g. a demo-account badge. */
  badge?: ReactNode;
};

/** Top of a profile, shared by your own profile and other people's. */
export function ProfileHeader(p: Props) {
  const name = p.displayName ?? (p.handle ? `@${p.handle}` : 'Rider');
  const gold = p.pets.filter((x) => x.is_gold).length;
  const tiles = [
    { label: 'Collected', value: String(p.pets.length) },
    { label: 'Gold pets', value: String(gold) },
    { label: 'Scans', value: String(p.stats.total_scans) },
    // "—" until the backend with points is deployed (stats.points missing).
    { label: 'Points', value: p.stats.points === undefined ? '—' : p.stats.points.toLocaleString('en-US') },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.identity}>
        <Avatar name={name} seed={p.handle ?? name} size={84} />
        <Text style={styles.name}>{name}</Text>
        <View style={styles.handleRow}>
          <Text style={styles.handle}>{p.handle ? `@${p.handle}` : 'No username yet'}</Text>
          {p.followsYou && <Text style={styles.followsYou}>Follows you</Text>}
        </View>
        {p.badge}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            {isActiveNow(p.lastActiveAt) && <View style={styles.onlineDot} />}
            <Text style={styles.meta}>{lastActiveLabel(p.lastActiveAt)}</Text>
          </View>
          <Text style={styles.meta} accessible={false}>
            ·
          </Text>
          <Text style={styles.meta}>Joined {formatDate(p.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.counts}>
        <Count
          value={p.following}
          label="Following"
          onPress={p.onPressFollows && (() => p.onPressFollows!('following'))}
        />
        <Count
          value={p.followers}
          label="Followers"
          divider
          onPress={p.onPressFollows && (() => p.onPressFollows!('followers'))}
        />
      </View>

      {p.action}

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile}>
            <Text style={styles.tileValue}>{t.value}</Text>
            <Text style={styles.tileLabel} numberOfLines={1}>
              {t.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Count({ value, label, divider, onPress }: { value: number; label: string; divider?: boolean; onPress?: () => void }) {
  const body = (
    <>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </>
  );
  const style = [styles.count, divider && styles.countDivider];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}. Show list`}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: 4, paddingTop: spacing.sm },
  name: { marginTop: spacing.sm, fontSize: 24, fontWeight: '800', color: colors.text },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  handle: { fontSize: 15, fontWeight: '500', color: colors.muted },
  followsYou: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#E9E5DC',
    color: '#4F4F4F',
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00843D' },
  meta: { fontSize: 13, color: colors.muted },
  counts: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  count: { flex: 1, alignItems: 'center', paddingVertical: 10, minHeight: 44 },
  countDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  countValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  countLabel: { fontSize: 12, color: colors.muted },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  tileValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  tileLabel: { fontSize: 10, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
});
