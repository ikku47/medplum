// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const fhirBaseUrl = `${process.env['CLINICBUDDY_E2E_FHIR_BASE_URL'] ?? 'http://127.0.0.1:8104'}/fhir/R4`;

interface ActiveLogin {
  accessToken: string;
  profile: { reference: string; display?: string };
}

async function signIn(page: Page): Promise<ActiveLogin> {
  await page.addInitScript(() => localStorage.setItem('clinicbuddy-clinic-setup-completed', 'true'));
  await page.goto('/signin');
  await page.getByPlaceholder('name@domain.com').fill(process.env['CLINICBUDDY_E2E_EMAIL'] ?? 'admin@example.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password *').fill(process.env['CLINICBUDDY_E2E_PASSWORD'] ?? 'medplum_admin');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  return page.evaluate(() => {
    const value = localStorage.getItem('activeLogin');
    if (!value) {
      throw new Error('ClinicBuddy sign-in did not persist an active login.');
    }
    return JSON.parse(value) as ActiveLogin;
  });
}

async function createResource<T>(page: Page, login: ActiveLogin, resourceType: string, resource: object): Promise<T> {
  const response = await page.request.post(`${fhirBaseUrl}/${resourceType}`, {
    headers: { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/fhir+json' },
    data: resource,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

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
  await signIn(page);
  await expect(page.getByRole('heading', { name: /Good day|Clinic overview/i })).toBeVisible();
  await page.goto('/admin/staff');
  await expect(page.getByRole('heading', { name: 'Staff & access' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invite staff' })).toBeVisible();

  const viewport = page.viewportSize();
  const bodyWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewport?.width ?? bodyWidth);
});

test('reception can move a patient from arrival through vitals, consultation, billing, and completion', async ({
  page,
}, testInfo) => {
  const login = await signIn(page);
  const suffix = `${testInfo.project.name.replace(/\W/g, '')}-${Date.now()}`;
  const patientName = `Queue Journey ${suffix}`;
  const patient = await createResource<{ id: string }>(page, login, 'Patient', {
    resourceType: 'Patient',
    active: true,
    name: [{ given: ['Queue'], family: `Journey ${suffix}` }],
    telecom: [{ system: 'phone', value: `+919${String(Date.now()).slice(-9)}`, use: 'mobile' }],
  });
  const start = new Date(Date.now() + 10 * 60_000);
  const appointment = await createResource<{ id: string }>(page, login, 'Appointment', {
    resourceType: 'Appointment',
    status: 'booked',
    start: start.toISOString(),
    end: new Date(start.getTime() + 30 * 60_000).toISOString(),
    participant: [
      { actor: { reference: `Patient/${patient.id}`, display: patientName }, status: 'accepted' },
      { actor: login.profile, status: 'accepted' },
    ],
  });

  await page.goto('/reception/queue');
  await expect(page.getByRole('heading', { name: 'Clinic flow board' })).toBeVisible();
  const card = page.getByText(patientName).locator('xpath=ancestor::*[contains(@class,"mantine-Card-root")]');
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: 'Arrived' }).click();
  await expect(card.getByText('Arrived', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Checked in' }).click();
  await card.getByRole('button', { name: 'Vitals' }).click();
  await card.getByRole('button', { name: 'Record vitals' }).click();
  await page.getByLabel('Height').fill('170');
  await page.getByLabel('Weight').fill('70');
  await page.getByLabel('Systolic BP').fill('120');
  await page.getByLabel('Diastolic BP').fill('80');
  await page.getByLabel('SpO₂').fill('98');
  await page.getByRole('button', { name: 'Save vitals & move to waiting' }).click();
  await expect(card.getByText('Waiting for doctor', { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'With doctor' }).click();
  await expect(card.getByText('With doctor', { exact: true })).toBeVisible();
  await expect
    .poll(
      async () => {
        const encounterResponse = await page.request.get(
          `${fhirBaseUrl}/Encounter?appointment=Appointment%2F${appointment.id}`,
          { headers: { Authorization: `Bearer ${login.accessToken}` } }
        );
        if (!encounterResponse.ok()) {
          return 0;
        }
        const encounterBundle = (await encounterResponse.json()) as { total?: number; entry?: object[] };
        return encounterBundle.entry?.length ?? encounterBundle.total ?? 0;
      },
      { message: 'clinician handoff should create an Encounter', timeout: 10_000 }
    )
    .toBeGreaterThan(0);

  await card.getByRole('button', { name: 'Billing' }).click();
  await card.getByRole('button', { name: 'Completed' }).click();
  await expect(card.getByText('Completed', { exact: true })).toBeVisible();
});
