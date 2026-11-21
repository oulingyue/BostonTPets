import { getPet, isLine, LINE_INFO, LINE_TABLE, LINES, variantPetId, type Creature, type Line, type Rarity } from '@game/catalog';
import { pullProgress } from '@game/leveling';
import { rollPet, type PityState } from '@game/roll';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PullReveal, RARITY_COLOR } from '@/components/reveal/PullReveal';
import { IS_PREVIEW } from '@/lib/preview';

// Dev-only playground for the pull reveal: pick any line and creature from the catalog, replay it,
// slow it down, or roll a random pull with the real odds and pity.
// Open /dev/reveal (or the link at the bottom of Profile). Query params preset the controls, e.g.
//   /dev/reveal?line=red&pet=lobster&variant=1&gold=1&pull=levelUp&speed=2&ui=0   (ui=0 hides the controls)
// pull = new | dupe | levelUp | max: what this pull does to the pet's level (rules in _shared/game/leveling.ts).
// Release builds redirect away, unless preview mode is on.

const SPEEDS = [
  { label: '1×', timeScale: 1 },
  { label: '½×', timeScale: 2 },
  { label: '¼×', timeScale: 4 },
];

const PULL_KINDS = [
  { kind: 'new', label: 'New pet' },
  { kind: 'dupe', label: 'Duplicate' },
  { kind: 'levelUp', label: 'Level up' },
  { kind: 'max', label: 'Max level' },
] as const;
type PullKind = (typeof PULL_KINDS)[number]['kind'];

const DEMO_STATIONS: Record<Line, string> = {
  red: 'Kendall/MIT',
  green: 'Park Street',
  orange: 'Ruggles',
  blue: 'Aquarium',
  silver: 'Airport',
};

type Params = { line?: string; pet?: string; variant?: string; gold?: string; pull?: string; speed?: string; ui?: string };

function creaturesFor(line: Line): Creature[] {
  const table = LINE_TABLE[line];
  return [...table.commons, ...table.rares, ...table.epics, table.legendary];
}

/** How many copies (after this pull) produce the chosen outcome for a rarity. */
function copiesFor(rarity: Rarity, kind: PullKind): number {
  if (kind === 'new') return 1;
  let firstLevelUp = 2;
  for (let copies = 2; copies < 500; copies++) {
    const p = pullProgress(copies, rarity);
    if (p.levelsGained > 0 && firstLevelUp === 2) firstLevelUp = copies;
    if (kind === 'dupe' && p.gained > 0 && p.levelsGained === 0) return copies;
    if (kind === 'levelUp' && p.levelsGained > 0) return copies;
    if (kind === 'max' && p.before?.isMax) return copies;
  }
  return firstLevelUp; // e.g. legendary: every duplicate levels up, so "Duplicate" shows a level-up
}

function isPullKind(value: string | undefined): value is PullKind {
  return PULL_KINDS.some((k) => k.kind === value);
}

export default function RevealPlayground() {
  const params = useLocalSearchParams<Params>();
  const [line, setLine] = useState<Line>(isLine(params.line ?? '') ? (params.line as Line) : 'red');
  const [creatureId, setCreatureId] = useState(params.pet ?? 'lobster');
  const [isVariant, setVariant] = useState(params.variant === '1');
  const [isGold, setGold] = useState(params.gold === '1');
  const [pullKind, setPullKind] = useState<PullKind>(isPullKind(params.pull) ? params.pull : 'new');
  const [timeScale, setTimeScale] = useState(Number(params.speed) || 1);
  const [run, setRun] = useState(0);
  const pity = useRef<PityState>({ sinceEpicPlus: 0, sinceLegendary: 0 });
  const showControls = params.ui !== '0';

  if (!__DEV__ && !IS_PREVIEW) return <Redirect href="/" />;

  const pool = creaturesFor(line);
  const creature = pool.find((c) => c.id === creatureId) ?? LINE_TABLE[line].legendary;
  const canBeVariant = creature.rarity !== 'common';
  const variant = isVariant && canBeVariant;
  const pet = getPet(variant ? variantPetId(creature.id, line) : creature.id);
  const copies = copiesFor(creature.rarity, pullKind);

  const replay = () => setRun((n) => n + 1);
  const pickLine = (next: Line) => {
    setLine(next);
    // Keep the same tier when switching lines (e.g. legendary -> that line's legendary).
    const sameTier = creaturesFor(next).find((c) => c.rarity === creature.rarity && c.rarity !== 'common');
    if (sameTier) setCreatureId(sameTier.id);
  };
  const randomPull = () => {
    const roll = rollPet(line, { pity: pity.current }, Math.random);
    pity.current = roll.nextPity;
    setCreatureId(getPet(roll.petId)?.baseId ?? roll.petId);
    setVariant(roll.isLineVariant);
    setGold(roll.isGold);
    replay();
  };

  // Changing any option remounts the reveal, which replays it from the start.
  const revealKey = [line, creature.id, variant, isGold, copies, timeScale, run].join('|');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      {showControls && (
        <View style={styles.controls}>
          <ChipRow>
            {LINES.map((l) => (
              <Chip key={l} label={LINE_INFO[l].name} color={LINE_INFO[l].color} active={l === line} onPress={() => pickLine(l)} />
            ))}
          </ChipRow>
          <ChipRow>
            {pool.map((c) => (
              <Chip
                key={c.id}
                label={`${c.emoji} ${c.name}`}
                color={RARITY_COLOR[c.rarity]}
                active={c.id === creature.id}
                onPress={() => setCreatureId(c.id)}
              />
            ))}
          </ChipRow>
          <ChipRow>
            {PULL_KINDS.map((k) => (
              <Chip key={k.kind} label={k.label} active={k.kind === pullKind} onPress={() => setPullKind(k.kind)} />
            ))}
          </ChipRow>
          <ChipRow>
            <Chip label="🎲 Random pull" active onPress={randomPull} />
            <Chip label="↻ Replay" active onPress={replay} />
            <Chip
              label={canBeVariant ? 'Line variant' : 'Line variant (not for commons)'}
              active={variant}
              onPress={() => canBeVariant && setVariant((v) => !v)}
            />
            <Chip label="Gold" active={isGold} onPress={() => setGold((v) => !v)} />
            {SPEEDS.map((s) => (
              <Chip key={s.label} label={s.label} active={s.timeScale === timeScale} onPress={() => setTimeScale(s.timeScale)} />
            ))}
          </ChipRow>
        </View>
      )}
      <View style={styles.stage}>
        <PullReveal
          key={revealKey}
          pet={{
            id: creature.id,
            name: pet?.name ?? creature.name,
            emoji: creature.emoji,
            rarity: creature.rarity,
            isVariant: variant,
            isGold,
          }}
          line={line}
          stationName={DEMO_STATIONS[line]}
          copies={copies}
          isNew={copies === 1}
          becameGold={isGold && copies > 1}
          onDone={replay}
          timeScale={timeScale}
        />
      </View>
    </SafeAreaView>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {color && <View style={[styles.swatch, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A101D' },
  controls: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#232C42', backgroundColor: '#111827' },
  row: { gap: 6, paddingHorizontal: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3A4663',
  },
  chipActive: { backgroundColor: '#F3F5FA', borderColor: '#F3F5FA' },
  chipText: { color: '#C9D1E3', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#121826' },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  stage: { flex: 1 },
});
