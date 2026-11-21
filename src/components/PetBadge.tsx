import { GOLD_COLOR, LINE_INFO, SPECIES_INFO, type Line, type Species } from '@game/catalog';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type Props = { species: Species; line: Line; owned: boolean; isGold?: boolean; size?: number };

/**
 * Placeholder pet art: species emoji on a circle in the line color.
 * Swap the inner <Text> for real sprites later (base sprite + tinted color layer).
 */
export function PetBadge({ species, line, owned, isGold = false, size = 56 }: Props) {
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: owned ? LINE_INFO[line].color : colors.locked,
          borderColor: isGold ? GOLD_COLOR : 'transparent',
          borderWidth: isGold ? Math.max(3, size / 14) : 0,
        },
      ]}
      accessibilityLabel={owned ? `${LINE_INFO[line].name} ${SPECIES_INFO[species].name}` : 'Not found yet'}
    >
      <Text style={{ fontSize: size * 0.5, opacity: owned ? 1 : 0.35 }}>
        {owned ? SPECIES_INFO[species].emoji : '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
