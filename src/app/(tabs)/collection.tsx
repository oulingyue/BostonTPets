import { CATALOG, LINE_INFO, LINE_TABLE, LINES, RARITIES, TOTAL_PETS, type Line, type Rarity } from '@game/catalog';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { CreatureBadge } from '@/components/CreatureBadge';
import { CreatureDetailModal } from '@/components/CreatureDetailModal';
import { PetSheet } from '@/components/PetSheet';
import { SegmentedControl } from '@/components/SegmentedControl';
import { fetchHabitat, fetchMyPets, type OwnedPet } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { cardStyle, fonts, useStyles, type Palette } from '@/theme';

type Grouping = 'rarity' | 'lines';

const COLUMNS = 4;
const COL_GAP = 6;
const PADDING = 16;
const MAX_WIDTH = 600;

const VIEWS: { value: Grouping; label: string }[] = [
  { value: 'rarity', label: 'Rarity' },
  { value: 'lines', label: 'Lines' },
];

/** Rarest first. */
const RARITY_ORDER: Rarity[] = [...RARITIES].reverse();
const RARITY_TITLE: Record<Rarity, string> = { legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common' };

/** Each line's exclusives, legendary first. */
function lineCreatureIds(line: Line): string[] {
  const table = LINE_TABLE[line];
  return [table.legendary, ...table.epics, ...table.rares].map((c) => c.id);
}

/** Every pet of one rarity, in line order (commons are shared, so they come once). */
function rarityIds(rarity: Rarity): string[] {
  return Object.values(CATALOG)
    .filter((pet) => pet.rarity === rarity)
    .map((pet) => pet.petId);
}

const loadCollection = async () => {
  const [pets, habitat] = await Promise.all([fetchMyPets(), fetchHabitat()]);
  return { pets, habitat };
};

export default function CollectionScreen() {
  const styles = useStyles(makeStyles);
  const { data, error, loading, refresh } = useFocusedData(useCallback(loadCollection, []));
  const pets = data?.pets;
  const [view, setView] = useState<Grouping>('rarity');
  const [openPetId, setOpenPetId] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  if (!pets && loading) return <ActivityIndicator style={styles.loading} color={styles.sectionTitle.color} />;

  // user_pets rows keyed by catalog pet_id. Ids no longer in the catalog (old skeleton rows) are ignored.
  const ownedById = new Map<string, OwnedPet>((pets ?? []).filter((p) => CATALOG[p.pet_id]).map((p) => [p.pet_id, p]));
  const has = (id: string) => ownedById.has(id);

  const ownedCount = ownedById.size;
  const golds = [...ownedById.values()].filter((p) => p.is_gold).length;

  const badgeWidth = (Math.min(width, MAX_WIDTH) - PADDING * 2 - COL_GAP * (COLUMNS - 1)) / COLUMNS;

  const equippedIds = new Set((data?.habitat ?? []).map((slot) => slot.pet_id));
  const openOwned = openPetId ? (ownedById.get(openPetId) ?? null) : null;

  const badge = (id: string) => (
    <CreatureBadge
      key={id}
      petId={id}
      owned={ownedById.get(id)}
      equipped={equippedIds.has(id)}
      width={badgeWidth}
      onPress={() => setOpenPetId(id)}
    />
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.stats}>
          <Stat value={`${ownedCount}/${TOTAL_PETS}`} label="Collected" />
          <Stat value={`${golds}`} label="Gold" />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {ownedCount === 0 && !error && (
          <Text style={styles.empty}>No pets yet. Tap the 📷 button and scan a code at a T station.</Text>
        )}

        <View style={styles.selector}>
          <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        </View>

        {view === 'rarity' &&
          RARITY_ORDER.map((rarity) => {
            const ids = rarityIds(rarity);
            return (
              <Section key={rarity} title={RARITY_TITLE[rarity]} found={ids.filter(has).length} total={ids.length}>
                <View style={styles.grid}>{ids.map(badge)}</View>
              </Section>
            );
          })}

        {view === 'lines' &&
          LINES.map((line) => {
            const ids = lineCreatureIds(line);
            return (
              <Section
                key={line}
                title={LINE_INFO[line].name}
                color={LINE_INFO[line].color}
                found={ids.filter(has).length}
                total={ids.length}
              >
                <View style={styles.grid}>{ids.map(badge)}</View>
              </Section>
            );
          })}
      </ScrollView>

      <PetSheet
        pet={openOwned}
        onClose={() => setOpenPetId(null)}
        showBlurb
        showEquip
        equippedPetIds={equippedIds}
        onEquipChange={refresh}
      />
      <CreatureDetailModal petId={openPetId && !openOwned ? openPetId : null} onClose={() => setOpenPetId(null)} />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section(props: { title: string; color?: string; found: number; total: number; children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {props.color && <View style={[styles.sectionDot, { backgroundColor: props.color }]} />}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {props.title}
          </Text>
        </View>
        <Text style={styles.sectionCount}>
          {props.found}/{props.total}
        </Text>
      </View>
      {props.children}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    loading: { flex: 1, backgroundColor: c.background },
    container: { padding: PADDING, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' },

    stats: { flexDirection: 'row', gap: 12 },
    stat: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 9, ...cardStyle(c) },
    statValue: { fontFamily: fonts.pixelBold, fontSize: 22, color: c.scheme === 'dark' ? c.accent : c.text },
    statLabel: { fontFamily: fonts.heavy, fontSize: 12, color: c.muted, marginTop: 1 },

    error: { fontFamily: fonts.bold, color: c.danger, textAlign: 'center', marginTop: 12 },
    empty: { fontFamily: fonts.bold, textAlign: 'center', color: c.muted, marginTop: 14 },

    selector: { marginTop: 16, marginBottom: 20 },

    section: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionDot: { width: 12, height: 12, borderRadius: 3 },
    sectionTitle: { fontFamily: fonts.pixelBold, fontSize: 16, letterSpacing: 1, color: c.text },
    sectionCount: { fontFamily: fonts.heavy, fontSize: 13, color: c.muted },
    grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: COL_GAP, rowGap: 16 },
  });
