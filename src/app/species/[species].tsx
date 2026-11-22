import { getPet, GOLD_COLOR, type Rarity } from '@game/catalog';
import { levelFor } from '@game/leveling';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExpBar } from '@/components/ExpBar';
import { PetBadge } from '@/components/PetBadge';
import { Stars } from '@/components/Stars';
import { fetchMyPets } from '@/lib/api';
import { playSfx } from '@/lib/sfx';
import { useFocusedData } from '@/lib/useAsync';
import { cardStyle, fonts, spacing, usePalette, useStyles, type Palette } from '@/theme';

export default function SpeciesDetail() {
  const styles = useStyles(makeStyles);
  const c = usePalette();
  // Temporary single-pet view. The route param is a pet_id. Collection layout belongs to the collection teammate.
  const { species } = useLocalSearchParams<{ species: string }>();
  const petId = Array.isArray(species) ? species[0] : species;
  const { data: pets, loading } = useFocusedData(fetchMyPets);
  const info = petId ? getPet(petId) : undefined;

  // Opening sound, once per visit: a chirp for a pet you own (plus a twinkle for legendaries and gold
  // pets), a muted blip for one you haven't found.
  const playedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!info || !pets || playedFor.current === info.petId) return;
    playedFor.current = info.petId;
    const mine = pets.find((pet) => pet.pet_id === info.petId);
    if (mine) {
      playSfx('open');
      if (info.rarity === 'legendary' || mine.is_gold) playSfx('sparkle');
    } else {
      playSfx('locked');
    }
  }, [info, pets]);

  if (!info) return <Text style={styles.empty}>Unknown pet.</Text>;
  if (!pets && loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const owned = (pets ?? []).find((pet) => pet.pet_id === info.petId);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: info.name }} />
      <View style={styles.hero}>
        <PetBadge petId={info.petId} owned={!!owned} isGold={owned?.is_gold} size={120} />
        <Text style={styles.rarity}>{info.rarity}</Text>
        <Text style={styles.blurb}>{info.blurb}</Text>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.petName, !owned && { color: c.muted }]}>
            {info.name}
            {owned?.is_gold && <Text style={styles.goldTag}> GOLD </Text>}
          </Text>
          {owned ? (
            <>
              <Stars copies={owned.copies} level={levelFor(owned.copies, info.rarity, owned.bonus_exp).level} />
              <ExpBarFor copies={owned.copies} rarity={info.rarity} bonusExp={owned.bonus_exp} />
              <Text style={styles.meta}>
                First caught{owned.first_station ? ` at ${owned.first_station}` : ''} ·{' '}
                {new Date(owned.first_caught_at).toLocaleDateString()}
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>Not found yet</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

/** EXP toward the next level, from the duplicate count (rules in _shared/game/leveling.ts). */
function ExpBarFor({ copies, rarity, bonusExp }: { copies: number; rarity: Rarity; bonusExp: number }) {
  const styles = useStyles(makeStyles);
  const lvl = levelFor(copies, rarity, bonusExp);
  return (
    <View style={styles.exp}>
      <ExpBar
        level={lvl.level}
        isMax={lvl.isMax}
        fill={lvl.isMax ? 1 : lvl.exp / lvl.expToNext}
        detail={`${lvl.exp} / ${lvl.expToNext} EXP`}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    goldTag: { backgroundColor: GOLD_COLOR, color: '#3a2a00', fontFamily: fonts.heavy, fontSize: 12 },
    exp: { maxWidth: 260, marginVertical: 4 },
    container: { padding: spacing.md, gap: spacing.sm },
    hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
    rarity: { fontFamily: fonts.pixelBold, fontSize: 13, color: c.muted, letterSpacing: 1 },
    blurb: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: c.text, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, ...cardStyle(c) },
    petName: { fontFamily: fonts.heavy, fontSize: 16, color: c.text },
    meta: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
    empty: { fontFamily: fonts.bold, textAlign: 'center', padding: spacing.lg, color: c.muted },
  });
