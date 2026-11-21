import { Silkscreen_400Regular, Silkscreen_700Bold, useFonts } from '@expo-google-fonts/silkscreen';
import { LINE_INFO, type Line, type Rarity } from '@game/catalog';
import { EXP_TO_NEXT, LEVEL_CAP, pullProgress, type LevelState } from '@game/leveling';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EasingFunction,
  type SharedValue,
} from 'react-native-reanimated';
import { haptics } from '@/lib/haptics';
import { ExpBar } from '../ExpBar';
import { LivePet } from '../LivePet';
import { Stars } from '../Stars';
import { PixelSprite } from './PixelSprite';
import {
  ARROW,
  ARROW_PALETTE,
  BUS,
  CARD,
  cardPalette,
  DOOR_COLS,
  DOOR_LEFT,
  DOOR_RIGHT,
  DOOR_ROWS,
  READER,
  READER_PALETTE,
  SHADOW,
  SHADOW_PALETTE,
  SPARKLE,
  sparklePalette,
  TRAIN,
  VEHICLE_COLS,
  vehiclePalette,
} from './sprites';

export type PullRarity = Rarity;

export type RevealPet = {
  /** Art id: the file name in assets/pets/ (see src/lib/petArt.ts). */
  id: string;
  name: string;
  /** Shown until the creature has art. */
  emoji: string;
  rarity: PullRarity;
  /** The rarer line-colored version. Commons never have one. */
  isVariant: boolean;
  /** Gold pulls (1%) get a "Gold" name and gold sparkles. */
  isGold?: boolean;
};

type Props = {
  pet: RevealPet;
  /** The scanned station's line. Sets the vehicle's color; the Silver Line sends a bus. */
  line: Line;
  stationName: string;
  copies: number;
  isNew: boolean;
  /** A gold pull that upgraded a pet you already had. */
  becameGold?: boolean;
  onDone: () => void;
  /** Slows the whole sequence down (2 = half speed). For the reveal playground. */
  timeScale?: number;
};

export const RARITY_COLOR: Record<PullRarity, string> = {
  common: '#3B82F6',
  rare: '#E5484D',
  epic: '#A855F7',
  legendary: '#F5B700',
};
const RARITY_LABEL: Record<PullRarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
/** The station lights climb through these in order and stop at the pull's rarity. */
const TIERS: readonly PullRarity[] = ['common', 'rare', 'epic', 'legendary'];
const TIER_HAPTICS = [haptics.light, haptics.medium, haptics.heavy, haptics.success];

const C = {
  wall: ['#121829', '#172038', '#1C2744'],
  sign: '#0E1424',
  signEdge: '#E8ECF5',
  rail: '#5A6378',
  railTop: '#A8B0C2',
  trackBed: '#0B0F1A',
  edge: '#F2C53D',
  edgeDot: '#B98F17',
  floor: '#36405A',
  ledOff: '#2A3348',
  ink: '#10131C',
  text: '#F3F5FA',
  muted: '#9AA6BF',
  panel: '#F7F3E8',
  doorGlow: '#FFF2B8',
};

const LED_COUNT = 12;
const PARTICLE_COUNT = 18;
const SPARKLE_COUNT = 6;
const ARROW_COUNT = 8;
const PANEL_HEIGHT = 290;

/** Milliseconds for each part of the sequence (before timeScale). */
const T = {
  expDelay: 250,
  expFill: 480,
  levelUp: 1200,
  readerIn: 350,
  cardIn: 450,
  afterTap: 450,
  step: 460,
  flashHold: 420,
  legendaryHold: 600,
  arrive: 1250,
  doorsDelay: 220,
  doors: 380,
  emergeDelay: 200,
  emerge: 540,
  settle: 240,
  info: 300,
};

const LEVEL_UP_COLOR = '#FFE58A';

/** How full the EXP bar is for a level state (full at the cap). */
function barFraction(s: LevelState): number {
  return s.isMax ? 1 : s.exp / s.expToNext;
}

/** The state right after leveling up from `s`, before any leftover EXP is added. */
function levelAbove(s: LevelState): LevelState {
  const level = s.level + 1;
  const isMax = level >= LEVEL_CAP;
  return { level, exp: 0, expToNext: isMax ? 0 : EXP_TO_NEXT[level - 1], isMax };
}

/** Players can tap to skip once they've watched one full reveal this session. */
let hasSeenFullReveal = false;

