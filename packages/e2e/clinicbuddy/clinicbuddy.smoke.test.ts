// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { expect, test } from '@playwright/test';

test('sign-in surface is branded, usable, and does not overflow', async ({ page }) => {
  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Sign in to ClinicBuddy' })).toBeVisible();
  await expect(page.getByAltText('ClinicBuddy Logo')).toBeVisible();
  await expect(page.getByPlaceholder('name@domain.com')).toBeEditable();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

  const viewport = page.viewportSize();
  const bodyWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
  expect(viewport).not.toBeNull();
  expect(bodyWidth).toBeLessThanOrEqual(viewport?.width ?? bodyWidth);
});

test('clinic administrator can sign in and open protected administration', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('clinicbuddy-clinic-setup-completed', 'true'));
  await page.goto('/signin');
  await page.getByPlaceholder('name@domain.com').fill(process.env['CLINICBUDDY_E2E_EMAIL'] ?? 'admin@example.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password *').fill(process.env['CLINICBUDDY_E2E_PASSWORD'] ?? 'medplum_admin');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Good day|Clinic overview/i })).toBeVisible();
  await page.goto('/admin/staff');
  await expect(page.getByRole('heading', { name: 'Staff & access' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invite staff' })).toBeVisible();

  const viewport = page.viewportSize();
  const bodyWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewport?.width ?? bodyWidth);
});
