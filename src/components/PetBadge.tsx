import { COMMON_COLOR, getPet, GOLD_COLOR, LINE_INFO } from '@game/catalog';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { usePalette } from '@/theme';
import { PetSprite } from './PetSprite';

type Props = { petId: string; owned: boolean; isGold?: boolean; size?: number };

/**
 * Pet art on a rounded tile: line color for a line-exclusive, neutral for a shared common, outlined like the
 * rest of the pixel UI.
 * Art comes from src/lib/petArt.ts, keyed by pet id. Pets without art show their emoji.
 * Unowned pets show as a silhouette. Gold pets get a gold ring, a GOLD stamp, and a shine that sweeps across.
 */
export function PetBadge({ petId, owned, isGold = false, size = 56 }: Props) {
  const pet = getPet(petId);
  const tint = pet?.line ? LINE_INFO[pet.line].color : COMMON_COLOR;
  const gold = owned && isGold;
  const c = usePalette();
  const outline = owned ? (c.scheme === 'dark' ? c.shadow : c.border) : c.lockedBorder;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={owned ? `${pet?.name ?? petId}${gold ? ', gold' : ''}` : 'Not found yet'}
    >
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.24),
            backgroundColor: owned ? tint : c.locked,
            borderColor: gold ? GOLD_COLOR : outline,
            borderWidth: gold ? Math.max(3, size / 14) : Math.max(2, Math.round(size / 22)),
          },
        ]}
      >
        <PetSprite id={petId} emoji={pet?.emoji ?? '?'} size={size * 0.9} silhouette={!owned} />
        {gold && <GoldShine size={size} />}
      </View>
      {gold && <GoldStamp size={size} />}
    </View>
  );
}

/** A soft highlight that sweeps across the icon every couple of seconds. Still for reduced-motion users. */
function GoldShine({ size }: { size: number }) {
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withDelay(1500, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
    return () => cancelAnimation(sweep);
  }, [reduceMotion, sweep]);

  const style = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 1,
    transform: [{ translateX: (sweep.value * 2 - 1) * size }, { rotate: '25deg' }],
  }));

  return (
    <Animated.View
      style={[styles.shine, { width: size * 0.32, height: size * 1.6, top: -size * 0.3, left: size * 0.34 }, style]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,247,205,0.9)', 'rgba(255,255,255,0)'] as const}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** A tilted gold stamp on the icon's corner: "GOLD", or a star on tiny icons. */
function GoldStamp({ size }: { size: number }) {
  const small = size < 48;
  return (
    <View
      style={[
        styles.stamp,
        {
          right: -size * 0.12,
          top: -size * 0.06,
          paddingHorizontal: small ? 3 : Math.round(size * 0.06),
          borderWidth: size < 72 ? 1.5 : 2,
        },
      ]}
    >
      <Text style={[styles.stampText, { fontSize: small ? Math.max(9, size * 0.26) : Math.max(8, Math.round(size * 0.15)) }]}>
        {small ? '★' : 'GOLD'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shine: { position: 'absolute', pointerEvents: 'none' },
  stamp: {
    position: 'absolute',
    backgroundColor: GOLD_COLOR,
    borderColor: '#5c4300',
    borderRadius: 4,
    paddingVertical: 1,
    transform: [{ rotate: '12deg' }],
  },
  stampText: { color: '#3a2a00', fontWeight: '900', letterSpacing: 0.5 },
});
