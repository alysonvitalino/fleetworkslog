import { defineConfig } from 'vitest/config';

// Vitest cobre só lógica pura (sem imports de react-native).
// Testes de componente, quando necessários, devem usar jest-expo.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
