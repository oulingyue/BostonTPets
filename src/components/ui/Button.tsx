import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, hardShadow, usePalette, type Palette } from '@/theme';

export type ButtonVariant = 'accent' | 'strong' | 'outline' | 'danger';

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Rounded button with an outline and a hard shadow that presses down when tapped. */
export function Button({ title, onPress, variant = 'accent', disabled = false, busy = false, style, accessibilityLabel }: Props) {
  const c = usePalette();
  const { bg, fg, border } = colorsFor(c, variant);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border },
        pressed ? { transform: [{ translateY: 2 }], ...hardShadow(c, 1) } : hardShadow(c),
        (disabled || busy) && { opacity: 0.55 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.text, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

function colorsFor(c: Palette, variant: ButtonVariant) {
  switch (variant) {
    case 'strong':
      return { bg: c.strong, fg: c.onStrong, border: c.scheme === 'dark' ? c.shadow : c.border };
    case 'outline':
      return { bg: c.surface, fg: c.text, border: c.border };
    case 'danger':
      return { bg: c.surface, fg: c.danger, border: c.border };
    default:
      return { bg: c.accent, fg: c.onAccent, border: c.scheme === 'dark' ? c.shadow : c.border };
  }
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: fonts.heavy, fontSize: 16 },
});
