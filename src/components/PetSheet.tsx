import { getPet, GOLD_COLOR, LINE_INFO, type Habitat } from '@game/catalog';
import { levelFor } from '@game/leveling';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpBar } from '@/components/ExpBar';
import { PetBadge } from '@/components/PetBadge';
import { Stars } from '@/components/Stars';
import { equipPet, type OwnedPet, type PublicPet } from '@/lib/api';
import { playSfx } from '@/lib/sfx';
import { formatDate } from '@/lib/time';
import { colors, rarityStyle, spacing } from '@/theme';

const ZONE_LABEL: Record<Habitat, string> = { sky: 'Air', earth: 'Land', water: 'Water' };

type SheetPet = PublicPet | OwnedPet;

function bonusExpOf(pet: SheetPet): number {
  return 'bonus_exp' in pet ? (pet.bonus_exp ?? 0) : 0;
}

/**
 * Bottom sheet with one pet's details. The same sheet is used for your pets and other people's,
 * so it never shows the station (that would reveal where someone rides).
 */
export function PetSheet({
  pet,
  onClose,
  showBlurb = false,
  showEquip = false,
  equippedPetIds,
  onEquipChange,
}: {
  pet: SheetPet | null;
  onClose: () => void;
  showBlurb?: boolean;
  showEquip?: boolean;
  equippedPetIds?: ReadonlySet<string>;
  onEquipChange?: () => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();

  const openPetId = pet?.pet_id ?? null;
  useEffect(() => {
    if (openPetId) playSfx('open');
  }, [openPetId]);

  return (
    <Modal visible={pet !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close pet details" />
        {pet && (
          <SheetBody
            pet={pet}
            onClose={onClose}
            bottomInset={insets.bottom}
            showBlurb={showBlurb}
            showEquip={showEquip}
            equipped={equippedPetIds?.has(pet.pet_id) ?? false}
            onEquipChange={onEquipChange}
          />
        )}
      </View>
    </Modal>
  );
}

function SheetBody({
  pet,
  onClose,
  bottomInset,
  showBlurb,
  showEquip,
  equipped,
  onEquipChange,
}: {
  pet: SheetPet;
  onClose: () => void;
  bottomInset: number;
  showBlurb: boolean;
  showEquip: boolean;
  equipped: boolean;
  onEquipChange?: () => void | Promise<void>;
}) {
  const info = getPet(pet.pet_id);
  const [busy, setBusy] = useState(false);
  const [equipError, setEquipError] = useState<string | null>(null);

  if (!info) return null;
  const { line, habitat } = info;
  const bonusExp = bonusExpOf(pet);
  const lvl = levelFor(pet.copies, info.rarity, bonusExp);
  const rarity = rarityStyle[info.rarity];

  const toggleEquip = async () => {
    if (busy) return;
    setBusy(true);
    setEquipError(null);
    try {
      await equipPet(pet.pet_id, !equipped);
      await onEquipChange?.();
    } catch (e) {
      setEquipError(e instanceof Error ? e.message : 'Could not update equip.');
    } finally {
      setBusy(false);
    }
  };

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
          {pet.is_gold && <Text style={[styles.chip, styles.goldChip]}>★ Gold</Text>}
          {equipped && <Text style={[styles.chip, styles.equippedChip]}>Equipped</Text>}
        </View>
        {showBlurb && <Text style={styles.blurb}>{info.blurb}</Text>}
      </View>

      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>
            Level {lvl.level}
            {lvl.isMax ? ' (max)' : ''}
          </Text>
          <Stars copies={pet.copies} level={lvl.level} size={18} />
        </View>
        <ExpBar
          level={lvl.level}
          isMax={lvl.isMax}
          fill={lvl.isMax ? 1 : lvl.exp / lvl.expToNext}
          detail={`${lvl.exp} / ${lvl.expToNext} EXP`}
        />
        <Text style={styles.levelHint}>
          {equipped
            ? `Equipped in ${ZONE_LABEL[habitat]} — earning passive EXP while equipped.`
            : 'Equip in habitat for passive EXP; duplicates from scans still add the most.'}
          {' '}
          Pulled {pet.copies} {pet.copies === 1 ? 'time' : 'times'}.
        </Text>
      </View>

      {showEquip && (
        <Pressable
          style={({ pressed }) => [styles.equipBtn, { opacity: pressed || busy ? 0.85 : 1 }]}
          onPress={toggleEquip}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={equipped ? 'Unequip pet' : `Equip in ${ZONE_LABEL[habitat]}`}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.equipBtnText}>
              {equipped ? 'Unequip' : `Equip · ${ZONE_LABEL[habitat]}`}
            </Text>
          )}
        </Pressable>
      )}
      {equipError && <Text style={styles.equipError}>{equipError}</Text>}

      <View style={styles.facts}>
        <Fact label="First caught" value={formatDate(pet.first_caught_at)} />
        <Fact label="Gold" value={pet.is_gold ? 'Yes' : 'Not yet'} />
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
  blurb: { fontSize: 15, lineHeight: 21, color: colors.text, textAlign: 'center', paddingHorizontal: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  goldChip: { backgroundColor: GOLD_COLOR, color: '#3a2a00' },
  equippedChip: { backgroundColor: colors.primary, color: '#fff' },
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
  levelHint: { fontSize: 13, color: '#555555' },
  equipBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  equipError: { color: colors.danger, textAlign: 'center', fontSize: 13 },
  facts: { gap: 12 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  factLabel: { fontSize: 14, color: colors.muted },
  factValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  done: { minHeight: 48, borderRadius: 12, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});