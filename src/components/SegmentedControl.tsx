import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, useStyles, type Palette } from '@/theme';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** A row of options in a sunken track; the selected one is a yellow outlined pill. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.segment, selected && styles.selected]}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    track: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 14, padding: 4, gap: 4 },
    segment: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: c.accent, borderColor: c.scheme === 'dark' ? c.shadow : c.border },
    label: { fontFamily: fonts.bold, fontSize: 15, color: c.muted },
    selectedLabel: { fontFamily: fonts.heavy, color: c.onAccent },
  });
