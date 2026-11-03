import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { user, loading } = useAuth();
  const scheme = useColorScheme();
  const c = useColors();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null; // splash screen stays up while we check the saved session

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.bg, card: c.card, text: c.text, primary: c.text } };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        {/* index decides where to go; guarded screens redirect back to it when access is denied */}
        <Stack.Screen name="index" />

        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
        </Stack.Protected>

        <Stack.Protected guard={!!user && !user.onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={!!user?.onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="add/[mode]"
            options={{ headerShown: true, headerTransparent: false, headerShadowVisible: false, headerBackTitle: 'Back' }}
          />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
