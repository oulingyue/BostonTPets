import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UserAvatar } from '@/components/UserAvatar';
import { FollowButton } from '@/components/FollowButton';
import type { UserSummary } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

/** A person in search results or a follow list. Tapping opens their profile. */
export function UserRow({ user }: { user: UserSummary }) {
  const { session } = useSession();
  const isMe = session?.user.id === user.id;
  const name = user.display_name ?? `@${user.handle}`;

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
        onPress={() => router.push({ pathname: '/user/[handle]', params: { handle: user.handle } })}
        accessibilityRole="button"
        accessibilityLabel={`${name}, @${user.handle}. Open profile`}
      >
        <UserAvatar
          name={name}
          seed={user.handle}
          avatarPetId={user.avatar_pet_id}
          avatarIsGold={user.avatar_is_gold}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
            {isMe ? ' (you)' : ''}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            @{user.handle} · {user.pet_count} {user.pet_count === 1 ? 'pet' : 'pets'}
          </Text>
          {user.follows_you && !isMe && <Text style={styles.followsYou}>Follows you</Text>}
        </View>
      </Pressable>
      {!isMe && (
        <FollowButton userId={user.id} name={name} followed={user.followed_by_me} followsYou={user.follows_you} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  followsYou: { fontSize: 11, fontWeight: '700', color: '#4F4F4F', marginTop: 2 },
});
