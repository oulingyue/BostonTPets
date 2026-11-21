import { GOLD_COLOR, petName, SPECIES_INFO, type Line, type Rarity, type Species } from '@game/catalog';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { PetBadge } from './PetBadge';
import { Stars } from './Stars';

const RARITY_LIGHT: Record<Rarity, string> = {
  common: '#3DBE5A',
  rare: '#2F80ED',
  legendary: '#9B51E0',
};

type Props = {
  pet: { species: Species; line: Line; isGold: boolean };
  stationName: string;
  copies: number;
  isNew: boolean;
  becameGold: boolean;
  onDone: () => void;
};

/**
 * Reveal sequence: CharlieCard taps the reader -> gate light shows rarity -> gates open -> pet appears.
 * Placeholder visuals built from Views; replace with real art/Lottie later without changing the props.
 */
export function FareGateReveal({ pet, stationName, copies, isNew, becameGold, onDone }: Props) {
  const tap = useRef(new Animated.Value(0)).current;
  const light = useRef(new Animated.Value(0)).current;
  const gates = useRef(new Animated.Value(0)).current;
  const petIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(tap, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(light, { toValue: 1, duration: 350, useNativeDriver: false }),
      Animated.delay(250),
      Animated.timing(gates, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.spring(petIn, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, [tap, light, gates, petIn]);

  const lightColor = pet.isGold ? GOLD_COLOR : RARITY_LIGHT[SPECIES_INFO[pet.species].rarity];

  return (
    <View style={styles.container}>
      <Text style={styles.station}>{stationName}</Text>

      <Animated.View
        style={[
          styles.light,
          { backgroundColor: light.interpolate({ inputRange: [0, 1], outputRange: ['#333333', lightColor] }) },
        ]}
      />

      <View style={styles.gateFrame}>
        <Animated.View
          style={[styles.petSlot, { opacity: petIn, transform: [{ scale: petIn }] }]}
        >
          <PetBadge species={pet.species} line={pet.line} owned isGold={pet.isGold} size={140} />
        </Animated.View>
        <Animated.View
          style={[
            styles.gate,
            styles.gateLeft,
            { transform: [{ translateX: gates.interpolate({ inputRange: [0, 1], outputRange: [0, -110] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.gate,
            styles.gateRight,
            { transform: [{ translateX: gates.interpolate({ inputRange: [0, 1], outputRange: [0, 110] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.charlieCard,
            {
              opacity: gates.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ translateY: tap.interpolate({ inputRange: [0, 1], outputRange: [160, 0] }) }],
            },
          ]}
        >
          <Text style={styles.charlieText}>CharlieCard</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.info, { opacity: petIn }]}>
        {isNew && <Text style={styles.newTag}>NEW!</Text>}
        {becameGold && <Text style={[styles.newTag, { backgroundColor: GOLD_COLOR }]}>TURNED GOLD!</Text>}
        <Text style={styles.name}>
          {pet.isGold ? 'Gold ' : ''}
          {petName(pet.line, pet.species)}
        </Text>
        <Text style={styles.rarity}>{SPECIES_INFO[pet.species].rarity}</Text>
        <Stars copies={copies} size={22} />
        <Pressable style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>Nice!</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  station: { fontSize: 18, fontWeight: '600', color: colors.muted },
  light: { width: 60, height: 14, borderRadius: 7 },
  gateFrame: {
    width: 220,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#EDEAE3',
  },
  petSlot: { position: 'absolute' },
  gate: { position: 'absolute', top: 0, bottom: 0, width: 110, backgroundColor: '#9AA3AB' },
  gateLeft: { left: 0, borderRightWidth: 2, borderColor: '#5E666D' },
  gateRight: { right: 0, borderLeftWidth: 2, borderColor: '#5E666D' },
  charlieCard: {
    position: 'absolute',
    width: 120,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  charlieText: { color: 'white', fontWeight: '800' },
  info: { alignItems: 'center', gap: spacing.sm },
  newTag: {
    backgroundColor: colors.danger,
    color: 'white',
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  rarity: { fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
