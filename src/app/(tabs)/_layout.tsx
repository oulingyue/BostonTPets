import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Collection',
          tabBarIcon: ({ focused }) => <TabIcon glyph="📖" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.scanButton, { backgroundColor: focused ? colors.primary : colors.text }]}>
              <Text style={{ fontSize: 26 }}>📷</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🚇" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const SCAN_BUTTON_SIZE = 56;

const styles = StyleSheet.create({
  // Raised center button. The tab bar gives each icon a small slot (about 28px tall) right above
  // its label, so the button is pinned to the slot's bottom edge and grows upward, keeping the
  // "Scan" label visible whatever the slot height is on each platform.
  scanButton: {
    position: 'absolute',
    bottom: 2,
    left: '50%',
    marginLeft: -SCAN_BUTTON_SIZE / 2,
    width: SCAN_BUTTON_SIZE,
    height: SCAN_BUTTON_SIZE,
    borderRadius: SCAN_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
