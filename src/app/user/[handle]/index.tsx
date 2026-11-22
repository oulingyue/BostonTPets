import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { FollowButton } from '@/components/FollowButton';
import { PetGrid } from '@/components/PetGrid';
import { PetSheet } from '@/components/PetSheet';
import { ProfileHeader } from '@/components/ProfileHeader';
import { fetchPublicProfile, type PublicPet } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useFocusedData } from '@/lib/useAsync';
import { fonts, spacing, useStyles, type Palette } from '@/theme';

/** Someone's public profile: no email, scan history or stations. */
export default function UserProfile() {
  const styles = useStyles(makeStyles);
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { session } = useSession();
  const [openPet, setOpenPet] = useState<PublicPet | null>(null);
  const load = useCallback(() => fetchPublicProfile(handle ?? ''), [handle]);
  const { data: profile, error, loading, refresh } = useFocusedData(load);

  // Follower count adjusts right away when you tap Follow. The adjustment belongs to the loaded
  // profile, so a refresh (which already counts the follow) drops it.
  const [adjust, setAdjust] = useState<{ for: object; delta: number } | null>(null);
  const followerDelta = adjust && adjust.for === profile ? adjust.delta : 0;

  const title = <Stack.Screen options={{ title: handle ? `@${handle}` : '' }} />;

  if (!profile && loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!profile) {
    return (
      <>
        {title}
        <Text style={styles.empty}>{error ?? `No one is called @${handle}.`}</Text>
      </>
    );
  }

  const isMe = session?.user.id === profile.id;
  const name = profile.display_name ?? `@${profile.handle}`;

  return (
    <>
      {title}
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {error && <Text style={styles.error}>{error}</Text>}
        <ProfileHeader
          displayName={profile.display_name}
          handle={profile.handle}
          createdAt={profile.created_at}
          lastActiveAt={profile.last_active_at}
          avatarPetId={profile.avatar_pet_id}
          avatarIsGold={profile.avatar_is_gold}
          followsYou={!isMe && profile.follows_you}
          pets={profile.pets}
          stats={profile.stats}
          following={profile.following}
          followers={profile.followers + followerDelta}
          onPressFollows={(tab) =>
            router.push({ pathname: '/user/[handle]/follows', params: { handle: profile.handle, tab } })
          }
          action={
            isMe ? undefined : (
              <FollowButton
                wide
                userId={profile.id}
                name={name}
                followed={profile.followed_by_me}
                followsYou={profile.follows_you}
                onChange={(followed) =>
                  setAdjust({ for: profile, delta: followed === profile.followed_by_me ? 0 : followed ? 1 : -1 })
                }
              />
            )
          }
        />

        <Text style={styles.section} accessibilityRole="header">
          Pets
        </Text>
        <PetGrid pets={profile.pets} onPressPet={setOpenPet} emptyText={`${name} hasn't caught any pets yet.`} />
        {!isMe && <Text style={styles.privateNote}>Scan history stays private.</Text>}
      </ScrollView>

      <PetSheet pet={openPet} onClose={() => setOpenPet(null)} />
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { padding: spacing.md, gap: spacing.md },
    error: { fontFamily: fonts.bold, color: c.danger, textAlign: 'center' },
    empty: { fontFamily: fonts.bold, textAlign: 'center', color: c.muted, padding: spacing.lg },
    section: { fontFamily: fonts.pixelBold, fontSize: 16, letterSpacing: 1, color: c.text, marginTop: spacing.xs },
    privateNote: { fontFamily: fonts.body, fontSize: 12, color: c.muted, textAlign: 'center' },
  });
