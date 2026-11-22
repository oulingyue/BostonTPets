import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { setFollowing } from '@/lib/api';
import { fonts, hardShadow, useStyles, type Palette } from '@/theme';

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
  const styles = useStyles(makeStyles);
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    pill: {
      minHeight: 36,
      minWidth: 100,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      ...hardShadow(c, 2),
    },
    wide: { minHeight: 46, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', ...hardShadow(c) },
    filled: { backgroundColor: c.accent, borderColor: c.scheme === 'dark' ? c.shadow : c.border },
    outlined: { backgroundColor: c.surface, borderColor: c.border },
    text: { fontFamily: fonts.heavy, fontSize: 13 },
    filledText: { color: c.onAccent },
    outlinedText: { color: c.text },
  });
