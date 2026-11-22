import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UserAvatar } from '@/components/UserAvatar';
import type { PublicPet, Stats } from '@/lib/api';
import { formatDate, isActiveNow, lastActiveLabel } from '@/lib/time';
import { cardStyle, fonts, spacing, useStyles, type Palette } from '@/theme';

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
  avatarPetId?: string | null;
  avatarIsGold?: boolean;
  /** Own profile only: opens pet picker when the avatar is tapped. */
  onPressAvatar?: () => void;
};

/** Top of a profile, shared by your own profile and other people's. */
export function ProfileHeader(p: Props) {
  const styles = useStyles(makeStyles);
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
        {p.onPressAvatar ? (
          <Pressable
            onPress={p.onPressAvatar}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <UserAvatar
              name={name}
              seed={p.handle ?? name}
              size={84}
              avatarPetId={p.avatarPetId}
              avatarIsGold={p.avatarIsGold}
            />
            <Text style={styles.avatarHint}>Change photo</Text>
          </Pressable>
        ) : (
          <UserAvatar
            name={name}
            seed={p.handle ?? name}
            size={84}
            avatarPetId={p.avatarPetId}
            avatarIsGold={p.avatarIsGold}
          />
        )}
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
  const styles = useStyles(makeStyles);
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    identity: { alignItems: 'center', gap: 4, paddingTop: spacing.sm },
    avatarHint: { fontFamily: fonts.heavy, fontSize: 12, color: c.link, textAlign: 'center', marginTop: 6 },
    name: { marginTop: spacing.sm, fontFamily: fonts.pixelBold, fontSize: 22, letterSpacing: 1, color: c.text },
    handleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    handle: { fontFamily: fonts.bold, fontSize: 15, color: c.muted },
    followsYou: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: c.sunken,
      color: c.text,
      fontFamily: fonts.heavy,
      fontSize: 11,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    onlineDot: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#00A651' },
    meta: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
    counts: { flexDirection: 'row', ...cardStyle(c) },
    count: { flex: 1, alignItems: 'center', paddingVertical: 10, minHeight: 44 },
    countDivider: { borderLeftWidth: 2, borderLeftColor: c.scheme === 'dark' ? c.border : c.lockedBorder },
    countValue: { fontFamily: fonts.pixelBold, fontSize: 18, color: c.text },
    countLabel: { fontFamily: fonts.bold, fontSize: 12, color: c.muted },
    tiles: { flexDirection: 'row', gap: spacing.sm },
    tile: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', gap: 3, ...cardStyle(c), borderRadius: 12 },
    tileValue: { fontFamily: fonts.pixelBold, fontSize: 16, color: c.scheme === 'dark' ? c.accent : c.text },
    tileLabel: { fontFamily: fonts.heavy, fontSize: 11, color: c.muted },
  });
