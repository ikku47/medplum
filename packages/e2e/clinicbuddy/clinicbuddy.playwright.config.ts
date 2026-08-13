// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'clinicbuddy.smoke.test.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 1,
  workers: 1,
  use: {
    baseURL: process.env['CLINICBUDDY_E2E_BASE_URL'] ?? 'http://127.0.0.1:3102',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'tablet-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
  ],
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/clinicbuddy', open: 'never' }]],
  webServer: [
    {
      command:
        'npm run dev --workspace=@medplum/server -- file:medplum.config.json,file:medplum-e2e-partial.config.json',
      url: 'http://127.0.0.1:8104/healthcheck',
      timeout: 120_000,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command:
        'MEDPLUM_BASE_URL=http://127.0.0.1:8104/ npm run dev --workspace=@clinicbuddy/clinic -- --host 127.0.0.1 --port 3102',
      url: 'http://127.0.0.1:3102/signin',
      timeout: 120_000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