/**
 * Pull reveal:
 *   1. a fare card taps the station's reader,
 *   2. the station lights climb through the rarity colors and flash the pull's rarity,
 *   3. a train in the line's color pulls in (the Silver Line sends a bus),
 *   4. the doors open and the pet hops out onto the platform,
 *   5. for duplicates, the EXP bar fills; each full bar is a level-up (banner, rising arrows, a new star).
 * Legendary pulls flash twice and shake the station. Line variants sparkle in the line color.
 */
export function PullReveal({ pet, line, stationName, copies, isNew, becameGold = false, onDone, timeScale = 1 }: Props) {
  const reduceMotion = useReducedMotion();
  const screen = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  const pixelFont = fontsLoaded ? styles.pixelFont : null;
  const pixelFontBold = fontsLoaded ? styles.pixelFontBold : null;

  const lineInfo = LINE_INFO[line];
  const rarityColor = RARITY_COLOR[pet.rarity];
  const isLegendary = pet.rarity === 'legendary';
  const showVariant = pet.isVariant && pet.rarity !== 'common';
  const isGold = pet.isGold === true;
  const hasSparkles = isLegendary || showVariant || isGold;
  const displayName = `${isGold ? 'Gold ' : ''}${pet.name}`;
  const vehicle = line === 'silver' ? BUS : TRAIN;
  const palette = useMemo(() => vehiclePalette(lineInfo.color), [lineInfo.color]);
  const cardColors = useMemo(() => cardPalette(lineInfo.color), [lineInfo.color]);
  const sparkleColors = useMemo(
    () => sparklePalette(showVariant ? lineInfo.color : RARITY_COLOR.legendary),
    [showVariant, lineInfo.color],
  );

  const steps = useMemo(() => TIERS.slice(0, TIERS.indexOf(pet.rarity) + 1).map((t) => RARITY_COLOR[t]), [pet.rarity]);
  // level 0 = lights off, level i = steps[i - 1]
  const levelInput = useMemo(() => Array.from({ length: steps.length + 1 }, (_, i) => i), [steps]);
  const levelColors = useMemo(() => [C.ledOff, ...steps], [steps]);

  // Scene geometry. The scene is measured on layout; until then, estimate from the window.
  const [scene, setScene] = useState({ w: screen.width, h: Math.max(360, screen.height - PANEL_HEIGHT - 80) });
  const W = scene.w;
  const H = scene.h;
  const P = Math.max(4, Math.min(9, Math.floor((W - 32) / VEHICLE_COLS))); // one sprite pixel, in points
  const vehicleW = VEHICLE_COLS * P;
  const vehicleH = vehicle.rows.length * P;
  const trackY = Math.round(H * 0.58);
  const vehicleLeft = Math.round((W - vehicleW) / 2);
  const vehicleTop = trackY - vehicleH;
  const doorLeft = vehicle.door.col * P;
  const doorTop = vehicle.door.row * P;
  const door = { x: vehicleLeft + doorLeft + (DOOR_COLS * P) / 2, y: vehicleTop + doorTop + (DOOR_ROWS * P) / 2 };
  const platformTop = trackY + 2 * P;
  const petSize = Math.min(150, Math.round(W * 0.38));
  const petFeetY = Math.min(H - 10, platformTop + Math.round((H - platformTop) * 0.72));
  const pet0 = { x: W / 2, y: petFeetY - petSize / 2 }; // where the pet ends up (center)
  const ledSize = Math.max(8, Math.round(P * 1.6));
  const readerTop = Math.min(H - 16 * P - 8, platformTop + 6 * P) - 10 * P; // post foot on the platform

  const particles = useMemo<ParticleSpec[]>(() => {
    const colors = [rarityColor, lineInfo.color, '#FFFFFF', C.doorGlow];
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      distance: 70 + Math.random() * 90,
      size: Math.max(4, Math.round(P * (0.8 + Math.random() * 0.8))),
      color: colors[i % colors.length],
    }));
  }, [rarityColor, lineInfo.color, P]);

  const sparkles = useMemo(
    () =>
      Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
        angle: (i / SPARKLE_COUNT) * Math.PI * 2 + 0.3,
        radius: 0.55 + (i % 2) * 0.15,
        phase: i / SPARKLE_COUNT,
      })),
    [],
  );

  const arrows = useMemo(
    () =>
      Array.from({ length: ARROW_COUNT }, (_, i) => ({
        dx: ((i + 0.5) / ARROW_COUNT - 0.5) * petSize * 1.1,
        rise: petSize * (0.8 + (i % 3) * 0.2),
        start: (i % 4) * 0.12, // stagger: each arrow starts a little later
      })),
    [petSize],
  );

  // Leveling: duplicates fill the EXP bar (rules in supabase/functions/_shared/game/leveling.ts).
  const progress = useMemo(() => pullProgress(copies, pet.rarity), [copies, pet.rarity]);
  const [shown, setShown] = useState<LevelState>(progress.before ?? progress.after);

  const readerIn = useSharedValue(0);
  const card = useSharedValue(0);
  const ripple = useSharedValue(0);
  const readerOut = useSharedValue(0);
  const fill = useSharedValue(0);
  const level = useSharedValue(0);
  const flash = useSharedValue(0);
  const glow = useSharedValue(0); // the station tinted in the current rarity color
  const shake = useSharedValue(0);
  const arrive = useSharedValue(0);
  const stopBump = useSharedValue(0);
  const doors = useSharedValue(0);
  const burst = useSharedValue(0);
  const emerge = useSharedValue(0);
  const land = useSharedValue(0);
  const sparkle = useSharedValue(0);
  const twinkle = useSharedValue(0);
  const info = useSharedValue(0);
  const stamp = useSharedValue(0);
  const expFill = useSharedValue(barFraction(progress.before ?? progress.after));
  const expPop = useSharedValue(0); // the "+50 EXP" float
  const lvBanner = useSharedValue(0);
  const lvBurst = useSharedValue(0);
  const lvGlow = useSharedValue(0);
  const lvHop = useSharedValue(0);
  const starPop = useSharedValue(1);

  const [finished, setFinished] = useState(false);
  const canSkip = useRef(hasSeenFullReveal).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startTwinkle = () => {
    twinkle.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1);
  };

  const markFinished = () => {
    setFinished(true);
    hasSeenFullReveal = true;
  };

  /** Jumps straight to the end (skip, or reduced motion). */
  const showFinalState = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    readerIn.value = 1;
    card.value = 1;
    ripple.value = 1;
    readerOut.value = 1;
    fill.value = 1;
    level.value = steps.length;
    flash.value = 0;
    glow.value = 0.18;
    shake.value = 0;
    arrive.value = 1;
    stopBump.value = 0;
    doors.value = 1;
    burst.value = 1;
    emerge.value = 1;
    land.value = 0;
    sparkle.value = hasSparkles ? 1 : 0;
    info.value = withTiming(1, { duration: 200 });
    stamp.value = 1;
    setShown(progress.after);
    expFill.value = barFraction(progress.after);
    expPop.value = 0;
    lvBanner.value = 0;
    lvBurst.value = 0;
    lvGlow.value = 0;
    lvHop.value = 0;
    starPop.value = 1;
    startTwinkle();
    markFinished();
  };

  useEffect(() => {
    const variantText = showVariant ? `, ${lineInfo.name} variant` : '';
    const announce = () =>
      AccessibilityInfo.announceForAccessibility(`${displayName}, ${RARITY_LABEL[pet.rarity]}${variantText}`);
    if (reduceMotion) {
      showFinalState();
      haptics.success();
      announce();
      return;
    }

    // Every timer and tween goes through these, so timeScale can slow the whole sequence down.
    const at = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms * timeScale));
    };
    const timing = (to: number, config: { duration: number; easing?: EasingFunction }) =>
      withTiming(to, { ...config, duration: config.duration * timeScale });
    const delay = (ms: number, animation: number) => withDelay(ms * timeScale, animation);
    let t = 0;

    // 1. The reader rises, the fare card taps it, and both drop away.
    readerIn.value = timing(1, { duration: T.readerIn, easing: Easing.out(Easing.back(1.4)) });
    card.value = delay(150, timing(1, { duration: T.cardIn, easing: Easing.out(Easing.cubic) }));
    t += 150 + T.cardIn;
    at(t, () => {
      haptics.tick();
      ripple.value = timing(1, { duration: 500, easing: Easing.out(Easing.quad) });
      readerOut.value = delay(250, timing(1, { duration: 280, easing: Easing.in(Easing.cubic) }));
    });
    t += T.afterTap;

    // 2. The station lights climb one rarity at a time, then the whole station flashes the result.
    steps.forEach((_, i) => {
      at(t, () => {
        level.value = i + 1;
        fill.value = 0;
        fill.value = timing(1, { duration: 260, easing: Easing.out(Easing.quad) });
        glow.value = withSequence(timing(0.38, { duration: 80 }), timing(0.12, { duration: 380 }));
        TIER_HAPTICS[i]();
      });
      if (i < steps.length - 1) t += T.step;
    });
    t += 300;
    const flashOnce = () => {
      flash.value = withSequence(timing(0.75, { duration: 80 }), timing(0, { duration: 480 }));
      glow.value = withSequence(timing(0.45, { duration: 80 }), timing(0.18, { duration: 700 }));
    };
    at(t, () => {
      flashOnce();
      haptics.heavy();
    });
    if (isLegendary) {
      at(t + 380, () => {
        flashOnce();
        haptics.success();
        shake.value = withSequence(
          ...Array.from({ length: 12 }, (_, k) => timing(k % 2 ? -1 : 1, { duration: 45 })),
          timing(0, { duration: 45 }),
        );
      });
      t += T.legendaryHold;
    }
    t += T.flashHold;

    // 3. The train (or bus) pulls in from the right, rumbling and slowing to a stop.
    at(t, () => {
      arrive.value = timing(1, { duration: T.arrive, easing: Easing.out(Easing.cubic) });
    });
    [0, 180, 350, 500, 640, 760, 870].forEach((d) => at(t + d, haptics.light));
    t += T.arrive;
    at(t, () => {
      haptics.medium();
      stopBump.value = withSequence(timing(1, { duration: 90 }), withSpring(0, { damping: 8, stiffness: 240 }));
    });

    // 4. The doors slide open, light and particles spill out, and the pet hops onto the platform.
    t += T.doorsDelay;
    at(t, () => {
      haptics.light();
      doors.value = timing(1, { duration: T.doors, easing: Easing.inOut(Easing.cubic) });
      burst.value = delay(140, timing(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
    });
    t += T.doors + T.emergeDelay;
    at(t, () => {
      emerge.value = timing(1, { duration: T.emerge, easing: Easing.inOut(Easing.quad) });
    });
    t += T.emerge;
    at(t, () => {
      haptics.medium();
      land.value = withSequence(timing(1, { duration: 70 }), withSpring(0, { damping: 6, stiffness: 220 }));
      if (hasSparkles) {
        sparkle.value = timing(1, { duration: 300 });
        startTwinkle();
      }
      announce();
    });
    t += T.settle;
    at(t, () => {
      info.value = timing(1, { duration: T.info, easing: Easing.out(Easing.cubic) });
    });
    t += T.info;
    if (isNew || showVariant || becameGold) {
      at(t, () => {
        stamp.value = withSpring(1, { damping: 9, stiffness: 260 });
        haptics.success();
      });
      t += 250;
    }

    // 5. A duplicate fills the EXP bar. Each time it fills, the pet levels up and the rest carries over.
    if (progress.before && progress.gained > 0) {
      const playLevelUp = () => {
        haptics.success();
        lvBanner.value = withSequence(
          timing(1, { duration: 280, easing: Easing.out(Easing.back(2.2)) }),
          delay(650, timing(0, { duration: 220 })),
        );
        lvBurst.value = 0;
        lvBurst.value = timing(1, { duration: 1000, easing: Easing.out(Easing.quad) });
        lvGlow.value = withSequence(timing(1, { duration: 120 }), timing(0, { duration: 800 }));
        lvHop.value = withSequence(
          timing(1, { duration: 180, easing: Easing.out(Easing.quad) }),
          withSpring(0, { damping: 7, stiffness: 180 }),
        );
        starPop.value = 0;
        starPop.value = withSpring(1, { damping: 7, stiffness: 200 });
      };

      t += T.expDelay;
      at(t, () => {
        haptics.tick();
        expPop.value = timing(1, { duration: 1100, easing: Easing.out(Easing.quad) });
      });
      let state = progress.before;
      for (let i = 0; i < progress.levelsGained; i++) {
        const reached = levelAbove(state);
        at(t, () => {
          expFill.value = timing(1, { duration: T.expFill, easing: Easing.inOut(Easing.quad) });
        });
        t += T.expFill;
        at(t, () => {
          setShown(reached);
          expFill.value = barFraction(reached);
          playLevelUp();
        });
        t += T.levelUp;
        state = reached;
      }
      if (!progress.after.isMax) {
        at(t, () => {
          setShown(progress.after);
          expFill.value = timing(barFraction(progress.after), { duration: T.expFill, easing: Easing.out(Easing.quad) });
        });
        t += T.expFill;
      }
    }
    at(t, markFinished);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // One sequence per reveal: callers mount a fresh reveal for every pull, so this runs once.
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value * 5 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    backgroundColor: interpolateColor(level.value, levelInput, levelColors),
  }));
  const readerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - readerIn.value) * H + readerOut.value * H }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value > 0 ? 1 : 0,
    transform: [
      { translateY: (1 - card.value) * H * 0.8 + readerOut.value * H },
      { rotate: `${-16 + card.value * 10}deg` },
    ],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: ripple.value > 0 && ripple.value < 1 ? 1 - ripple.value : 0,
    transform: [{ scale: 0.6 + ripple.value * 2.2 }],
  }));
  const signStyle = useAnimatedStyle(() => ({
    borderColor: level.value === 0 ? C.signEdge : interpolateColor(level.value, levelInput, levelColors),
  }));
  const vehicleStyle = useAnimatedStyle(() => {
    const a = arrive.value;
    return {
      opacity: a > 0 ? 1 : 0,
      transform: [
        { translateX: (1 - a) * (W - vehicleLeft + 12) },
        { translateY: Math.sin(a * 46) * P * 0.35 * (1 - a) - stopBump.value * P * 0.6 },
      ],
    };
  });
  const leftDoorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -doors.value * 3 * P }] }));
  const rightDoorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: doors.value * 3 * P }] }));
  const doorGlowStyle = useAnimatedStyle(() => ({ opacity: doors.value * 0.55 }));
  const petStyle = useAnimatedStyle(() => {
    const e = emerge.value;
    const s = 0.3 + 0.7 * e;
    return {
      opacity: e > 0 ? 1 : 0,
      transform: [
        { translateX: (door.x - pet0.x) * (1 - e) },
        { translateY: (door.y - pet0.y) * (1 - e) - Math.sin(Math.PI * e) * petSize * 0.55 - lvHop.value * petSize * 0.3 },
        { scale: s },
        { scaleX: 1 + land.value * 0.14 },
        { scaleY: 1 - land.value * 0.14 },
      ],
    };
  });
  const shadowStyle = useAnimatedStyle(() => ({ opacity: emerge.value ** 4 }));
  const infoStyle = useAnimatedStyle(() => ({
    opacity: info.value,
    transform: [{ translateY: (1 - info.value) * 30 }],
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value > 0 ? 1 : 0,
    transform: [{ scale: 1.8 - stamp.value * 0.8 }, { rotate: '-8deg' }],
  }));
  const petGlowStyle = useAnimatedStyle(() => ({
    opacity: lvGlow.value * 0.8,
    transform: [{ rotate: '45deg' }, { scale: 0.5 + lvGlow.value * 0.9 }],
  }));
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: lvBanner.value > 0.02 ? Math.min(1, lvBanner.value * 1.5) : 0,
    transform: [{ translateY: (1 - lvBanner.value) * 16 }, { scale: 0.4 + 0.6 * lvBanner.value }],
  }));
  const expPopStyle = useAnimatedStyle(() => ({
    opacity: expPop.value > 0 && expPop.value < 1 ? 1 - expPop.value ** 3 : 0,
    transform: [{ translateY: -expPop.value * 26 }],
  }));
  const starsStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (1 - starPop.value) * 0.6 }] }));

  const variantLabel = `${lineInfo.name} variant`;

  return (
    <Pressable style={styles.root} onPress={canSkip && !finished ? showFinalState : undefined} accessible={false}>
      <Animated.View
        style={[styles.scene, shakeStyle]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (Math.round(width) !== scene.w || Math.round(height) !== scene.h) {
            setScene({ w: Math.round(width), h: Math.round(height) });
          }
        }}
      >
        {/* Tunnel wall, in flat pixel-style bands */}
        {C.wall.map((color, i) => (
          <View key={color} style={[styles.abs, { left: 0, right: 0, top: (trackY / 3) * i, height: trackY / 3 + 1, backgroundColor: color }]} />
        ))}

        {/* The station glows in the rarity color as the lights climb */}
        <Animated.View style={[styles.abs, styles.noTouch, { left: 0, right: 0, top: 0, height: trackY }, glowStyle]} />

        {/* Station sign and rarity lights */}
        <View style={[styles.abs, styles.signWrap]}>
          <Animated.View style={[styles.sign, signStyle]}>
            <View style={[styles.signLine, { backgroundColor: lineInfo.color }]} />
            <View style={styles.signText}>
              <Text style={[styles.signName, pixelFontBold]} numberOfLines={1}>
                {stationName.toUpperCase()}
              </Text>
              <Text style={[styles.signSub, pixelFont]}>{lineInfo.name.toUpperCase()}</Text>
            </View>
          </Animated.View>
          <View style={[styles.leds, { gap: Math.max(2, Math.round(P / 2)) }]}>
            {Array.from({ length: LED_COUNT }, (_, i) => (
              <LedSegment
                key={i}
                index={i}
                size={ledSize}
                fill={fill}
                level={level}
                levelInput={levelInput}
                levelColors={levelColors}
              />
            ))}
          </View>
        </View>

        {/* Vehicle, with its doors and the light inside */}
        <Animated.View style={[styles.abs, { left: vehicleLeft, top: vehicleTop, width: vehicleW, height: vehicleH }, vehicleStyle]}>
          <PixelSprite rows={vehicle.rows} palette={palette} pixel={P} />
          <Animated.View
            style={[
              styles.abs,
              { left: doorLeft, top: doorTop, width: DOOR_COLS * P, height: DOOR_ROWS * P },
              { backgroundColor: C.doorGlow },
              doorGlowStyle,
            ]}
          />
          <Animated.View style={[styles.abs, { left: doorLeft, top: doorTop }, leftDoorStyle]}>
            <PixelSprite rows={DOOR_LEFT} palette={palette} pixel={P} />
          </Animated.View>
          <Animated.View style={[styles.abs, { left: doorLeft + 3 * P, top: doorTop }, rightDoorStyle]}>
            <PixelSprite rows={DOOR_RIGHT} palette={palette} pixel={P} />
          </Animated.View>
        </Animated.View>

        {/* Track and platform */}
        <View style={[styles.abs, { left: 0, right: 0, top: trackY, height: 2 * P, backgroundColor: C.trackBed }]}>
          <View style={{ height: Math.max(2, Math.round(P / 2)), backgroundColor: C.railTop }} />
          <View style={{ height: Math.max(2, Math.round(P / 2)), backgroundColor: C.rail }} />
        </View>
        <View style={[styles.abs, { left: 0, right: 0, top: platformTop, bottom: 0, backgroundColor: C.floor }]}>
          <View style={[styles.edge, { height: 2 * P, gap: 2 * P }]}>
            {Array.from({ length: Math.ceil(W / (3 * P)) }, (_, i) => (
              <View key={i} style={{ width: P, height: P, backgroundColor: C.edgeDot }} />
            ))}
          </View>
        </View>

        {/* Particles from the doorway */}
        <View style={[styles.abs, { left: door.x, top: door.y, width: 0, height: 0 }]}>
          {particles.map((p, i) => (
            <Particle key={i} burst={burst} {...p} />
          ))}
        </View>

        {/* The pet, its shadow, and sparkles for legendaries and line variants */}
        <Animated.View style={[styles.abs, { left: pet0.x - 5 * P, top: petFeetY - Math.round(petSize * 0.12) - 2 * P }, shadowStyle]}>
          <PixelSprite rows={SHADOW} palette={SHADOW_PALETTE} pixel={P} />
        </Animated.View>
        {sparkles.map((s, i) => (
          <Sparkle
            key={i}
            sparkle={sparkle}
            twinkle={twinkle}
            phase={s.phase}
            x={pet0.x + Math.cos(s.angle) * petSize * s.radius}
            y={pet0.y + Math.sin(s.angle) * petSize * s.radius}
            pixel={Math.max(3, Math.round(P * 0.75))}
            palette={sparkleColors}
          />
        ))}
        {/* Level-up glow behind the pet: a pixel-style diamond */}
        <Animated.View
          style={[
            styles.abs,
            styles.noTouch,
            { left: pet0.x - petSize * 0.5, top: pet0.y - petSize * 0.5, width: petSize, height: petSize },
            { backgroundColor: LEVEL_UP_COLOR },
            petGlowStyle,
          ]}
        />
        <Animated.View
          style={[styles.abs, { left: pet0.x - petSize / 2, top: pet0.y - petSize / 2, transformOrigin: 'center bottom' }, petStyle]}
        >
          <LivePet id={pet.id} name={displayName} emoji={pet.emoji} size={petSize} active={finished} />
        </Animated.View>

        {/* Level-up: arrows rise from the pet and a banner pops over it */}
        {arrows.map((a, i) => (
          <LevelArrow
            key={i}
            burst={lvBurst}
            x={pet0.x + a.dx}
            y={pet0.y + petSize * 0.25}
            rise={a.rise}
            start={a.start}
            pixel={Math.max(3, Math.round(P * 0.7))}
          />
        ))}
        <Animated.View style={[styles.abs, styles.noTouch, styles.banner, { top: pet0.y - petSize * 0.95 }, bannerStyle]}>
          <OutlinedText text="LEVEL UP!" style={[styles.bannerText, pixelFontBold]} />
        </Animated.View>

        {/* Fare reader and card (beat 1) */}
        <Animated.View style={[styles.abs, { left: W / 2 - 6 * P, top: readerTop }, readerStyle]}>
          <PixelSprite rows={READER} palette={READER_PALETTE} pixel={P} />
          <Animated.View
            style={[
              styles.abs,
              { left: 3 * P, top: 3 * P, width: 6 * P, height: 4 * P, borderWidth: Math.max(2, P / 2), borderColor: lineInfo.color },
              rippleStyle,
            ]}
          />
        </Animated.View>
        <Animated.View style={[styles.abs, { left: W / 2 - 4 * P, top: readerTop - P }, cardStyle]}>
          <PixelSprite rows={CARD} palette={cardColors} pixel={P} />
        </Animated.View>
      </Animated.View>

      {/* Result card */}
      <View style={styles.panelArea}>
        <Animated.View style={[styles.panelWrap, infoStyle]}>
          <View style={styles.panelShadow} />
          <View style={styles.panel}>
            <View style={styles.stamps}>
              {isNew && (
                <Animated.View style={[styles.stamp, { backgroundColor: '#E5484D' }, stampStyle]}>
                  <Text style={[styles.stampText, pixelFontBold]}>NEW!</Text>
                </Animated.View>
              )}
              {becameGold && (
                <Animated.View style={[styles.stamp, { backgroundColor: RARITY_COLOR.legendary }, stampStyle]}>
                  <Text style={[styles.stampText, pixelFontBold, { color: C.ink }]}>TURNED GOLD!</Text>
                </Animated.View>
              )}
            </View>
            <View style={[styles.rarityChip, { backgroundColor: rarityColor }]}>
              <Text style={[styles.rarityText, pixelFontBold, { color: isLegendary ? C.ink : '#FFFFFF' }]}>
                {RARITY_LABEL[pet.rarity].toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.name, pixelFontBold]} numberOfLines={2}>
              {displayName}
            </Text>
            {showVariant && (
              <Animated.View style={[styles.variantChip, { borderColor: lineInfo.color }, stampStyle]}>
                <View style={[styles.variantDot, { backgroundColor: lineInfo.color }]} />
                <Text style={[styles.variantText, pixelFont]}>{variantLabel.toUpperCase()}</Text>
              </Animated.View>
            )}
            <Animated.View style={starsStyle}>
              <Stars copies={copies} level={shown.level} size={20} />
            </Animated.View>
            <View style={styles.expRow}>
              <ExpBar
                level={shown.level}
                isMax={shown.isMax}
                fill={expFill}
                detail={`${shown.exp} / ${shown.expToNext} EXP`}
                fontStyle={pixelFont}
              />
              {progress.gained > 0 && (
                <Animated.Text style={[styles.expPop, pixelFontBold, expPopStyle]}>+{progress.gained} EXP</Animated.Text>
              )}
            </View>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, !finished && styles.hidden]}
              onPress={onDone}
              disabled={!finished}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, pixelFontBold]}>CONTINUE</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.noTouch, { backgroundColor: rarityColor }, flashStyle]} />
      {canSkip && !finished && <Text style={[styles.skipHint, pixelFont]}>TAP TO SKIP</Text>}
    </Pressable>
  );
}

