import { getPet, type Habitat, type Pet } from '@game/catalog';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { HabitatScene } from '@/components/habitat/HabitatScene';
import { fetchUserHabitat } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { useStyles, type Palette } from '@/theme';

export default function UserHabitatScreen() {
  const styles = useStyles(makeStyles);
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const load = useCallback(() => fetchUserHabitat(handle ?? ''), [handle]);
  const { data, error, loading } = useFocusedData(load);

  if (!data && loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Habitat' }} />
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      </>
    );
  }

  const pets: Partial<Record<Habitat, Pet>> = {};
  for (const slot of data ?? []) {
    const pet = getPet(slot.pet_id);
    if (pet?.habitat === slot.zone) pets[slot.zone] = pet;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Habitat' }} />
      <View style={styles.screen}>
        {error && <Text style={styles.error}>{error}</Text>}
        <HabitatScene pets={pets} />
      </View>
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#3EBEFF' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    error: {
      position: 'absolute',
      zIndex: 4,
      top: 8,
      left: 16,
      right: 16,
      color: c.danger,
      textAlign: 'center',
    },
  });