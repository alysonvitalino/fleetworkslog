// Variáveis do Vite ficam embutidas no bundle: nunca colocar segredos aqui
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN ?? '',
};
