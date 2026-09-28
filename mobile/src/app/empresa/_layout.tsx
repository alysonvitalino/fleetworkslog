import { Stack } from 'expo-router';

// Área da EMPRESA (embarcador). A proteção por role entra na PUTF-25.
export default function EmpresaLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
