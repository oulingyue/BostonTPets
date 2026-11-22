import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AppHeader } from '@/components/ui/AppHeader';
import { activeFontMap } from '@/lib/fontChoice';
import { SessionProvider, useSession } from '@/lib/session';
import { usePalette } from '@/theme';

export default function RootLayout() {
  // The header is navy in both day and night, so the status bar text stays light.
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();
  const c = usePalette();
  const [fontsLoaded, fontError] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    ...activeFontMap, // the pixel font: Pixelify Sans unless another is picked at /dev/fonts
  });

  // If the fonts fail to load, carry on with the system font rather than hang.
  if (isLoading || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  const signedIn = session !== null;

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: c.background },
        header: ({ options, back, navigation }) => (
          <AppHeader
            title={typeof options.title === 'string' ? options.title : ''}
            onBack={back ? navigation.goBack : undefined}
            right={options.headerRight?.({ canGoBack: !!back, tintColor: c.signText })}
            skipTopInset={options.presentation === 'modal'}
          />
        ),
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="habitat/[zone]" options={{ presentation: 'modal', title: 'Equip a pet' }} />
        <Stack.Screen name="species/[species]" options={{ title: '' }} />
        <Stack.Screen name="friends/search" options={{ title: 'Add friends' }} />
        <Stack.Screen name="user/[handle]/index" options={{ title: '' }} />
        <Stack.Screen name="user/[handle]/follows" options={{ title: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      </Stack.Protected>
    </Stack>
  );
}
