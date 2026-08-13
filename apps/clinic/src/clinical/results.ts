// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { DiagnosticReport, Extension } from '@medplum/fhirtypes';

export const CLINICBUDDY_RESULT_WORKFLOW_EXTENSION =
  'https://clinicbuddy.health/fhir/StructureDefinition/result-workflow';

export type ResultReviewStatus = 'new' | 'reviewed';
export type ResultClinicalFlag = 'normal' | 'abnormal' | 'critical';

export interface ResultWorkflow {
  reviewStatus: ResultReviewStatus;
  clinicalFlag: ResultClinicalFlag;
  patientNotified: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  notifiedAt?: string;
}

export function getResultWorkflow(report: DiagnosticReport): ResultWorkflow {
  const root = report.extension?.find((extension) => extension.url === CLINICBUDDY_RESULT_WORKFLOW_EXTENSION);
  return {
    reviewStatus: readCode(root, 'review-status') === 'reviewed' ? 'reviewed' : 'new',
    clinicalFlag: getClinicalFlag(root, report),
    patientNotified: readBoolean(root, 'patient-notified'),
    reviewedAt: readInstant(root, 'reviewed-at'),
    reviewedBy: readReference(root, 'reviewed-by'),
    notifiedAt: readInstant(root, 'notified-at'),
  };
}

export function updateResultWorkflow<T extends DiagnosticReport>(report: T, workflow: ResultWorkflow): T {
  const retained = report.extension?.filter((item) => item.url !== CLINICBUDDY_RESULT_WORKFLOW_EXTENSION) ?? [];
  const nested: Extension[] = [
    { url: 'review-status', valueCode: workflow.reviewStatus },
    { url: 'clinical-flag', valueCode: workflow.clinicalFlag },
    { url: 'patient-notified', valueBoolean: workflow.patientNotified },
  ];
  if (workflow.reviewedAt) {
    nested.push({ url: 'reviewed-at', valueInstant: workflow.reviewedAt });
  }
  if (workflow.reviewedBy) {
    nested.push({ url: 'reviewed-by', valueReference: { reference: workflow.reviewedBy } });
  }
  if (workflow.notifiedAt) {
    nested.push({ url: 'notified-at', valueInstant: workflow.notifiedAt });
  }
  return {
    ...report,
    extension: [...retained, { url: CLINICBUDDY_RESULT_WORKFLOW_EXTENSION, extension: nested }],
  };
}

function getClinicalFlag(root: Extension | undefined, report: DiagnosticReport): ResultClinicalFlag {
  const configured = readCode(root, 'clinical-flag');
  if (configured === 'critical' || configured === 'abnormal' || configured === 'normal') {
    return configured;
  }
  const codes = report.conclusionCode?.flatMap((concept) => concept.coding?.map((coding) => coding.code) ?? []) ?? [];
  if (codes.some((code) => code === 'AA' || code === 'HH' || code === 'LL' || code === 'critical')) {
    return 'critical';
  }
  if (codes.some((code) => code === 'A' || code === 'H' || code === 'L' || code === 'abnormal')) {
    return 'abnormal';
  }
  return 'normal';
}

function readCode(root: Extension | undefined, url: string): string | undefined {
  return root?.extension?.find((extension) => extension.url === url)?.valueCode;
}

function readBoolean(root: Extension | undefined, url: string): boolean {
  return root?.extension?.find((extension) => extension.url === url)?.valueBoolean === true;
}

function readInstant(root: Extension | undefined, url: string): string | undefined {
  return root?.extension?.find((extension) => extension.url === url)?.valueInstant;
}

function readReference(root: Extension | undefined, url: string): string | undefined {
  return root?.extension?.find((extension) => extension.url === url)?.valueReference?.reference;
}
