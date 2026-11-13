import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'audit-toggle-exercise.spec.js',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 390, height: 844 },
    screenshot: 'on',
    video: 'off',
    trace: 'off',
  },
  projects: [
    { name: 'mobile-dark', use: { viewport: { width: 390, height: 844 } } },
    { name: 'mobile-light', use: { viewport: { width: 390, height: 844 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});