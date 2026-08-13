// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const fhirBaseUrl = `${process.env['CLINICBUDDY_E2E_FHIR_BASE_URL'] ?? 'http://127.0.0.1:8104'}/fhir/R4`;
const serverBaseUrl = process.env['CLINICBUDDY_E2E_FHIR_BASE_URL'] ?? 'http://127.0.0.1:8104';
const patientPortalUrl = process.env['CLINICBUDDY_E2E_PATIENT_URL'] ?? 'http://127.0.0.1:3103';

interface ActiveLogin {
  accessToken: string;
  profile: { reference: string; display?: string };
  project: { reference: string; display?: string };
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

async function updateResource<T extends { id: string }>(
  page: Page,
  login: ActiveLogin,
  resourceType: string,
  resource: T
): Promise<T> {
  const response = await page.request.put(`${fhirBaseUrl}/${resourceType}/${resource.id}`, {
    headers: { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/fhir+json' },
    data: resource,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

async function searchResources<T>(
  page: Page,
  login: ActiveLogin,
  resourceType: string,
  query: Record<string, string>
): Promise<T[]> {
  const params = new URLSearchParams(query);
  const response = await page.request.get(`${fhirBaseUrl}/${resourceType}?${params}`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
  });
  if (!response.ok()) {
    return [];
  }
  const bundle = (await response.json()) as { entry?: { resource?: T }[] };
  return bundle.entry?.map((entry) => entry.resource).filter((resource): resource is T => resource !== undefined) ?? [];
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

test('patient portal enforces patient scope and presents the longitudinal record', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const admin = await signIn(page);
  const projectId = admin.project.reference.split('/')[1];
  expect(projectId).toBeTruthy();

  await page.goto('/admin/organization');
  await page.getByLabel('Organization name').fill('ClinicBuddy E2E Clinic');
  await page.getByLabel('Primary facility name').fill('ClinicBuddy Main Clinic');
  await page.getByRole('button', { name: 'Save clinic setup' }).click();
  await expect(page.getByText(/patient portal access policy are ready/i)).toBeVisible();

  const projectResponse = await page.request.get(`${fhirBaseUrl}/Project/${projectId}`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  expect(projectResponse.ok(), await projectResponse.text()).toBe(true);
  const configuredProject = (await projectResponse.json()) as {
    defaultPatientAccessPolicy?: { reference?: string };
  };
  const patientPolicyReference = configuredProject.defaultPatientAccessPolicy?.reference;
  expect(patientPolicyReference).toMatch(/^AccessPolicy\//);

  const suffix = `${testInfo.project.name.replace(/\W/g, '')}-${Date.now()}`;
  const email = `patient-${suffix}@example.com`.toLowerCase();
  const password = 'ClinicBuddy_patient_123';
  const inviteResponse = await page.request.post(`${serverBaseUrl}/admin/projects/${projectId}/invite`, {
    headers: { Authorization: `Bearer ${admin.accessToken}`, 'Content-Type': 'application/json' },
    data: {
      resourceType: 'Patient',
      firstName: 'Asha',
      lastName: `Portal ${suffix}`,
      email,
      password,
      sendEmail: false,
      scope: 'project',
      membership: { accessPolicy: { reference: patientPolicyReference } },
    },
  });
  expect(inviteResponse.ok(), await inviteResponse.text()).toBe(true);
  const membership = (await inviteResponse.json()) as { profile: { reference: string } };
  const patientRef = membership.profile.reference;
  const patientId = patientRef.split('/')[1];
  expect(patientId).toBeTruthy();

  const otherPatient = await createResource<{ id: string }>(page, admin, 'Patient', {
    resourceType: 'Patient',
    active: true,
    name: [{ given: ['Other'], family: `Patient ${suffix}` }],
  });
  const appointmentStart = new Date(Date.now() + 24 * 60 * 60_000);
  await Promise.all([
    createResource(page, admin, 'Appointment', {
      resourceType: 'Appointment',
      status: 'booked',
      start: appointmentStart.toISOString(),
      end: new Date(appointmentStart.getTime() + 30 * 60_000).toISOString(),
      serviceType: [{ text: 'General practice consultation' }],
      participant: [
        { actor: { reference: patientRef }, status: 'accepted' },
        { actor: admin.profile, status: 'accepted' },
      ],
    }),
    createResource(page, admin, 'MedicationRequest', {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      authoredOn: new Date().toISOString(),
      subject: { reference: patientRef },
      medicationCodeableConcept: { text: 'Paracetamol 500 mg tablet' },
      dosageInstruction: [{ text: 'Take one tablet after food when required.' }],
    }),
    createResource(page, admin, 'DiagnosticReport', {
      resourceType: 'DiagnosticReport',
      status: 'final',
      code: { text: 'Complete blood count' },
      subject: { reference: patientRef },
      issued: new Date().toISOString(),
      conclusion: 'Values are within the expected reference range.',
    }),
    createResource(page, admin, 'DocumentReference', {
      resourceType: 'DocumentReference',
      status: 'current',
      subject: { reference: patientRef },
      date: new Date().toISOString(),
      description: 'Visit summary',
      content: [{ attachment: { contentType: 'application/pdf', url: 'https://example.com/visit-summary.pdf' } }],
    }),
    createResource(page, admin, 'Invoice', {
      resourceType: 'Invoice',
      status: 'issued',
      identifier: [{ value: `CB-E2E-${suffix}` }],
      subject: { reference: patientRef },
      recipient: { reference: patientRef },
      date: new Date().toISOString(),
      totalGross: { value: 500, currency: 'INR' },
    }),
    createResource(page, admin, 'Communication', {
      resourceType: 'Communication',
      status: 'completed',
      sent: new Date().toISOString(),
      sender: admin.profile,
      recipient: [{ reference: patientRef }],
      subject: { reference: patientRef },
      payload: [{ contentString: 'Your appointment is confirmed.' }],
    }),
  ]);

  await page.goto(`${patientPortalUrl}/signin?project=${encodeURIComponent(projectId as string)}`);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByPlaceholder('name@domain.com').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password *').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: /Namaste, Asha/i })).toBeVisible({ timeout: 20_000 });
  const patientLogin = await page.evaluate(
    () => JSON.parse(localStorage.getItem('activeLogin') ?? '{}') as ActiveLogin
  );

  await page.getByRole('link', { name: 'Appointments' }).click();
  await expect(page.getByText('General practice consultation')).toBeVisible();
  await page.getByRole('link', { name: 'Medications' }).click();
  await expect(page.getByText('Paracetamol 500 mg tablet')).toBeVisible();
  await page.getByRole('link', { name: 'Results' }).click();
  await expect(page.getByText('Complete blood count')).toBeVisible();
  await page.getByRole('link', { name: 'Documents' }).click();
  await expect(page.getByText('Visit summary')).toBeVisible();
  await page.getByRole('link', { name: 'Billing' }).click();
  await expect(page.getByText('₹500.00').first()).toBeVisible();
  await page.getByRole('link', { name: 'Messages' }).click();
  await expect(page.getByText('Your appointment is confirmed.')).toBeVisible();

  const crossPatientRead = await page.request.get(`${fhirBaseUrl}/Patient/${otherPatient.id}`, {
    headers: { Authorization: `Bearer ${patientLogin.accessToken}` },
  });
  expect(crossPatientRead.ok()).toBe(false);
  const ownPatient = await page.request.get(`${fhirBaseUrl}/Patient/${patientId}`, {
    headers: { Authorization: `Bearer ${patientLogin.accessToken}` },
  });
  expect(ownPatient.ok(), await ownPatient.text()).toBe(true);
  const ownPatientResource = (await ownPatient.json()) as object;
  const protectedIdentifierWrite = await page.request.put(`${fhirBaseUrl}/Patient/${patientId}`, {
    headers: { Authorization: `Bearer ${patientLogin.accessToken}`, 'Content-Type': 'application/fhir+json' },
    data: {
      ...ownPatientResource,
      identifier: [{ system: 'https://healthid.ndhm.gov.in', value: '11-1111-1111-1111' }],
    },
  });
  expect(protectedIdentifierWrite.ok(), await protectedIdentifierWrite.text()).toBe(true);
  const protectedWriteResult = (await protectedIdentifierWrite.json()) as {
    identifier?: { system?: string; value?: string }[];
  };
  expect(
    protectedWriteResult.identifier?.some(
      (identifier) =>
        identifier.system === 'https://healthid.ndhm.gov.in' && identifier.value === '11-1111-1111-1111'
    ) ?? false
  ).toBe(false);

  const viewport = page.viewportSize();
  const bodyWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewport?.width ?? bodyWidth);
});

test('clinic can complete a self-pay outpatient journey from queue through clinical care and receipt', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
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

  const encounters = await searchResources<{ id: string; resourceType: 'Encounter'; diagnosis?: object[] }>(
    page,
    login,
    'Encounter',
    { appointment: `Appointment/${appointment.id}` }
  );
  const encounter = encounters[0];
  expect(encounter?.id).toBeTruthy();
  const condition = await createResource<{ id: string }>(page, login, 'Condition', {
    resourceType: 'Condition',
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed',
        },
      ],
    },
    category: [{ text: 'Encounter Diagnosis' }],
    code: { text: 'Acute upper respiratory infection' },
    subject: { reference: `Patient/${patient.id}` },
    encounter: { reference: `Encounter/${encounter.id}` },
  });
  await updateResource(page, login, 'Encounter', {
    ...encounter,
    diagnosis: [{ condition: { reference: `Condition/${condition.id}` }, rank: 1 }],
  });

  await page.goto(`/Patient/${patient.id}/Encounter/${encounter.id}`);
  await expect(page.getByRole('heading', { name: 'Clinical documentation' })).toBeVisible();
  await page.getByLabel('Chief complaint').fill('Cough and fever for three days');
  await page.getByLabel('Subjective / history').fill('No shortness of breath. Oral intake maintained.');
  await page.getByLabel('Objective / examination').fill('Afebrile, chest clear, oxygen saturation normal.');
  await page.getByLabel('Assessment').fill('Uncomplicated acute upper respiratory infection.');
  await page.getByLabel('Plan').fill('Supportive care, medication and return precautions.');
  await page.getByLabel('Follow-up').fill('Review in seven days or earlier for red flags.');
  await expect
    .poll(
      async () => {
        const impressions = await searchResources<object>(page, login, 'ClinicalImpression', {
          encounter: `Encounter/${encounter.id}`,
        });
        return JSON.stringify(impressions).includes('Cough and fever for three days');
      },
      { message: 'clinical note should autosave', timeout: 10_000 }
    )
    .toBe(true);

  await page.getByRole('link', { name: 'Prescription' }).click();
  await expect(page.getByRole('heading', { name: 'Create prescription' })).toBeVisible();
  await page.getByLabel('Medication').fill('Paracetamol 500 mg tablet');
  await page.getByLabel('Dose').fill('1 tablet');
  await page.getByLabel('Patient instructions').fill('Take after food as needed for fever.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await searchResources<object>(page, login, 'MedicationRequest', { patient: `Patient/${patient.id}` })).length,
      { message: 'prescription should be stored', timeout: 10_000 }
    )
    .toBeGreaterThan(0);

  await page.goto(`/Patient/${patient.id}/Encounter/${encounter.id}`);
  await expect(page.getByRole('heading', { name: 'Clinical documentation' })).toBeVisible();
  await page.getByRole('link', { name: 'Imaging / referral' }).click();
  await expect(page.getByRole('heading', { name: 'Request investigation or service' })).toBeVisible();
  await page.getByLabel('Requested service').fill('Chest X-ray PA view');
  await page.getByLabel('Clinical reason').fill('Persistent cough and fever');
  await page.getByRole('button', { name: 'Create order' }).click();
  await expect
    .poll(
      async () =>
        (await searchResources<object>(page, login, 'ServiceRequest', { patient: `Patient/${patient.id}` })).length,
      { message: 'clinical order should be stored', timeout: 10_000 }
    )
    .toBeGreaterThan(0);

  await page.goto(`/Patient/${patient.id}/Encounter/${encounter.id}`);
  await expect(page.getByRole('heading', { name: 'Clinical documentation' })).toBeVisible();
  await page.getByRole('button', { name: 'Follow-up appointment' }).click();
  await expect(page.getByRole('dialog', { name: 'Schedule follow-up' })).toBeVisible();
  await page.getByRole('button', { name: 'Schedule follow-up' }).click();
  await expect
    .poll(
      async () => {
        const followUps = await searchResources<{ supportingInformation?: { reference?: string }[] }>(
          page,
          login,
          'Appointment',
          { patient: `Patient/${patient.id}` }
        );
        return followUps.some((item) =>
          item.supportingInformation?.some((reference) => reference.reference === `Encounter/${encounter.id}`)
        );
      },
      { message: 'follow-up should be linked to the encounter', timeout: 10_000 }
    )
    .toBe(true);

  await page.goto('/billing');
  await expect(page.getByRole('heading', { name: 'Billing desk' })).toBeVisible();
  await page.getByRole('button', { name: 'New invoice' }).click();
  const patientInput = page.getByLabel('Patient');
  await patientInput.fill(patientName);
  await page.getByRole('option', { name: patientName }).click();
  await page.getByLabel('Unit price (INR)').fill('800');
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  const invoiceCard = page.getByText(patientName).locator('xpath=ancestor::*[contains(@class,"mantine-Card-root")]');
  await expect(invoiceCard).toBeVisible();
  await invoiceCard.getByRole('button', { name: 'Record payment' }).click();
  await page.getByLabel('Transaction reference').fill(`E2E-${suffix}`);
  await page.getByRole('dialog', { name: 'Record payment' }).getByRole('button', { name: 'Record payment' }).click();
  await page.locator('label[for$="-paid"]').click();
  const paidInvoiceCard = page
    .getByText(patientName)
    .locator('xpath=ancestor::*[contains(@class,"mantine-Card-root")]');
  await paidInvoiceCard.getByRole('link', { name: 'Receipt' }).click();
  await expect(page.getByText('Payment receipt')).toBeVisible();
  await expect(page.getByRole('heading').filter({ hasText: '₹800.00' })).toBeVisible();

  await page.goto('/reception/queue');
  const completionCard = page.getByText(patientName).locator('xpath=ancestor::*[contains(@class,"mantine-Card-root")]');
  await expect(completionCard).toBeVisible();
  await completionCard.getByRole('button', { name: 'Billing' }).click();
  await completionCard.getByRole('button', { name: 'Completed' }).click();
  await expect(completionCard.getByText('Completed', { exact: true })).toBeVisible();
});
