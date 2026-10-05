import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Node's built-in localStorage is experimental and warns without a backing file; the code
    // under test guards every storage access, so tests run without it.
    execArgv: ['--no-experimental-webstorage'],
  },
});
