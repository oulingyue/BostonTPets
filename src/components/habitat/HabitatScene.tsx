import type { Habitat, Pet } from '@game/catalog';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { RoamingPet } from './RoamingPet';

const SCENE = require('../../../assets/habitat/scene.png');

const SKY_PET = 72;
const LAND_PET = 84;
const WATER_PET = 76;

type Props = {
  pets: Partial<Record<Habitat, Pet>>;
  onAdd: (zone: Habitat) => void;
};

/**
 * Background is assets/habitat/scene.png. Lanes sit on the open sky, the meadow, and the pond.
 */
export function HabitatScene({ pets, onAdd }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.scene}>
      <Image source={SCENE} style={styles.art} resizeMode="cover" fadeDuration={0} />

      <Lane style={styles.skyLane}>{(box) => pet(pets.sky, 'sky', box, SKY_PET, false)}</Lane>
      <Lane style={styles.landLane}>{(box) => pet(pets.earth, 'earth', box, LAND_PET, true)}</Lane>
      <Lane style={styles.waterLane}>{(box) => pet(pets.water, 'water', box, WATER_PET, false)}</Lane>

      <AddButton zone="sky" filled={!!pets.sky} style={[styles.skyPlus, { top: insets.top + 8 }]} onPress={() => onAdd('sky')} />
      <AddButton zone="earth" filled={!!pets.earth} style={styles.landPlus} onPress={() => onAdd('earth')} />
      <AddButton zone="water" filled={!!pets.water} style={styles.waterPlus} onPress={() => onAdd('water')} />
    </View>
  );
}

function pet(info: Pet | undefined, zone: Habitat, box: { width: number; height: number }, size: number, grounded: boolean) {
  if (!info) return null;
  return (
    <RoamingPet
      id={info.petId}
      name={info.name}
      emoji={info.emoji}
      zone={zone}
      width={box.width}
      height={box.height}
      size={size}
      grounded={grounded}
    />
  );
}

function Lane({ style, children }: { style: StyleProp<ViewStyle>; children: (box: { width: number; height: number }) => ReactNode }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  return (
    <View
      pointerEvents="box-none"
      style={[styles.lane, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {box.width > 0 && children(box)}
    </View>
  );
}

function AddButton({
  zone,
  filled,
  style,
  onPress,
}: {
  zone: Habitat;
  filled: boolean;
  style: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={filled ? `Change the ${zone} pet` : `Add a pet to the ${zone}`}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.plus, style, pressed && styles.plusPressed]}
    >
      <PixelIcon name="plus" size={16} color="#10131C" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: '#3EBEFF' },
  art: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', zIndex: 0 },
  lane: { position: 'absolute', zIndex: 2 },
  skyLane: { left: '8%', width: '72%', top: '14%', height: '22%' },
  landLane: { left: '16%', width: '68%', top: '60%', marginTop: -LAND_PET, height: LAND_PET },
  waterLane: { left: '22%', width: '56%', top: '74%', height: '14%' },
  // The app's button style: rounded yellow with an ink outline and a hard shadow that presses down.
  plus: {
    position: 'absolute',
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F2C53D',
    borderWidth: 2,
    borderColor: '#10131C',
    boxShadow: '0px 3px 0px #10131C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusPressed: { transform: [{ translateY: 2 }], boxShadow: '0px 1px 0px #10131C' },
  skyPlus: { right: 10 },
  landPlus: { top: '52%', right: 10 },
  waterPlus: { top: '78%', right: 10 },
});
