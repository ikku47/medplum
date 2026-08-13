// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Questionnaire, QuestionnaireResponse, QuestionnaireResponseItemAnswer } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockAnswers = {
  'first-name': { valueString: 'Jamie' },
  'last-name': { valueString: 'Doe' },
  dob: { valueDate: '1990-01-01' },
  phone: { valueString: '98765 43210' },
  email: { valueString: 'Jamie.Doe@example.com' },
  street: { valueString: '1 Main St' },
  city: { valueString: 'Springfield' },
  state: { valueCoding: { code: 'CA' } },
  zip: { valueString: '90210' },
  'languages-spoken': { valueCoding: { code: 'en' } },
  'preferred-language': { valueCoding: { code: 'en' } },
  race: { valueCoding: { code: 'race-code', display: 'Race' } },
  ethnicity: { valueCoding: { code: 'eth-code', display: 'Ethnicity' } },
  'veteran-status': { valueBoolean: true },
  'consent-for-treatment-signature': { valueBoolean: true },
  'consent-for-treatment-date': { valueDate: '2024-01-01' },
  'agreement-to-pay-for-treatment-help': { valueBoolean: true },
  'agreement-to-pay-for-treatment-date': { valueDate: '2024-01-02' },
  'notice-of-privacy-practices-signature': { valueBoolean: true },
  'notice-of-privacy-practices-date': { valueDate: '2024-01-03' },
  'acknowledgement-for-advance-directives-signature': { valueBoolean: true },
  'acknowledgement-for-advance-directives-date': { valueDate: '2024-01-04' },
  'preferred-pharmacy-reference': { valueReference: { reference: 'Organization/pharmacy-1' } },
} satisfies Record<string, QuestionnaireResponseItemAnswer>;

const mockIntakeUtils = vi.hoisted(() => ({
  addAllergy: vi.fn(),
  addCondition: vi.fn(),
  addConsent: vi.fn(),
  addCoverage: vi.fn(),
  addExtension: vi.fn(),
  addFamilyMemberHistory: vi.fn(),
  addImmunization: vi.fn(),
  addLanguage: vi.fn(),
  addMedication: vi.fn(),
  addPharmacy: vi.fn(),
  consentCategoryMapping: {
    med: { coding: [] },
    pay: { coding: [] },
    nopp: { coding: [] },
    acd: { coding: [] },
  },
  consentPolicyRuleMapping: {
    clinicRegistration: { coding: [] },
    cric: { coding: [] },
    hipaaSelfPay: { coding: [] },
    hipaaNpp: { coding: [] },
    adr: { coding: [] },
  },
  consentScopeMapping: {
    treatment: { coding: [] },
    patientPrivacy: { coding: [] },
    adr: { coding: [] },
  },
  convertDateToDateTime: vi.fn((date?: string) => (date ? `${date}T00:00:00Z` : undefined)),
  extensionURLMapping: {
    race: 'race-url',
    ethnicity: 'ethnicity-url',
    veteran: 'veteran-url',
  },
  getGroupRepeatedAnswers: vi.fn((_, __, groupId) => {
    if (groupId === 'coverage-information') {
      return [
        {
          'insurance-provider': { valueReference: { reference: 'Organization/org-1' } },
          'subscriber-id': { valueString: 'sub-1' },
          'relationship-to-subscriber': { valueCoding: { code: 'self' } },
        },
      ];
    }
    if (groupId === 'allergies') {
      return [{ 'allergy-substance': { valueCoding: { code: 'peanut' } } }];
    }
    return [];
  }),
  getHumanName: vi.fn(() => ({ given: ['Jamie'], family: 'Doe' })),
  getPatientAddress: vi.fn(() => ({ line: ['1 Main St'] })),
  observationCategoryMapping: {
    socialHistory: { coding: [] },
    sdoh: { coding: [] },
  },
  observationCodeMapping: {
    sexualOrientation: { coding: [] },
    housingStatus: { coding: [] },
    educationLevel: { coding: [] },
    smokingStatus: { coding: [] },
    pregnancyStatus: { coding: [] },
    estimatedDeliveryDate: { coding: [] },
  },
  PROFILE_URLS: {
    Patient: 'patient-profile',
    ObservationSexualOrientation: 'obs-profile',
  },
  upsertObservation: vi.fn(),
}));

