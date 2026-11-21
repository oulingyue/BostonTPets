// Creature art. Creatures not listed here show their emoji instead.
//
// To add art: save a square PNG with a transparent background as assets/pets/<id>.png, then add a line below.
// The id is the creature's id in catalog.ts (e.g. 'lobster', 'mit_beaver').
// An optional eyes-closed frame, assets/pets/<id>-blink.png, makes the pet blink:
//
//   mit_beaver: { base: require('../../assets/pets/mit_beaver.png'), blink: require('../../assets/pets/mit_beaver-blink.png') },
import type { ImageSourcePropType } from 'react-native';

export type PetArt = { base: ImageSourcePropType; blink?: ImageSourcePropType };

export const PET_ART: Partial<Record<string, PetArt>> = {};
