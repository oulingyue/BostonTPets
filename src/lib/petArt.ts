// Creature art. Creatures not listed here show their emoji instead.
//
// To add art: save a square PNG with a transparent background as assets/pets/<id>.png, then add a line below.
// The id is the creature's id in catalog.ts (e.g. 'lobster', 'mit_beaver').
// An optional eyes-closed frame, assets/pets/<id>-blink.png, makes the pet blink:
//
//   mit_beaver: { base: require('../../assets/pets/mit_beaver.png'), blink: require('../../assets/pets/mit_beaver-blink.png') },
import type { ImageSourcePropType } from 'react-native';

export type PetArt = { base: ImageSourcePropType; blink?: ImageSourcePropType };

// Legendaries: pixel art drawn by scripts/pixel-pets/generate.mjs (npm run pets).
export const PET_ART: Partial<Record<string, PetArt>> = {
  lobster: { base: require('../../assets/pets/lobster.png'), blink: require('../../assets/pets/lobster-blink.png') },
  snapping_turtle: {
    base: require('../../assets/pets/snapping_turtle.png'),
    blink: require('../../assets/pets/snapping_turtle-blink.png'),
  },
  red_fox: { base: require('../../assets/pets/red_fox.png'), blink: require('../../assets/pets/red_fox-blink.png') },
  humpback_whale: {
    base: require('../../assets/pets/humpback_whale.png'),
    blink: require('../../assets/pets/humpback_whale-blink.png'),
  },
  snowy_owl: { base: require('../../assets/pets/snowy_owl.png'), blink: require('../../assets/pets/snowy_owl-blink.png') },
};
