import { Alert, Platform } from 'react-native';

import type { Palette } from './theme';
import type { MacroKey, MealType } from './types';

// Local-time YYYY-MM-DD (not UTC, so late-night meals land on the right day)
export function dateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

export function guessMealType(date = new Date()): MealType {
  const h = date.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export const MACROS: { key: MacroKey; label: string; color: (c: Palette) => string }[] = [
  { key: 'protein', label: 'Protein', color: (c) => c.protein },
  { key: 'carbs', label: 'Carbs', color: (c) => c.carbs },
  { key: 'fat', label: 'Fat', color: (c) => c.fat },
];

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Alert.alert with buttons is a no-op on react-native-web, so fall back to window.confirm there
export function confirmAsync(title: string, message: string, okLabel = 'OK'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ])
  );
}
