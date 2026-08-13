// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import react from '@vitejs/plugin-react';
import dns from 'dns';
import { copyFileSync, existsSync } from 'fs';
import path from 'path';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vitest/config';

dns.setDefaultResultOrder('verbatim');

if (!existsSync(path.join(__dirname, '.env'))) {
  copyFileSync(path.join(__dirname, '.env.defaults'), path.join(__dirname, '.env'));
}

const alias: NonNullable<UserConfig['resolve']>['alias'] = Object.fromEntries(
  Object.entries({
    '@medplum/core': path.resolve(__dirname, '../../packages/core/src'),
    '@medplum/react': path.resolve(__dirname, '../../packages/react/src'),
    '@medplum/react-hooks': path.resolve(__dirname, '../../packages/react-hooks/src'),
  }).filter(([, sourcePath]) => existsSync(sourcePath))
);

export default defineConfig({
  envPrefix: ['CLINICBUDDY_', 'MEDPLUM_', 'GOOGLE_', 'RECAPTCHA_'],
  plugins: [react()],
  server: { host: 'localhost', port: 3002 },
  preview: { host: 'localhost', port: 3002 },
  resolve: { alias },
  test: { globals: true, environment: 'jsdom', setupFiles: './src/test.setup.ts' },
});
