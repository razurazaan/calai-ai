import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 5050;

// In production, point native builds at the website origin so they use the same backend.
// Local development keeps using the Express server on port 5050.
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (!__DEV__) return window.location.origin;
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;

  // Android emulator reaches the host machine at 10.0.2.2
  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
