// The font picker at /dev/fonts: which font the pixel titles, headings and numbers use, and whether
// body text (the Nunito slots) uses it too. Screens bake font names into their StyleSheets when they're
// imported, so the choice is read synchronously when this module loads (theme.ts uses it), and picking a
// font saves it and reloads the app.
//
// Each font is registered under its own family names (AppPixel_<id>, AppPixelBold_<id>). expo-font never
// replaces a name that's already loaded, and on Android loaded names outlive a reload, so a shared name
// like "AppPixel" would keep the first font. Pixelify Sans keeps its usual names, so the default is unchanged.
import { PixelifySans_500Medium, PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { syncStorage } from './syncStorage';

export type FontOption = {
  id: string;
  label: string;
  regular: number;
  /** Omitted when the font has no bold file; the regular file then fills both slots. */
  bold?: number;
  /** License terms to know before shipping it (assets/fonts/ is in a public repo). */
  note?: string;
};

export type FontChoice = { font: string; everywhere: boolean };

const DEFAULT_CHOICE: FontChoice = { font: 'pixelify', everywhere: false };
const STORAGE_KEY = 'fontChoice';

// Files come from the zips in assets/fonts/; each font's license or readme sits next to it. Don't add a
// font whose license forbids redistribution (this repo is public): that's why "Pixel" isn't here.
export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'pixelify', label: 'Pixelify Sans (current)', regular: PixelifySans_500Medium, bold: PixelifySans_700Bold },
  {
    id: '04b_30',
    label: '04b_30',
    regular: require('../../assets/fonts/04b_30/04b_30.ttf'),
    note: 'Freeware, but not for commercial products.',
  },
  {
    id: 'daydream',
    label: 'Daydream (demo)',
    regular: require('../../assets/fonts/daydream/daydream-demo.otf'),
    note: 'Demo: personal use only. Letters and numbers only.',
  },
  {
    id: 'dogica',
    label: 'Dogica',
    regular: require('../../assets/fonts/dogica/dogica.ttf'),
    bold: require('../../assets/fonts/dogica/dogicabold.ttf'),
  },
  {
    id: 'kiwisoda',
    label: 'Kiwi Soda',
    regular: require('../../assets/fonts/kiwisoda/kiwisoda.ttf'),
    note: 'No license came with it.',
  },
  { id: 'press_start_2p', label: 'Press Start 2P', regular: require('../../assets/fonts/press_start_2p/press-start-2p.ttf') },
  {
    id: 'upheaval',
    label: 'Upheaval',
    regular: require('../../assets/fonts/upheaval/upheavtt.ttf'),
    note: 'Freeware; not to be sold.',
  },
];

/** The family names a font is registered under. */
export function familiesFor(option: FontOption): { regular: string; bold: string } {
  if (option.id === DEFAULT_CHOICE.font) return { regular: 'PixelifySans_500Medium', bold: 'PixelifySans_700Bold' };
  const regular = `AppPixel_${option.id}`;
  return { regular, bold: option.bold ? `AppPixelBold_${option.id}` : regular };
}

function fontMapFor(option: FontOption): Record<string, number> {
  const { regular, bold } = familiesFor(option);
  return { [regular]: option.regular, [bold]: option.bold ?? option.regular };
}

function readChoice(): FontChoice {
  try {
    const saved = JSON.parse(syncStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<FontChoice> | null;
    const font = FONT_OPTIONS.find((o) => o.id === saved?.font)?.id ?? DEFAULT_CHOICE.font;
    return { font, everywhere: saved?.everywhere === true };
  } catch {
    return DEFAULT_CHOICE;
  }
}

/** The choice this run of the app uses, read once at startup. */
export const fontChoice: FontChoice = readChoice();

const activeOption = FONT_OPTIONS.find((o) => o.id === fontChoice.font) ?? FONT_OPTIONS[0];

/** Family names of the chosen font (theme.ts puts them in `fonts`). */
export const pixelFamilies = familiesFor(activeOption);

/** Pass to useFonts to load the chosen font. */
export const activeFontMap = fontMapFor(activeOption);

/** Every option's fonts, for the picker's previews. */
export const allFontsMap: Record<string, number> = Object.assign({}, ...FONT_OPTIONS.map(fontMapFor));

/** Saves a new choice for the next start. Reload the app (reloadAppAsync) to apply it. Rejects if it can't save. */
export function saveFontChoice(choice: FontChoice): Promise<void> {
  return syncStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
}
