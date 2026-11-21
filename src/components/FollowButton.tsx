import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { setFollowing } from '@/lib/api';
import { colors } from '@/theme';

type Props = {
  userId: string;
  name: string;
  followed: boolean;
  /** They already follow you, so the button says "Follow back". */
  followsYou?: boolean;
  /** Full-width button (profile header) instead of a compact pill (lists). */
  wide?: boolean;
  onChange?: (followed: boolean) => void;
};

/** Follow / Following toggle. Updates optimistically and reverts if the request fails. */
export function FollowButton({ userId, name, followed, followsYou = false, wide = false, onChange }: Props) {
  const [isFollowing, setIsFollowing] = useState(followed);
  const [busy, setBusy] = useState(false);

  // Take the server's value again when the screen refreshes.
  const [lastFollowed, setLastFollowed] = useState(followed);
  if (followed !== lastFollowed) {
    setLastFollowed(followed);
    setIsFollowing(followed);
  }

  async function toggle() {
    const next = !isFollowing;
    setIsFollowing(next);
    onChange?.(next);
    setBusy(true);
    try {
      await setFollowing(userId, next);
    } catch (e) {
      setIsFollowing(!next);
      onChange?.(!next);
      Alert.alert(next ? 'Could not follow' : 'Could not unfollow', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const label = isFollowing ? 'Following' : followsYou ? 'Follow back' : 'Follow';

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      hitSlop={wide ? 0 : 4}
      accessibilityRole="button"
      accessibilityState={{ selected: isFollowing, busy }}
      accessibilityLabel={isFollowing ? `Unfollow ${name}` : `Follow ${name}`}
      style={({ pressed }) => [
        wide ? styles.wide : styles.pill,
        isFollowing ? styles.outlined : styles.filled,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.text, wide && { fontSize: 15 }, isFollowing ? styles.outlinedText : styles.filledText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { minHeight: 36, minWidth: 100, paddingHorizontal: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  wide: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: colors.primary },
  outlined: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#C9C4B9' },
  text: { fontSize: 13, fontWeight: '700' },
  filledText: { color: '#FFFFFF' },
  outlinedText: { color: colors.text },
});
