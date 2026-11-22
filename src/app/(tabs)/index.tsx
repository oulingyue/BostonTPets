import { CATALOG, LINE_INFO, LINE_TABLE, LINES, TOTAL_PETS, type Line } from '@game/catalog';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { fetchMyPets, type OwnedPet } from '@/lib/api';
import { useFocusedData } from '@/lib/useAsync';
import { colors } from '@/theme';

type Filter = 'all' | 'common' | Line;

const COLUMNS = 4;
const COL_GAP = 6;
const PADDING = 16;
const MAX_WIDTH = 600;

const FILTERS: { id: Filter; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  ...LINES.map((line) => ({ id: line, label: LINE_INFO[line].name.replace(' Line', ''), color: LINE_INFO[line].color })),
  { id: 'common', label: 'Commons' },
];

/** Shared commons are the same on every line's table. */
const COMMON_IDS = LINE_TABLE.red.commons.map((c) => c.id);

/** Each line's exclusives, legendary first. */
function lineCreatureIds(line: Line): string[] {
  const table = LINE_TABLE[line];
  return [table.legendary, ...table.epics, ...table.rares].map((c) => c.id);
}

const LEGENDARY_IDS = LINES.map((line) => LINE_TABLE[line].legendary.id);

export default function CollectionScreen() {
  const { data: pets, error, loading, refresh } = useFocusedData(fetchMyPets);
  const [filter, setFilter] = useState<Filter>('all');
  const [openPetId, setOpenPetId] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  if (!pets && loading) return <ActivityIndicator style={styles.loading} />;

  // user_pets rows keyed by catalog pet_id. Ids no longer in the catalog (old skeleton rows) are ignored.
  const ownedById = new Map<string, OwnedPet>((pets ?? []).filter((p) => CATALOG[p.pet_id]).map((p) => [p.pet_id, p]));
  const has = (id: string) => ownedById.has(id);

  const ownedCount = ownedById.size;
  const legendariesOwned = LEGENDARY_IDS.filter(has).length;
  const linesFound = LINES.filter((line) => lineCreatureIds(line).some(has)).length;
  const golds = [...ownedById.values()].filter((p) => p.is_gold).length;

  const badgeWidth = (Math.min(width, MAX_WIDTH) - PADDING * 2 - COL_GAP * (COLUMNS - 1)) / COLUMNS;
  const showCommons = filter === 'all' || filter === 'common';
  const linesToShow = filter === 'all' ? LINES : LINES.filter((line) => line === filter);

  const openOwned = openPetId ? (ownedById.get(openPetId) ?? null) : null;

  const badge = (id: string) => (
    <CreatureBadge key={id} petId={id} owned={ownedById.get(id)} width={badgeWidth} onPress={() => setOpenPetId(id)} />
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.stats}>
          <Stat value={`${ownedCount}/${TOTAL_PETS}`} label="Collected" />
          <Stat value={`${golds}`} label="Rainbow 🌈" />
          <Stat value={`${legendariesOwned}/${LEGENDARY_IDS.length}`} label="Legendary" />
          <Stat value={`${linesFound}/${LINES.length}`} label="Lines" />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {ownedCount === 0 && !error && (
          <Text style={styles.empty}>No pets yet. Tap the 📷 button and scan a code at a T station.</Text>
        )}

        <View style={styles.segmentTrack}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segment}>
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  {f.color && <View style={[styles.dot, { backgroundColor: f.color }]} />}
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {showCommons && (
          <Section title="Commons" found={COMMON_IDS.filter(has).length} total={COMMON_IDS.length}>
            <Text style={styles.note}>Found on every line</Text>
            <View style={styles.grid}>{COMMON_IDS.map(badge)}</View>
          </Section>
        )}

        {linesToShow.map((line) => {
          const ids = lineCreatureIds(line);
          const found = ids.filter(has).length;
          return (
            <Section
              key={line}
              title={LINE_INFO[line].name}
              color={LINE_INFO[line].color}
              found={found}
              total={ids.length}
            >
              <View style={styles.grid}>{ids.map(badge)}</View>
            </Section>
          );
        })}
      </ScrollView>

      <PetSheet pet={openOwned} onClose={() => setOpenPetId(null)} />
      <CreatureDetailModal petId={openPetId && !openOwned ? openPetId : null} onClose={() => setOpenPetId(null)} />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section(props: { title: string; color?: string; found: number; total: number; children: ReactNode }) {
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background },
  container: { padding: PADDING, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' },

  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  error: { color: colors.danger, textAlign: 'center', marginTop: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 14 },

  segmentTrack: { backgroundColor: '#E9E5DC', borderRadius: 10, padding: 3, marginTop: 16, marginBottom: 20 },
  segment: { gap: 2 },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '500', color: colors.muted },
  segmentTextActive: { color: colors.text, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 12, height: 12, borderRadius: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sectionCount: { fontSize: 13, fontWeight: '600', color: colors.muted },
  note: { fontSize: 13, color: colors.muted, marginTop: -6, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: COL_GAP, rowGap: 16 },
});
