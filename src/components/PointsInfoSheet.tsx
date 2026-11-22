import { RARITIES } from '@game/catalog';
import { DAILY_BONUS, GOLD_MULTIPLIER, POINTS_DUPLICATE, POINTS_NEW } from '@game/points';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, rarityStyle, spacing } from '@/theme';

/** Bottom sheet explaining how leaderboard points work. Numbers come from _shared/game/points.ts. */
export function PointsInfoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close points info" />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              How points work
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.body}>Every scan earns points. A pet you didn’t have yet is worth more than a duplicate.</Text>

          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={[styles.th, styles.first]}>Rarity</Text>
              <Text style={styles.th}>New pet</Text>
              <Text style={styles.th}>Duplicate</Text>
            </View>
            {RARITIES.map((r) => (
              <View key={r} style={[styles.tr, styles.rowBorder]}>
                <View style={styles.first}>
                  <Text style={[styles.chip, { backgroundColor: rarityStyle[r].bg, color: rarityStyle[r].fg }]}>{r}</Text>
                </View>
                <Text style={styles.td}>{POINTS_NEW[r]}</Text>
                <Text style={styles.td}>{POINTS_DUPLICATE[r]}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Bonus label={`Gold ×${GOLD_MULTIPLIER}`} text="Gold pulls double the pet’s points." />
            <Bonus label={`+${DAILY_BONUS} daily`} text="Your first scan of the day. Resets at midnight Boston time." />
          </View>

          <Text style={styles.note}>
            Global ranks everyone with points. Friends ranks you and the people you follow.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function Bonus({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.bonus}>
      <Text style={styles.bonusLabel}>{label}</Text>
      <Text style={styles.bonusText}>{text}</Text>
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
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  first: { flex: 1.3, alignItems: 'flex-start' },
  th: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'right' },
  td: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  bonus: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  bonusLabel: { width: 76, fontSize: 14, fontWeight: '800', color: colors.text },
  bonusText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17 },
});
