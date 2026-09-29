import * as SecureStore from 'expo-secure-store';

// Tokens ficam no Keychain (iOS) / Keystore (Android), nunca em AsyncStorage
const ACCESS_TOKEN_KEY = 'fleetworkslog.accessToken';
const REFRESH_TOKEN_KEY = 'fleetworkslog.refreshToken';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken, options);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken, options);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY, options),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY, options),
  ]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, options),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, options),
  ]);
}
