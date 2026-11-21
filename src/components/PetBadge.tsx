import { COMMON_COLOR, getPet, GOLD_COLOR, LINE_INFO } from '@game/catalog';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type Props = { petId: string; owned: boolean; isGold?: boolean; size?: number };

/**
 * Placeholder pet art: emoji on a circle.
 * Line color when the pet is line-exclusive or a line variant; commons stay neutral.
 * Swap the inner <Text> for a sprite keyed by petId later.
 */
export function PetBadge({ petId, owned, isGold = false, size = 56 }: Props) {
  const pet = getPet(petId);
  const tint = pet?.line ? LINE_INFO[pet.line].color : COMMON_COLOR;
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: owned ? tint : colors.locked,
          borderColor: isGold ? GOLD_COLOR : 'transparent',
          borderWidth: isGold ? Math.max(3, size / 14) : 0,
        },
      ]}
      accessibilityLabel={owned ? (pet?.name ?? petId) : 'Not found yet'}
    >
      <Text style={{ fontSize: size * 0.5, opacity: owned ? 1 : 0.35 }}>{owned ? (pet?.emoji ?? '?') : '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
