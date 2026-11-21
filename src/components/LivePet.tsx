import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '@/lib/haptics';
import { PET_ART } from '@/lib/petArt';
import { PetSprite } from './PetSprite';

type Props = {
  id: string;
  name: string;
  emoji: string;
  size: number;
  /** Idle motion runs only while active (e.g. after a reveal finishes). */
  active?: boolean;
};

/**
 * A pet that feels alive: a slow breathing bob, random blinks (when the art has a blink frame),
 * and a hop with a haptic when tapped. Reduced-motion users get a still pet that still blinks.
 */
export function LivePet({ id, name, emoji, size, active = true }: Props) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  const hop = useSharedValue(0);
  const [blinking, setBlinking] = useState(false);
  const hasBlink = Boolean(PET_ART[id]?.blink);

  useEffect(() => {
    if (!active || reduceMotion) return;
    breath.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breath);
  }, [active, reduceMotion, breath]);

  useEffect(() => {
    if (!active || !hasBlink) return;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        timer = setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 140);
      }, 2200 + Math.random() * 3200);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, [active, hasBlink]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -breath.value * size * 0.03 - hop.value * size * 0.28 },
      { scaleX: 1 + breath.value * 0.012 - hop.value * 0.06 },
      { scaleY: 1 + breath.value * 0.025 + hop.value * 0.08 },
    ],
  }));

  const onPress = () => {
    if (reduceMotion || !active) return;
    haptics.light();
    hop.value = withSequence(
      withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 7, stiffness: 180 }),
    );
  };

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Pet the ${name}`}>
      <Animated.View style={[{ transformOrigin: 'center bottom' }, style]}>
        <PetSprite id={id} emoji={emoji} size={size} blinking={blinking} />
      </Animated.View>
    </Pressable>
  );
}
