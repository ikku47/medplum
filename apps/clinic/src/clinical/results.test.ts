// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { DiagnosticReport } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { getResultWorkflow, updateResultWorkflow } from './results';

const report: DiagnosticReport = {
  resourceType: 'DiagnosticReport',
  id: 'report-1',
  status: 'final',
  code: { text: 'Complete blood count' },
  subject: { reference: 'Patient/patient-1' },
  conclusionCode: [
    { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H' }] },
  ],
};

describe('result workflow', () => {
  test('defaults a new report and derives an abnormal clinical flag', () => {
    expect(getResultWorkflow(report)).toMatchObject({
      reviewStatus: 'new',
      clinicalFlag: 'abnormal',
      patientNotified: false,
    });
  });

  test('round trips review and patient notification state', () => {
    const updated = updateResultWorkflow(report, {
      reviewStatus: 'reviewed',
      clinicalFlag: 'critical',
      patientNotified: true,
      reviewedAt: '2026-08-12T10:00:00.000Z',
      reviewedBy: 'Practitioner/practitioner-1',
      notifiedAt: '2026-08-12T10:05:00.000Z',
    });
    expect(getResultWorkflow(updated)).toEqual({
      reviewStatus: 'reviewed',
      clinicalFlag: 'critical',
      patientNotified: true,
      reviewedAt: '2026-08-12T10:00:00.000Z',
      reviewedBy: 'Practitioner/practitioner-1',
      notifiedAt: '2026-08-12T10:05:00.000Z',
    });
  });
});