type LedProps = {
  index: number;
  size: number;
  fill: SharedValue<number>;
  level: SharedValue<number>;
  levelInput: number[];
  levelColors: string[];
};

function LedSegment({ index, size, fill, level, levelInput, levelColors }: LedProps) {
  const style = useAnimatedStyle(() => ({
    backgroundColor:
      level.value > 0 && fill.value * LED_COUNT > index ? interpolateColor(level.value, levelInput, levelColors) : C.ledOff,
  }));
  return <Animated.View style={[{ width: size, height: size }, style]} />;
}

type ParticleSpec = { angle: number; distance: number; size: number; color: string };

function Particle({ burst, angle, distance, size, color }: ParticleSpec & { burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = burst.value;
    return {
      opacity: p > 0 && p < 1 ? 1 - p * p : 0,
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        { translateY: Math.sin(angle) * distance * p + 70 * p * p },
      ],
    };
  });
  // Square particles: they read as pixels.
  return (
    <Animated.View
      style={[styles.abs, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, backgroundColor: color }, style]}
    />
  );
}

type SparkleProps = {
  sparkle: SharedValue<number>;
  twinkle: SharedValue<number>;
  phase: number;
  x: number;
  y: number;
  pixel: number;
  palette: Record<string, string>;
};

function Sparkle({ sparkle, twinkle, phase, x, y, pixel, palette }: SparkleProps) {
  const size = 5 * pixel;
  const style = useAnimatedStyle(() => {
    const wave = (Math.sin((twinkle.value + phase) * Math.PI * 2) + 1) / 2;
    return { opacity: sparkle.value * (0.25 + 0.75 * wave), transform: [{ scale: 0.6 + 0.5 * wave }] };
  });
  return (
    <Animated.View style={[styles.abs, styles.noTouch, { left: x - size / 2, top: y - size / 2 }, style]}>
      <PixelSprite rows={SPARKLE} palette={palette} pixel={pixel} />
    </Animated.View>
  );
}

