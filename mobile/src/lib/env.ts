// Variáveis EXPO_PUBLIC_* são embutidas no bundle pelo Expo: nunca colocar segredos aqui
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001',
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '',
};
