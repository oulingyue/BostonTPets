import { COMMON_COLOR, getPet, GOLD_COLOR, LINE_INFO } from '@game/catalog';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';
import { PetSprite } from './PetSprite';

type Props = { petId: string; owned: boolean; isGold?: boolean; size?: number };

/**
 * Pet art on a circle: line color for a line-exclusive, neutral for a shared common.
 * Art comes from src/lib/petArt.ts, keyed by pet id.
 * Pets without art show their emoji. Unowned pets show as a silhouette.
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
      <PetSprite id={petId} emoji={pet?.emoji ?? '?'} size={size * 0.9} silhouette={!owned} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