type ArrowProps = { burst: SharedValue<number>; x: number; y: number; rise: number; start: number; pixel: number };

function LevelArrow({ burst, x, y, rise, start, pixel }: ArrowProps) {
  const size = 7 * pixel;
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (burst.value - start) / (1 - start)));
    return { opacity: p > 0 && p < 1 ? 1 - p * p : 0, transform: [{ translateY: -p * rise }] };
  });
  return (
    <Animated.View style={[styles.abs, styles.noTouch, { left: x - size / 2, top: y - size / 2 }, style]}>
      <PixelSprite rows={ARROW} palette={ARROW_PALETTE} pixel={pixel} />
    </Animated.View>
  );
}

const OUTLINE_OFFSETS = [
  [-3, 0],
  [3, 0],
  [0, -3],
  [0, 3],
  [-3, -3],
  [3, 3],
  [-3, 3],
  [3, -3],
] as const;

/** Text with a chunky dark outline, like a pixel-game banner. */
function OutlinedText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  return (
    <View>
      {/* Each outline copy is pinned to the main text's box (shifted), so it can't wrap differently. */}
      {OUTLINE_OFFSETS.map(([dx, dy], i) => (
        <Text key={i} numberOfLines={1} style={[style, styles.outline, { left: dx, top: dy, right: -dx, bottom: -dy }]}>
          {text}
        </Text>
      ))}
      <Text numberOfLines={1} style={style}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.floor, overflow: 'hidden' },
  banner: { left: 0, right: 0, alignItems: 'center' },
  bannerText: { fontSize: 30, fontWeight: '900', color: '#FFD84D', letterSpacing: 2 },
  outline: { position: 'absolute', color: C.ink },
  expRow: { alignSelf: 'stretch' },
  expPop: { position: 'absolute', right: 0, top: -20, color: '#16A34A', fontSize: 14, fontWeight: '800' },
  scene: { flex: 1, overflow: 'hidden' },
  abs: { position: 'absolute' },
  noTouch: { pointerEvents: 'none' },
  pixelFont: { fontFamily: 'Silkscreen_400Regular', fontWeight: 'normal' },
  pixelFontBold: { fontFamily: 'Silkscreen_700Bold', fontWeight: 'normal' },

  signWrap: { top: 18, left: 0, right: 0, alignItems: 'center', gap: 12 },
  sign: {
    flexDirection: 'row',
    alignItems: 'stretch',
    maxWidth: '86%',
    backgroundColor: C.sign,
    borderWidth: 4,
  },
  signLine: { width: 12 },
  signText: { paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
  signName: { color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  signSub: { color: C.muted, fontSize: 11, letterSpacing: 2 },
  leds: { flexDirection: 'row' },

  edge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.edge, paddingHorizontal: 4, overflow: 'hidden' },

  // Sized by its content, so long names (two lines) and extra stamps never push the card off screen.
  panelArea: { alignItems: 'center', paddingTop: 16, paddingBottom: 22 },
  panelWrap: { width: '88%', maxWidth: 380 },
  panel: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: C.panel,
    borderWidth: 4,
    borderColor: C.ink,
  },
  panelShadow: { position: 'absolute', top: 6, left: 6, right: -6, bottom: -6, backgroundColor: C.ink },
  stamps: { position: 'absolute', top: -18, right: 12, flexDirection: 'row', gap: 6 },
  stamp: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 3, borderColor: C.ink },
  stampText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  rarityChip: { paddingHorizontal: 10, paddingVertical: 3, borderWidth: 3, borderColor: C.ink },
  rarityText: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  name: { fontSize: 22, fontWeight: '800', color: C.ink, textAlign: 'center' },
  variantChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 3, paddingHorizontal: 8, paddingVertical: 2 },
  variantDot: { width: 10, height: 10 },
  variantText: { fontSize: 11, color: C.ink, letterSpacing: 1 },
  button: { marginTop: 4, backgroundColor: C.ink, paddingHorizontal: 28, paddingVertical: 12 },
  buttonPressed: { transform: [{ translateY: 2 }] },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 2 },
  hidden: { opacity: 0 },
  skipHint: { position: 'absolute', bottom: 6, alignSelf: 'center', color: C.muted, fontSize: 11 },
});
