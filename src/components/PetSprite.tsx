import { Image, Platform, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { PET_ART } from '@/lib/petArt';
import { RAINBOW, rainbowAt, useRainbowCycle } from './Rainbow';

type Props = {
  /** Art id: the file name in assets/pets/ (see src/lib/petArt.ts). */
  id: string;
  /** Shown until the creature has art. */
  emoji: string;
  size: number;
  /** Show the eyes-closed frame, when the art has one. */
  blinking?: boolean;
  /** A dark silhouette (or "?" without silhouette art), for creatures the player hasn't found yet. */
  silhouette?: boolean;
  /** The rainbow variant: the pet's colors cycle through the rainbow. */
  rainbow?: boolean;
};

/** A creature's art, or its emoji until the art exists. */
export function PetSprite({ id, emoji, size, blinking = false, silhouette = false, rainbow = false }: Props) {
  const art = PET_ART[id];
  // No tintColor on the pet's own images on purpose: iOS reuses Image views, and a reused view can turn a found
  // pet into a tinted silhouette. Silhouettes are their own PNGs instead.
  if (art && silhouette && art.silhouette) {
    return <Image source={art.silhouette} resizeMode="contain" style={{ width: size, height: size }} />;
  }
  if (art && !silhouette) {
    const showBlink = blinking && !!art.blink;
    // Both frames stay loaded and only their visibility switches. Swapping the image source instead made
    // the pet vanish for a moment the first time it blinked, while the blink frame loaded.
    return (
      <View style={{ width: size, height: size }}>
        <Image source={art.base} resizeMode="contain" style={{ width: size, height: size, opacity: showBlink ? 0 : 1 }} />
        {art.blink && (
          <Image
            source={art.blink}
            resizeMode="contain"
            style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, opacity: showBlink ? 1 : 0 }}
          />
        )}
        {rainbow && <RainbowTint source={art.base} size={size} />}
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.62, opacity: silhouette ? 0.35 : 1 }}>{silhouette ? '?' : emoji}</Text>
    </View>
  );
}

/**
 * A copy of the art in the current rainbow color, laid over the original with a "color" blend:
 * the pet keeps its shading while its hue cycles. Where blending isn't supported it's a translucent tint.
 * This overlay is always tinted and only mounted for rainbow pets, so it never leaves a tint behind.
 */
function RainbowTint({ source, size }: { source: ImageSourcePropType; size: number }) {
  const cycle = useRainbowCycle();
  // Phones animate the tint color directly. On the web the tint is applied once, so the overlay is tinted
  // the first rainbow color and its hue is rotated around the color wheel with a CSS filter instead.
  const style = useAnimatedStyle(() =>
    IS_WEB ? { filter: `hue-rotate(${Math.round(cycle.value * 360)}deg)` } : { tintColor: rainbowAt(cycle.value) },
  );
  return (
    <Animated.Image
      source={source}
      resizeMode="contain"
      style={[
        { position: 'absolute', left: 0, top: 0, width: size, height: size, opacity: 0.8, mixBlendMode: 'color' },
        IS_WEB && { tintColor: RAINBOW[0] },
        style,
      ]}
    />
  );
}

const IS_WEB = Platform.OS === 'web';
