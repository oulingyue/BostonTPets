import { Tabs } from 'expo-router/js-tabs';
import { AppHeader } from '@/components/ui/AppHeader';
import { TabBar } from '@/components/ui/TabBar';
import { usePalette } from '@/theme';

export default function TabLayout() {
  const c = usePalette();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        header: ({ options }) => (
          <AppHeader
            title={typeof options.title === 'string' ? options.title : ''}
            right={options.headerRight?.({ tintColor: c.signText, canGoBack: false })}
          />
        ),
        sceneStyle: { backgroundColor: c.background },
        animation: 'none',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Habitat', headerShown: false }} />
      <Tabs.Screen name="collection" options={{ title: 'Collection' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', headerShown: false }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
