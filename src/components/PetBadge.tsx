import { COMMON_COLOR, getPet, LINE_INFO } from '@game/catalog';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';
import { PetSprite } from './PetSprite';
import { RainbowStamp } from './Rainbow';

type Props = {
  petId: string;
  owned: boolean;
  /** The rainbow variant (stored as `is_gold`). */
  isGold?: boolean;
  size?: number;
};

/**
 * Pet art on a circle: line color for a line-exclusive, neutral for a shared common.
 * Art comes from src/lib/petArt.ts, keyed by pet id. Pets without art show their emoji.
 * Unowned pets show as a silhouette. Rainbow pets cycle through the rainbow and get a RAINBOW stamp.
 */
export function PetBadge({ petId, owned, isGold = false, size = 56 }: Props) {
  const pet = getPet(petId);
  const tint = pet?.line ? LINE_INFO[pet.line].color : COMMON_COLOR;
  const rainbow = owned && isGold;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={owned ? `${pet?.name ?? petId}${rainbow ? ', rainbow' : ''}` : 'Not found yet'}
    >
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: owned ? tint : colors.locked }]}>
        <PetSprite id={petId} emoji={pet?.emoji ?? '?'} size={size * 0.9} silhouette={!owned} rainbow={rainbow} />
      </View>
      {rainbow && <RainbowStamp size={size} />}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
