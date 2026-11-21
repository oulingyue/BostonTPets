import { getPet, LINE_INFO, ODDS, TIER_WEIGHT, type Pet } from '@game/catalog';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PetBadge } from '@/components/PetBadge';
import { colors, rarityStyle, spacing } from '@/theme';

/**
 * Chance (in percent) that one normal scan rolls this exact pet, from the odds in catalog.ts.
 * Each line's table weighs to 100, so a creature's weight is its percent on that line.
 * Pity and booth (demo) odds are left out.
 */
export function scanChance(pet: Pet): number {
  const base = TIER_WEIGHT[pet.rarity];
  if (pet.line === null) return base;
  return base * (pet.isLineVariant ? ODDS.lineVariantChance : 1 - ODDS.lineVariantChance);
}

function formatPercent(value: number): string {
  if (Number.isInteger(value)) return `${value}%`;
  return `${value < 1 ? value.toFixed(1) : value.toFixed(1).replace(/\.0$/, '')}%`;
}

/** Bottom sheet for a pet the player hasn't found yet: where to find it and how likely it is. Owned pets use PetSheet. */
export function CreatureDetailModal({ petId, onClose }: { petId: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const pet = petId ? getPet(petId) : undefined;

  return (
    <Modal visible={!!pet} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        {pet && (
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}
            accessibilityViewIsModal
          >
            <View style={styles.grabber} />
            <View style={styles.hero}>
              <PetBadge petId={pet.petId} owned={false} size={112} />
              <Text style={styles.title} accessibilityRole="header">
                ???
              </Text>
              <View style={styles.chips}>
                <Text style={[styles.chip, { backgroundColor: rarityStyle[pet.rarity].bg, color: rarityStyle[pet.rarity].fg }]}>
                  {pet.rarity}
                  {pet.isLineVariant ? ' variant' : ''}
                </Text>
                <Text style={[styles.chip, { backgroundColor: '#F1EFEA', color: colors.text }]}>
                  {pet.line ? (
                    <>
                      <Text style={{ color: LINE_INFO[pet.line].color }}>● </Text>
                      {LINE_INFO[pet.line].name}
                    </>
                  ) : (
                    'Every line'
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.facts}>
              <Fact label="Status" value="Not found yet" />
              <Fact label="Found on" value={pet.line ? LINE_INFO[pet.line].name : 'Any line'} />
              <Fact label="Chance per scan" value={formatPercent(scanChance(pet))} />
            </View>

            <Text style={styles.hint}>
              Scan a code {pet.line ? `at a ${LINE_INFO[pet.line].name} station` : 'at any T station'} to try your luck.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.done, pressed && { opacity: 0.85 }]}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    gap: 18,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.locked },
  hero: { alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  facts: { backgroundColor: colors.background, borderRadius: 14, padding: 14, gap: 12 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  factLabel: { fontSize: 14, color: colors.muted },
  factValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  done: { minHeight: 48, borderRadius: 12, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
