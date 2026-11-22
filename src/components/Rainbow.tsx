// The rainbow variant (stored as `is_gold` in the database): the pet's colors cycle through the rainbow.
// Shared pieces: the cycling color, the RAINBOW tag (names, sheets, the reveal), and the icon stamp.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import {
  cancelAnimation,
  Easing,
  interpolateColor,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export const RAINBOW = ['#ff4d4d', '#ff9f1c', '#ffe14d', '#4cd964', '#3fa9ff', '#a66bff', '#ff4dc4'] as const;
const STOPS = [...RAINBOW, RAINBOW[0]];
const STOP_INPUT = STOPS.map((_, i) => i / (STOPS.length - 1));

/** 0..1, looping: how far around the rainbow the colors are. Stays at 0 for reduced-motion users. */
export function useRainbowCycle(durationMs = 2400): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const cycle = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    cycle.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1);
    return () => cancelAnimation(cycle);
  }, [reduceMotion, cycle, durationMs]);
  return cycle;
}

/** The rainbow color at a point in the cycle. Runs on the UI thread inside animated styles. */
export function rainbowAt(cycle: number): string {
  'worklet';
  return interpolateColor(cycle % 1, STOP_INPUT, STOPS);
}

type TagProps = { label?: string; size?: 'sm' | 'md'; fontStyle?: TextStyle | null };

/** A "RAINBOW" pill with a rainbow gradient. */
export function RainbowTag({ label = 'RAINBOW', size = 'md', fontStyle }: TagProps) {
  const small = size === 'sm';
  return (
    <View style={[styles.tag, small ? styles.tagSm : styles.tagMd]}>
      <LinearGradient colors={RAINBOW} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <Text style={[styles.tagText, small ? styles.tagTextSm : styles.tagTextMd, fontStyle]}>{label}</Text>
    </View>
  );
}

/** A tilted rainbow stamp for a pet icon's corner: "RAINBOW", or a star on tiny icons. */
export function RainbowStamp({ size }: { size: number }) {
  const small = size < 48;
  return (
    <View
      style={[
        styles.stamp,
        { right: -size * 0.14, top: -size * 0.06, paddingHorizontal: small ? 3 : Math.round(size * 0.05) },
      ]}
    >
      <LinearGradient colors={RAINBOW} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <Text style={[styles.stampText, { fontSize: small ? Math.max(9, size * 0.26) : Math.max(7, Math.round(size * 0.12)) }]}>
        {small ? '★' : 'RAINBOW'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { overflow: 'hidden', borderColor: '#2a1f3d', alignSelf: 'center' },
  tagMd: { borderWidth: 3, paddingHorizontal: 8, paddingVertical: 2 },
  tagSm: { borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { color: '#ffffff', fontWeight: '900', textShadowColor: '#2a1f3d', textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 } },
  tagTextMd: { fontSize: 13, letterSpacing: 1.5 },
  tagTextSm: { fontSize: 10, letterSpacing: 0.8 },
  stamp: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#2a1f3d',
    borderRadius: 4,
    paddingVertical: 1,
    transform: [{ rotate: '12deg' }],
  },
  stampText: {
    color: '#ffffff',
    fontWeight: '900',
    letterSpacing: 0.4,
    textShadowColor: '#2a1f3d',
    textShadowRadius: 2,
    textShadowOffset: { width: 1, height: 1 },
  },
});
