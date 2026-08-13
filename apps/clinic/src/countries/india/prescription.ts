// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Encounter, MedicationRequest, Patient, Practitioner, Reference } from '@medplum/fhirtypes';

export const INDIA_PRESCRIPTION_EXTENSION = 'https://clinicbuddy.health/fhir/StructureDefinition/india-prescription';

export interface IndiaPrescriptionInput {
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  quantityUnit: string;
  refills: number;
  instructions: string;
}

export function buildIndiaMedicationRequest(args: {
  input: IndiaPrescriptionInput;
  patient: Reference<Patient>;
  requester: Reference<Practitioner>;
  encounter?: Reference<Encounter>;
  authoredOn?: string;
}): MedicationRequest {
  const input = normalizePrescriptionInput(args.input);
  return {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { text: input.medication },
    subject: args.patient,
    encounter: args.encounter,
    authoredOn: args.authoredOn ?? new Date().toISOString(),
    requester: args.requester,
    dosageInstruction: [
      {
        text: `${input.dose} ${input.route} ${input.frequency} for ${input.durationDays} days`,
        route: { text: input.route },
        timing: { code: { text: input.frequency } },
        doseAndRate: [{ doseQuantity: { value: parseDoseValue(input.dose), unit: input.dose } }],
        patientInstruction: input.instructions || undefined,
      },
    ],
    dispenseRequest: {
      numberOfRepeatsAllowed: input.refills,
      quantity: { value: input.quantity, unit: input.quantityUnit },
      expectedSupplyDuration: {
        value: input.durationDays,
        unit: 'days',
        system: 'http://unitsofmeasure.org',
        code: 'd',
      },
    },
    extension: [{ url: INDIA_PRESCRIPTION_EXTENSION, valueCode: 'printable-local-prescription' }],
  };
}

export function getMedicationRequestDisplay(request: MedicationRequest): string {
  return (
    request.medicationCodeableConcept?.text ||
    request.medicationCodeableConcept?.coding?.[0]?.display ||
    request.medicationReference?.display ||
    'Medication'
  );
}

function normalizePrescriptionInput(input: IndiaPrescriptionInput): IndiaPrescriptionInput {
  const normalized = {
    ...input,
    medication: input.medication.trim(),
    dose: input.dose.trim(),
    route: input.route.trim(),
    frequency: input.frequency.trim(),
    quantityUnit: input.quantityUnit.trim(),
    instructions: input.instructions.trim(),
  };
  if (!normalized.medication || !normalized.dose || !normalized.route || !normalized.frequency) {
    throw new Error('Medication, dose, route and frequency are required.');
  }
  if (normalized.durationDays <= 0 || normalized.quantity <= 0 || normalized.refills < 0) {
    throw new Error('Duration and quantity must be positive, and refills cannot be negative.');
  }
  return normalized;
}

function parseDoseValue(dose: string): number | undefined {
  const value = Number.parseFloat(dose);
  return Number.isFinite(value) ? value : undefined;
}
