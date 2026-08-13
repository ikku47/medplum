// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Patient, Practitioner, Reference, ServiceRequest } from '@medplum/fhirtypes';

export const CLINICBUDDY_ORDER_CATEGORY_SYSTEM = 'https://clinicbuddy.health/fhir/CodeSystem/order-category';

export const clinicalOrderTypes = ['imaging', 'procedure', 'referral', 'other'] as const;
export type ClinicalOrderType = (typeof clinicalOrderTypes)[number];

export interface ClinicalOrderInput {
  type: ClinicalOrderType;
  requestedService: string;
  priority: NonNullable<ServiceRequest['priority']>;
  reason?: string;
  instructions?: string;
  requestedDate?: string;
}

const orderLabels: Record<ClinicalOrderType, string> = {
  imaging: 'Imaging',
  procedure: 'Procedure',
  referral: 'Referral',
  other: 'Other diagnostic request',
};

export function buildClinicalOrder(args: {
  input: ClinicalOrderInput;
  patient: Reference<Patient>;
  requester: Reference<Practitioner>;
  encounter?: string;
  authoredOn?: string;
}): ServiceRequest {
  const service = args.input.requestedService.trim();
  if (!service) {
    throw new Error('Requested service is required.');
  }

  return {
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    priority: args.input.priority,
    category: [
      {
        coding: [
          {
            system: CLINICBUDDY_ORDER_CATEGORY_SYSTEM,
            code: args.input.type,
            display: orderLabels[args.input.type],
          },
        ],
        text: orderLabels[args.input.type],
      },
    ],
    code: { text: service },
    subject: args.patient,
    encounter: args.encounter ? { reference: args.encounter } : undefined,
    authoredOn: args.authoredOn ?? new Date().toISOString(),
    requester: args.requester,
    occurrenceDateTime: args.input.requestedDate || undefined,
    reasonCode: args.input.reason?.trim() ? [{ text: args.input.reason.trim() }] : undefined,
    note: args.input.instructions?.trim() ? [{ text: args.input.instructions.trim() }] : undefined,
  };
}
