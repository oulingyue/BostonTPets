import type { Habitat, Pet } from '@game/catalog';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { RoamingPet } from './RoamingPet';

const SCENE = require('../../../assets/habitat/scene.png');

const SKY_PET = 72;
const LAND_PET = 84;
const WATER_PET = 76;

type Props = {
  pets: Partial<Record<Habitat, Pet>>;
  /** Omit for a view-only habitat (no plus buttons; pets are not tappable). */
  onAdd?: (zone: Habitat) => void;
};

/**
 * Background is assets/habitat/scene.png. Lanes sit on the open sky, the meadow, and the pond.
 */
export function HabitatScene({ pets, onAdd }: Props) {
  return (
    <View style={styles.scene}>
      <Image source={SCENE} style={styles.art} resizeMode="cover" fadeDuration={0} />

      <Lane style={styles.skyLane}>{(box) => pet(pets.sky, 'sky', box, SKY_PET, false, onAdd)}</Lane>
      <Lane style={styles.landLane}>{(box) => pet(pets.earth, 'earth', box, LAND_PET, true, onAdd)}</Lane>
      <Lane style={styles.waterLane}>{(box) => pet(pets.water, 'water', box, WATER_PET, false, onAdd)}</Lane>

      {onAdd && !pets.sky && (
        <View pointerEvents="box-none" style={styles.skyPlus}>
          <AddButton zone="sky" onPress={() => onAdd('sky')} />
        </View>
      )}
      {onAdd && !pets.earth && (
        <View pointerEvents="box-none" style={styles.landPlus}>
          <AddButton zone="earth" onPress={() => onAdd('earth')} />
        </View>
      )}
      {onAdd && !pets.water && (
        <View pointerEvents="box-none" style={styles.waterPlus}>
          <AddButton zone="water" onPress={() => onAdd('water')} />
        </View>
      )}
    </View>
  );
}

function pet(
  info: Pet | undefined,
  zone: Habitat,
  box: { width: number; height: number },
  size: number,
  grounded: boolean,
  onAdd: ((zone: Habitat) => void) | undefined,
) {
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
      onPress={onAdd ? () => onAdd(zone) : undefined}
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

function AddButton({ zone, onPress }: { zone: Habitat; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add a pet to the ${zone}`}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.plus, pressed && styles.plusPressed]}
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
  landLane: { left: '16%', width: '68%', top: '56%', marginTop: -LAND_PET, height: LAND_PET },
  waterLane: { left: '22%', width: '56%', top: '74%', height: '14%' },
  skyPlus: { position: 'absolute', zIndex: 3, left: 0, right: 0, top: '14%', height: '22%', alignItems: 'center', justifyContent: 'center' },
  landPlus: {
    position: 'absolute',
    zIndex: 3,
    left: 0,
    right: 0,
    top: '56%',
    marginTop: -LAND_PET,
    height: LAND_PET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterPlus: { position: 'absolute', zIndex: 3, left: 0, right: 0, top: '74%', height: '14%', alignItems: 'center', justifyContent: 'center' },
  plus: {
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
});
