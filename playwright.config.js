import { defineConfig, devices } from '@playwright/test';

// Playwright E2E — chạy thủ công: npx playwright install && npm run test:e2e
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    // Chạy ở chế độ MOCK (không cần cloud) để E2E ổn định: dùng --mode mock + .env.mock
    command: 'npm run dev -- --mode mock',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
