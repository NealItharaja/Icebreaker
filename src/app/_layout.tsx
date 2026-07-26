import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { RoomProvider } from '../game/room';
import { AppStoreProvider, useAppStore } from '../store/AppStore';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL as string, {
  unsavedChangesWarning: false,
});

function Nav() {
  const { t, dark } = useTheme();
  const { ready } = useAppStore();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  if (!fontsLoaded) return null;
  return (
    <ConvexProvider client={convex}>
      <ThemeProvider>
        <AppStoreProvider>
          <RoomProvider>
            <Nav />
          </RoomProvider>
        </AppStoreProvider>
      </ThemeProvider>
    </ConvexProvider>
  );
}