vi.mock('./intake-utils', () => mockIntakeUtils);

import { onboardPatient } from './intake-form';

describe('onboardPatient', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
    vi.spyOn(medplum, 'getProject').mockReturnValue({ resourceType: 'Project', id: 'clinic-1' });
    vi.clearAllMocks();
  });

  test('creates patient and invokes onboarding helpers', async () => {
    const createSpy = vi.spyOn(medplum, 'createResource').mockImplementation(async (resource: any) => {
      if (resource.resourceType === 'Patient') {
        return { ...resource, id: 'patient-1' };
      }
      return resource;
    });

    const questionnaire = { resourceType: 'Questionnaire' } as Questionnaire;
    const response = buildResponseFromAnswers(mockAnswers);

    const patient = await onboardPatient(medplum, questionnaire, response);

    expect(patient.id).toBe('patient-1');
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Patient',
        active: true,
        telecom: expect.arrayContaining([
          { system: 'phone', use: 'mobile', value: '+919876543210' },
          { system: 'email', use: 'home', value: 'jamie.doe@example.com' },
        ]),
        identifier: expect.arrayContaining([
          expect.objectContaining({ system: 'https://clinicbuddy.health/fhir/identifier/mrn/clinic-1' }),
        ]),
      })
    );
    expect(mockIntakeUtils.addExtension).toHaveBeenCalledWith(
      expect.objectContaining({}),
      'race-url',
      'valueCoding',
      mockAnswers['race'],
      'ombCategory'
    );
    expect(mockIntakeUtils.addLanguage).toHaveBeenCalledTimes(2);
    expect(mockIntakeUtils.addCoverage).toHaveBeenCalledWith(medplum, patient, expect.any(Object));
    expect(mockIntakeUtils.addAllergy).toHaveBeenCalled();
    expect(mockIntakeUtils.addConsent).toHaveBeenCalled();
    expect(mockIntakeUtils.addPharmacy).toHaveBeenCalled();
  });

  test('blocks duplicate patients before creating any resources', async () => {
    const duplicate = {
      resourceType: 'Patient' as const,
      id: 'existing-patient',
      name: [{ given: ['Jamie'], family: 'Doe' }],
      birthDate: '1990-01-01',
      telecom: [{ system: 'phone' as const, value: '+919876543210' }],
    };
    medplum.searchResources = vi.fn().mockResolvedValue([duplicate]);
    const createSpy = vi.spyOn(medplum, 'createResource');

    await expect(
      onboardPatient(medplum, { resourceType: 'Questionnaire' } as Questionnaire, buildResponseFromAnswers(mockAnswers))
    ).rejects.toThrow('matching patient already exists');
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('requires explicit consent before storing an ABHA number', async () => {
    const answers = {
      ...mockAnswers,
      'abha-number': { valueString: '12345678901234' },
    } satisfies Record<string, QuestionnaireResponseItemAnswer>;

    await expect(
      onboardPatient(medplum, { resourceType: 'Questionnaire' } as Questionnaire, buildResponseFromAnswers(answers))
    ).rejects.toThrow('consent is required');
  });

  test('requires registration and treatment consent', async () => {
    const answers = {
      ...mockAnswers,
      'consent-for-treatment-signature': { valueBoolean: false },
    } satisfies Record<string, QuestionnaireResponseItemAnswer>;

    await expect(
      onboardPatient(medplum, { resourceType: 'Questionnaire' } as Questionnaire, buildResponseFromAnswers(answers))
    ).rejects.toThrow('Registration and treatment consent is required');
  });
});

function buildResponseFromAnswers(answers: Record<string, QuestionnaireResponseItemAnswer>): QuestionnaireResponse {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    item: Object.entries(answers).map(([linkId, answer]) => ({
      linkId,
      answer: [answer],
    })),
  };
}
