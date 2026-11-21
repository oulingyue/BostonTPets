import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

export const authStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  hero: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.xs },
  title: { fontSize: 34, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 32 },
  tagline: { fontSize: 15, color: colors.muted },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
  },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: spacing.md, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
});
