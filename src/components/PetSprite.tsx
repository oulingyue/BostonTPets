import { Image, Text, View } from 'react-native';
import { PET_ART } from '@/lib/petArt';

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
};

/** A creature's art, or its emoji until the art exists. */
export function PetSprite({ id, emoji, size, blinking = false, silhouette = false }: Props) {
  const art = PET_ART[id];
  // No tintColor here on purpose: iOS reuses Image views, and a reused view can turn a found pet into a
  // tinted silhouette. Silhouettes are their own PNGs instead.
  const source = art && (silhouette ? art.silhouette : blinking && art.blink ? art.blink : art.base);
  if (source) {
    return <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />;
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.62, opacity: silhouette ? 0.35 : 1 }}>{silhouette ? '?' : emoji}</Text>
    </View>
  );
}
