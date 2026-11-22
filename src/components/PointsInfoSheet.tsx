import { RARITIES } from '@game/catalog';
import { DAILY_BONUS, GOLD_MULTIPLIER, POINTS_DUPLICATE, POINTS_NEW } from '@game/points';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, radius, spacing, usePalette, useStyles, type Palette } from '@/theme';

/** Bottom sheet explaining how leaderboard points work. Numbers come from _shared/game/points.ts. */
export function PointsInfoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  const c = usePalette();
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
                  <Text style={[styles.chip, { backgroundColor: c.rarity[r].bg, color: c.rarity[r].fg }]}>{r}</Text>
                </View>
                <Text style={styles.td}>{POINTS_NEW[r]}</Text>
                <Text style={styles.td}>{POINTS_DUPLICATE[r]}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Bonus label={`Rainbow ×${GOLD_MULTIPLIER}`} text="Rainbow pulls double the pet’s points." />
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
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.bonus}>
      <Text style={styles.bonusLabel}>{label}</Text>
      <Text style={styles.bonusText}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,8,15,0.55)' },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderWidth: 2,
      borderBottomWidth: 0,
      borderColor: c.border,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontFamily: fonts.pixelBold, fontSize: 18, letterSpacing: 1, color: c.text },
    close: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.sunken,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: { fontFamily: fonts.heavy, fontSize: 15, color: c.text },
    body: { fontFamily: fonts.body, fontSize: 14, color: c.text, lineHeight: 20 },
    table: { borderWidth: 2, borderColor: c.border, borderRadius: radius.md, overflow: 'hidden' },
    tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
    rowBorder: { borderTopWidth: 1, borderTopColor: c.scheme === 'dark' ? c.border : c.lockedBorder },
    first: { flex: 1.3, alignItems: 'flex-start' },
    th: { flex: 1, fontFamily: fonts.heavy, fontSize: 12, color: c.muted, textAlign: 'right' },
    td: { flex: 1, fontFamily: fonts.pixelBold, fontSize: 15, color: c.text, textAlign: 'right' },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
      fontFamily: fonts.heavy,
      fontSize: 12,
      textTransform: 'capitalize',
    },
    bonus: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    bonusLabel: { width: 84, fontFamily: fonts.heavy, fontSize: 14, color: c.text },
    bonusText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: c.text, lineHeight: 20 },
    note: { fontFamily: fonts.body, fontSize: 12, color: c.muted, lineHeight: 17 },
  });
