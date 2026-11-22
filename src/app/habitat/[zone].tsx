import { getPet, isHabitat, type Habitat } from '@game/catalog';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CreatureBadge } from '@/components/CreatureBadge';
import { fetchHabitat, fetchMyPets, setHabitatPet, type OwnedPet } from '@/lib/api';
import { errorText, useFocusedData } from '@/lib/useAsync';
import { colors } from '@/theme';

const LABEL: Record<Habitat, string> = { sky: 'Sky', earth: 'Earth', water: 'Water' };
const COLUMNS = 3;
const GAP = 12;
const PADDING = 16;

export default function HabitatPicker() {
  const { zone: zoneParam } = useLocalSearchParams<{ zone: string }>();
  const zone = typeof zoneParam === 'string' && isHabitat(zoneParam) ? zoneParam : null;
  const pets = useFocusedData(useCallback(fetchMyPets, []));
  const habitat = useFocusedData(useCallback(fetchHabitat, []));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  const placedId = zone ? habitat.data?.find((slot) => slot.zone === zone)?.pet_id : undefined;
  const owned: OwnedPet[] = (pets.data ?? [])
    .filter((pet) => getPet(pet.pet_id)?.habitat === zone)
    .sort((a, b) => (getPet(a.pet_id)?.name ?? '').localeCompare(getPet(b.pet_id)?.name ?? ''));

  const choose = async (petId: string, place: boolean) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await setHabitatPet(petId, place);
      router.back();
    } catch (e) {
      setActionError(errorText(e));
      setBusy(false);
      pets.refresh();
      habitat.refresh();
    }
  };

  const badgeWidth = (Math.min(width, 560) - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: zone ? `${LABEL[zone]} pets` : 'Habitat' }} />
      {!zone && <Text style={styles.empty}>That part of the habitat does not exist.</Text>}
      {zone && !pets.data && pets.loading && <ActivityIndicator style={styles.loading} />}
      {zone && (pets.error || habitat.error || actionError) && (
        <Text style={styles.error}>{actionError ?? pets.error ?? habitat.error}</Text>
      )}
      {zone && pets.data && owned.length === 0 && (
        <Text style={styles.empty}>No {LABEL[zone].toLowerCase()} pets yet. Scan a code at a T station.</Text>
      )}
      {zone && pets.data && owned.length > 0 && (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.note}>
            {placedId ? 'Tap another pet to swap. Tap the equipped one to unequip.' : 'Tap a pet to equip it here.'}
          </Text>
          <View style={styles.grid}>
            {owned.map((pet) => {
              const selected = pet.pet_id === placedId;
              return (
                <View key={pet.pet_id} style={[styles.cell, selected && styles.selected]}>
                  <CreatureBadge
                    petId={pet.pet_id}
                    owned={pet}
                    width={badgeWidth - (selected ? 6 : 0)}
                    onPress={() => choose(pet.pet_id, !selected)}
                  />
                  {selected && <Text style={styles.here}>Equipped</Text>}
                </View>
              );
            })}
          </View>
          {placedId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Unequip pet"
              disabled={busy}
              onPress={() => choose(placedId, false)}
              style={({ pressed }) => [styles.remove, { opacity: pressed || busy ? 0.6 : 1 }]}
            >
              <Text style={styles.removeText}>Unequip</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 32 },
  container: { padding: PADDING, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
  note: { color: colors.muted, fontSize: 14, marginBottom: 16 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 32, marginHorizontal: 24, fontSize: 16 },
  error: { color: colors.danger, textAlign: 'center', margin: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 16 },
  cell: { alignItems: 'center' },
  selected: { borderWidth: 3, borderColor: colors.primary, borderRadius: 12, paddingTop: 6 },
  here: { fontSize: 11, fontWeight: '700', color: colors.primary, marginTop: 4, marginBottom: 6 },
  remove: {
    marginTop: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.text,
    backgroundColor: colors.surface,
  },
  removeText: { fontSize: 15, fontWeight: '700', color: colors.text },
});
