import { StyleSheet } from 'react-native';
import { fonts, hardShadow, spacing, useStyles, type Palette } from '@/theme';

const makeAuthStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: c.background },
    hero: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm },
    sign: {
      alignSelf: 'stretch',
      backgroundColor: c.sign,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#E8ECF5',
      overflow: 'hidden',
      alignItems: 'center',
    },
    title: { fontFamily: fonts.pixelBold, fontSize: 28, letterSpacing: 1.5, color: c.signText, paddingTop: 16, paddingBottom: 12 },
    subtitle: { fontSize: 32 },
    tagline: { fontFamily: fonts.bold, fontSize: 15, color: c.muted, textAlign: 'center' },
    input: {
      backgroundColor: c.input,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      fontFamily: fonts.bold,
      fontSize: 16,
      color: c.text,
    },
    button: {
      backgroundColor: c.accent,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.scheme === 'dark' ? c.shadow : c.border,
      padding: spacing.md,
      alignItems: 'center',
      ...hardShadow(c),
    },
    disabled: { opacity: 0.5 },
    buttonText: { fontFamily: fonts.heavy, color: c.onAccent, fontSize: 16 },
    link: { fontFamily: fonts.heavy, textAlign: 'center', color: c.link, marginTop: spacing.sm },
  });

/** Styles shared by the sign-in and sign-up screens. */
export function useAuthStyles() {
  return useStyles(makeAuthStyles);
}
