import { GOLD_COLOR, LINE_INFO, SPECIES_INFO, type Line, type Species } from '@game/catalog';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';
import { PetSprite } from './PetSprite';

type Props = {
  species: Species;
  line: Line;
  owned: boolean;
  isGold?: boolean;
  size?: number;
};

/**
 * Pet art on a circle in the line color (collection, history, species detail).
 * Unowned pets show as a silhouette. Art comes from assets/pets/ via PetSprite.
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
      <PetSprite id={species} emoji={SPECIES_INFO[species].emoji} size={size * 0.9} silhouette={!owned} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
