// Creature art. Creatures not listed here show their emoji instead.
//
// To add art: save a square PNG with a transparent background as assets/pets/<id>.png, then add a line below.
// The id must match the creature's id (e.g. 'lobster', 'mit-beaver'). An optional eyes-closed frame,
// assets/pets/<id>-blink.png, makes the pet blink:
//
//   lobster: { base: require('../../assets/pets/lobster.png'), blink: require('../../assets/pets/lobster-blink.png') },
import type { ImageSourcePropType } from 'react-native';

export type PetArt = { base: ImageSourcePropType; blink?: ImageSourcePropType };

export const PET_ART: Partial<Record<string, PetArt>> = {};
