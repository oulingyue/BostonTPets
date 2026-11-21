export const colors = {
  background: '#F6F4EF',
  surface: '#FFFFFF',
  text: '#1B1B1B',
  muted: '#6B6B6B',
  border: '#E2DED6',
  primary: '#003DA5', // Blue Line
  danger: '#DA291C', // Red Line
  locked: '#D9D6CF',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

/** Rarity chip colors: light background, dark text. Shared by the collection and the pet sheet. */
export const rarityStyle = {
  common: { bg: '#ECEAE4', fg: '#4F4F4F' },
  rare: { bg: '#E6EEFA', fg: '#003DA5' },
  epic: { bg: '#F0E8FA', fg: '#6B2FA3' },
  legendary: { bg: '#FBEFD6', fg: '#8A5A00' },
} as const;
