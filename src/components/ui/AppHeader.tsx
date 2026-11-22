import { LINE_INFO, LINES } from '@game/catalog';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useStyles, type Palette } from '@/theme';
import { PixelIcon } from './PixelIcon';

type Props = {
  title: string;
  /** Shows a back button that calls this. */
  onBack?: () => void;
  right?: ReactNode;
  /** Modals start below the phone's status bar already. */
  skipTopInset?: boolean;
};

/** The station-sign header: navy, square-cornered, pixel title, with a stripe of the five line colors underneath. */
export function AppHeader({ title, onBack, right, skipTopInset = false }: Props) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: (skipTopInset ? 0 : insets.top) + 12 }]}>
      <View style={styles.row}>
        {onBack && (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          >
            <PixelIcon name="back" size={16} color="#F3F5FA" />
          </Pressable>
        )}
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {right && <View style={styles.right}>{right}</View>}
      </View>
      <LineStripe />
    </View>
  );
}

/** Five line colors, edge to edge. */
export function LineStripe({ height = 5 }: { height?: number }) {
  return (
    <View style={{ flexDirection: 'row', height }} accessible={false}>
      {LINES.map((line) => (
        <View key={line} style={{ flex: 1, backgroundColor: LINE_INFO[line].color }} />
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    header: { backgroundColor: c.sign },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
    back: { width: 32, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
    title: { flex: 1, fontFamily: fonts.pixelBold, fontSize: 21, letterSpacing: 1.5, color: c.signText },
    right: { marginLeft: 'auto' },
  });
