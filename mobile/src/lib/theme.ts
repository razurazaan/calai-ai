import { Platform, useColorScheme } from 'react-native';

// Same palette as the web client (client/src/styles.css)
const light = {
  bg: '#f5f5f7',
  card: '#ffffff',
  text: '#111114',
  muted: '#8a8a93',
  line: '#ececf0',
  primary: '#111114',
  onPrimary: '#ffffff',
  soft: '#f0f0f3',
  protein: '#e5604d',
  carbs: '#e9a23b',
  fat: '#4a86e8',
  good: '#2fa866',
  danger: '#d93a3a',
};

const dark: typeof light = {
  ...light,
  bg: '#0c0c0e',
  card: '#18181c',
  text: '#f3f3f5',
  muted: '#8d8d97',
  line: '#2a2a30',
  primary: '#f3f3f5',
  onPrimary: '#111114',
  soft: '#222228',
};

export type Palette = typeof light;

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const RADIUS = 20;

// Space the native tab bar takes at the bottom of tab screens
export const TAB_BAR_HEIGHT = Platform.select({ ios: 50, android: 80, default: 0 });
