import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:4173',
    // Use a locally installed Chrome when available (set PW_CHROME=0 to use bundled Chromium).
    ...(process.env.PW_CHROME === '0' ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
