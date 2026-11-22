import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useStyles, type Palette } from '@/theme';
import { PixelIcon, type PixelIconName } from './PixelIcon';

const ICON: Record<string, PixelIconName> = {
  index: 'habitat',
  collection: 'collection',
  scan: 'scan',
  leaderboard: 'leaderboard',
  profile: 'profile',
};

const SCAN_SIZE = 60;
/** Radius of the bar's top corners. */
const CORNER = 20;

/**
 * Navy tab bar with rounded top corners and pixel icons. Scan is the raised square yellow button
 * (thick border, hard offset shadow), like the reveal's buttons.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // On the habitat the bar overlaps the scene a little, so the picture (not the page color) fills the
  // rounded corners.
  const overScene = state.routes[state.index]?.name === 'index';

  return (
    <View style={overScene ? styles.wrapOverScene : styles.wrap}>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const focused = state.index === index;

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };

          if (route.name === 'scan') {
            return (
              <View key={route.key} style={styles.slot}>
                <Pressable
                  onPress={onPress}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.scan,
                    focused && styles.scanFocused,
                    pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: '2px 2px 0px #05080F' },
                  ]}
                >
                  <PixelIcon name="scan" size={28} color="#10131C" />
                </Pressable>
              </View>
            );
          }

          const color = focused ? '#F2C53D' : '#9AA6BF';
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [styles.slot, styles.tab, pressed && { opacity: 0.7 }]}
            >
              <PixelIcon name={ICON[route.name] ?? 'habitat'} size={22} color={color} />
              <Text style={[styles.label, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // The rounded corners show the screen background behind them.
    wrap: { backgroundColor: c.background },
    wrapOverScene: { backgroundColor: 'transparent', marginTop: -CORNER },
    bar: {
      flexDirection: 'row',
      backgroundColor: c.sign,
      borderTopLeftRadius: CORNER,
      borderTopRightRadius: CORNER,
      paddingTop: 10,
      paddingHorizontal: 4,
    },
    slot: { flex: 1, alignItems: 'center' },
    tab: { gap: 4, minHeight: 44, justifyContent: 'center' },
    label: { fontFamily: fonts.heavy, fontSize: 11 },
    scan: {
      marginTop: -30,
      width: SCAN_SIZE,
      height: SCAN_SIZE,
      backgroundColor: c.accent,
      borderWidth: 4,
      borderColor: c.scheme === 'dark' ? '#05080F' : '#10131C',
      boxShadow: `4px 4px 0px ${c.scheme === 'dark' ? '#05080F' : '#10131C'}`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanFocused: { borderColor: '#E8ECF5' },
  });
