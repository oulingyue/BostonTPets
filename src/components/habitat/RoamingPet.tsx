import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Habitat } from '@game/catalog';
import { LivePet } from '@/components/LivePet';

const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

type Props = {
  id: string;
  name: string;
  emoji: string;
  zone: Habitat;
  width: number;
  height: number;
  size: number;
  /** Stand on the bottom of the lane, so the sprite meets the grass. */
  grounded?: boolean;
};

/**
 * One pet drifting through its band. Motion is translate only, on the UI thread.
 * Reduced motion leaves the pet still; LivePet still blinks.
 */
export function RoamingPet({ id, name, emoji, zone, width, height, size, grounded = false }: Props) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const face = useSharedValue(1);

  useEffect(() => {
    const pad = 4;
    const maxX = Math.max(pad, width - size - pad);
    const floor = Math.max(0, height - size);
    const midY = grounded ? floor : Math.max(0, floor * (zone === 'water' ? 0.35 : 0.2));
    x.value = pad;
    y.value = midY;
    face.value = 1;
    if (reduceMotion || maxX <= pad) return;

    const travel = Math.min(11000, Math.max(5200, (maxX - pad) * 22));
    const bob = grounded ? 3 : zone === 'water' ? 8 : 10;
    x.value = withRepeat(
      withSequence(
        withTiming(maxX, { duration: travel, easing: EASE_IN_OUT }, (finished) => {
          if (finished) face.value = -1;
        }),
        withTiming(pad, { duration: travel, easing: EASE_IN_OUT }, (finished) => {
          if (finished) face.value = 1;
        }),
      ),
      -1,
      false,
    );
    y.value = withRepeat(
      withSequence(
        withTiming(Math.max(0, midY - bob), { duration: 1800, easing: EASE_IN_OUT }),
        withTiming(Math.min(floor, midY + bob), { duration: 1800, easing: EASE_IN_OUT }),
      ),
      -1,
      true,
    );

    return () => {
      cancelAnimation(x);
      cancelAnimation(y);
    };
  }, [face, grounded, height, id, reduceMotion, size, width, x, y, zone]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scaleX: face.value }],
  }));

  return (
    <Animated.View style={[styles.pet, style]} pointerEvents="box-none">
      {zone !== 'sky' && (
        <View
          pointerEvents="none"
          style={[
            styles.shadow,
            {
              backgroundColor: zone === 'water' ? 'rgba(8, 48, 72, 0.28)' : 'rgba(36, 48, 18, 0.3)',
              width: size * 0.55,
              marginLeft: size * 0.22,
              top: size * 0.78,
            },
          ]}
        />
      )}
      <LivePet id={id} name={name} emoji={emoji} size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pet: { position: 'absolute', left: 0, top: 0, zIndex: 3 },
  shadow: { position: 'absolute', height: 3 },
});
