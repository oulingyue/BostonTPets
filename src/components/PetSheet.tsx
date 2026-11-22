import { getPet, levelFromCopies, LINE_INFO, MAX_LEVEL } from '@game/catalog';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PetBadge } from '@/components/PetBadge';
import { RainbowTag } from '@/components/Rainbow';
import { Stars } from '@/components/Stars';
import type { PublicPet } from '@/lib/api';
import { playSfx } from '@/lib/sfx';
import { formatDate } from '@/lib/time';
import { colors, rarityStyle, spacing } from '@/theme';

/**
 * Bottom sheet with one pet's details. The same sheet is used for your pets and other people's,
 * so it never shows the station (that would reveal where someone rides).
 */
export function PetSheet({ pet, onClose }: { pet: PublicPet | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  // A chirp each time the sheet opens on a pet.
  const openPetId = pet?.pet_id ?? null;
  useEffect(() => {
    if (openPetId) playSfx('open');
  }, [openPetId]);

  return (
    <Modal visible={pet !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close pet details" />
        {pet && <SheetBody pet={pet} onClose={onClose} bottomInset={insets.bottom} />}
      </View>
    </Modal>
  );
}

function SheetBody({ pet, onClose, bottomInset }: { pet: PublicPet; onClose: () => void; bottomInset: number }) {
  const info = getPet(pet.pet_id);
  if (!info) return null;
  const { line } = info;
  const level = levelFromCopies(pet.copies);
  const extra = Math.max(0, pet.copies - MAX_LEVEL);
  const rarity = rarityStyle[info.rarity];

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, spacing.md) + spacing.md }]} accessibilityViewIsModal>
      <View style={styles.grabber} />

      <View style={styles.hero}>
        <PetBadge petId={pet.pet_id} owned isGold={pet.is_gold} size={112} />
        <Text style={styles.title} accessibilityRole="header">
          {info.name}
        </Text>
        <View style={styles.chips}>
          <Text style={[styles.chip, { backgroundColor: rarity.bg, color: rarity.fg }]}>{info.rarity}</Text>
          {line && (
            <Text style={[styles.chip, { backgroundColor: '#F1EFEA', color: colors.text }]}>
              <Text style={{ color: LINE_INFO[line].color }}>● </Text>
              {LINE_INFO[line].name}
            </Text>
          )}
          {pet.is_gold && <RainbowTag size="sm" label="RAINBOW" />}
        </View>
      </View>

      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>
            Level {level}
            {level === MAX_LEVEL ? ' (max)' : ''}
          </Text>
          <Stars copies={pet.copies} size={18} />
        </View>
        <View style={styles.bar} accessible={false}>
          <View style={[styles.barFill, { width: `${(level / MAX_LEVEL) * 100}%` }]} />
        </View>
        <Text style={styles.levelHint}>
          Pulled {pet.copies} {pet.copies === 1 ? 'time' : 'times'}.{' '}
          {level < MAX_LEVEL
            ? `Each new pull adds a level, up to ★${MAX_LEVEL}.`
            : `Max level. Extra pulls are counted${extra > 0 ? ` (+${extra} so far)` : ''}.`}
        </Text>
      </View>

      <View style={styles.facts}>
        <Fact label="First caught" value={formatDate(pet.first_caught_at)} />
        <Fact label="Rainbow" value={pet.is_gold ? 'Yes' : 'Not yet'} />
      </View>

      <Pressable style={({ pressed }) => [styles.done, pressed && { opacity: 0.85 }]} onPress={onClose} accessibilityRole="button">
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
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
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  levelCard: { backgroundColor: colors.background, borderRadius: 14, padding: 14, gap: 10 },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelText: { fontSize: 15, fontWeight: '700', color: colors.text },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: '#E8A100' },
  levelHint: { fontSize: 13, color: '#555555' },
  facts: { gap: 12 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  factLabel: { fontSize: 14, color: colors.muted },
  factValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  done: { minHeight: 48, borderRadius: 12, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
