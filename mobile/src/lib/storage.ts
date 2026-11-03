import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'calsnap_token';

// SecureStore (Keychain / Keystore) on device; SecureStore has no web support, so use localStorage there
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
