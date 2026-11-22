import { useEffect } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { DAY, fonts, usePalette } from '@/theme';

type Props = {
  level: number;
  isMax: boolean;
  /** 0..1 progress through the current level: a number, or a shared value when the caller animates it. */
  fill: number | SharedValue<number>;
  /** Right-hand label, e.g. "75 / 150 EXP". Ignored at max level. */
  detail: string;
  /** Optional font (the reveal passes its pixel font). */
  fontStyle?: TextStyle | null;
  /** Always draw for a light background (the reveal's cream panel), whatever the phone's mode. */
  onLight?: boolean;
};

const INK = '#10131C';
const FILL = '#4ADE80';
const FILL_SHINE = '#A7F3C0';
const MAX_FILL = '#F5B700';

/** Pixel-style EXP bar: "LV 3" on the left, progress on the right, a chunky bar underneath. */
export function ExpBar({ level, isMax, fill, detail, fontStyle, onLight = false }: Props) {
  const phone = usePalette();
  const c = onLight ? DAY : phone;
  const staticFill = useSharedValue(typeof fill === 'number' ? fill : 0);
  useEffect(() => {
    if (typeof fill === 'number') staticFill.value = fill;
  }, [fill, staticFill]);
  const progress = typeof fill === 'number' ? staticFill : fill;

  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.min(1, Math.max(0, progress.value)) * 100}%` }));
  return (
    <View style={styles.root} accessibilityLabel={isMax ? `Level ${level}, max` : `Level ${level}, ${detail}`}>
      <View style={styles.labels}>
        <Text style={[styles.level, { color: c.text }, fontStyle]}>LV {level}</Text>
        <Text style={[styles.detail, { color: c.muted }, fontStyle]}>{isMax ? 'MAX' : detail}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: isMax ? MAX_FILL : FILL }, fillStyle]}>
          <View style={[styles.shine, { backgroundColor: isMax ? '#FFE58A' : FILL_SHINE }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: 4 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  level: { fontFamily: fonts.pixelBold, fontSize: 13 },
  detail: { fontFamily: fonts.bold, fontSize: 11 },
  track: { height: 16, borderWidth: 3, borderColor: INK, backgroundColor: '#2A3348', overflow: 'hidden' },
  fill: { height: '100%' },
  shine: { height: 3 },
});
