import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Habitat } from '@game/catalog';
import { LivePet } from '@/components/LivePet';

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
  onPress?: () => void;
};

function rand(min: number, max: number) {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

/**
 * One pet wandering to random spots in its band. Motion is translate only, on the UI thread.
 * Reduced motion leaves the pet still; LivePet still blinks.
 */
export function RoamingPet({ id, name, emoji, zone, width, height, size, grounded = false, onPress }: Props) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const face = useSharedValue(1);

  useEffect(() => {
    const pad = 4;
    const maxX = Math.max(pad, width - size - pad);
    const floor = Math.max(0, height - size);
    const startX = rand(pad, maxX);
    const startY = grounded ? floor : rand(0, floor);
    x.set(startX);
    y.set(startY);
    face.set(1);
    if (reduceMotion || maxX <= pad) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const roam = () => {
      if (cancelled) return;
      const toX = rand(pad, maxX);
      const toY = grounded ? floor : rand(0, floor);
      const dx = toX - x.get();
      const dy = toY - y.get();
      if (Math.abs(dx) > 1) face.set(dx < 0 ? -1 : 1);
      const dist = Math.hypot(dx, dy);
      const duration = dist < 12 ? 0 : Math.min(7000, Math.max(1400, dist * 24));
      if (duration > 0) {
        x.set(withTiming(toX, { duration, easing: Easing.linear }));
        y.set(withTiming(toY, { duration, easing: Easing.linear }));
      }
      timer = setTimeout(roam, duration + rand(280, 1600));
    };

    roam();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimation(x);
      cancelAnimation(y);
    };
  }, [face, grounded, height, id, reduceMotion, size, width, x, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scaleX: face.get() }],
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
      <LivePet
        id={id}
        name={name}
        emoji={emoji}
        size={size}
        onPress={onPress}
        accessibilityLabel={onPress ? `Change the ${zone} pet` : undefined}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pet: { position: 'absolute', left: 0, top: 0, zIndex: 3 },
  shadow: { position: 'absolute', height: 3 },
});
