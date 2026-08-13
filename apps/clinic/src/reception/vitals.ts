// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { MedplumClient, WithId } from '@medplum/core';
import { LOINC, UCUM } from '@medplum/core';
import type { Appointment, Bundle, Observation, Patient, Quantity, Reference } from '@medplum/fhirtypes';
import { transitionAppointment } from './queue';

export const CLINICBUDDY_VITALS_APPOINTMENT_EXTENSION =
  'https://clinicbuddy.health/fhir/StructureDefinition/observation-appointment';

export interface VitalSignsInput {
  heightCm?: number;
  weightKg?: number;
  temperatureC?: number;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  bloodGlucoseMgDl?: number;
}

interface VitalDefinition {
  field: keyof VitalSignsInput;
  code: string;
  display: string;
  unit: string;
}

const vitalDefinitions: VitalDefinition[] = [
  { field: 'heightCm', code: '8302-2', display: 'Body height', unit: 'cm' },
  { field: 'weightKg', code: '29463-7', display: 'Body weight', unit: 'kg' },
  { field: 'temperatureC', code: '8310-5', display: 'Body temperature', unit: 'Cel' },
  { field: 'pulse', code: '8867-4', display: 'Heart rate', unit: '/min' },
  { field: 'respiratoryRate', code: '9279-1', display: 'Respiratory rate', unit: '/min' },
  { field: 'oxygenSaturation', code: '2708-6', display: 'Oxygen saturation', unit: '%' },
  { field: 'bloodGlucoseMgDl', code: '2339-0', display: 'Glucose in blood', unit: 'mg/dL' },
];

export function buildVitalSignObservations(
  patient: Reference<Patient>,
  appointment: WithId<Appointment>,
  input: VitalSignsInput,
  effectiveDateTime: string = new Date().toISOString()
): Observation[] {
  validateVitals(input);
  const observations = vitalDefinitions.flatMap((definition) => {
    const value = input[definition.field];
    return value === undefined
      ? []
      : [
          createObservation(
            patient,
            appointment,
            definition.code,
            definition.display,
            quantity(value, definition.unit),
            effectiveDateTime
          ),
        ];
  });

  if (input.systolic !== undefined || input.diastolic !== undefined) {
    const component = [
      input.systolic === undefined
        ? undefined
        : {
            code: loincCode('8480-6', 'Systolic blood pressure'),
            valueQuantity: quantity(input.systolic, 'mm[Hg]'),
          },
      input.diastolic === undefined
        ? undefined
        : {
            code: loincCode('8462-4', 'Diastolic blood pressure'),
            valueQuantity: quantity(input.diastolic, 'mm[Hg]'),
          },
    ].filter((value): value is NonNullable<typeof value> => Boolean(value));
    observations.push({
      ...createObservationBase(patient, appointment, '85354-9', 'Blood pressure panel', effectiveDateTime),
      component,
    });
  }

  if (input.heightCm && input.weightKg) {
    const heightMetres = input.heightCm / 100;
    const bmi = Math.round((input.weightKg / (heightMetres * heightMetres)) * 10) / 10;
    observations.push(
      createObservation(patient, appointment, '39156-5', 'Body mass index', quantity(bmi, 'kg/m2'), effectiveDateTime)
    );
  }

  if (observations.length === 0) {
    throw new Error('Record at least one vital sign.');
  }
  return observations;
}

export async function saveVitalsAndAdvanceQueue(
  medplum: MedplumClient,
  appointment: WithId<Appointment>,
  patient: Reference<Patient>,
  input: VitalSignsInput
): Promise<WithId<Appointment>> {
  const observations = buildVitalSignObservations(patient, appointment, input);
  const updatedAppointment = transitionAppointment(appointment, 'waiting');
  const transaction: Bundle<Observation | Appointment> = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      ...observations.map((resource) => ({ resource, request: { method: 'POST' as const, url: 'Observation' } })),
      {
        resource: updatedAppointment,
        request: { method: 'PUT', url: `Appointment/${appointment.id}` },
      },
    ],
  };

  const result = await medplum.executeBatch(transaction);
  const savedAppointment = result.entry?.find((entry) => entry.resource?.resourceType === 'Appointment')?.resource;
  if (savedAppointment?.resourceType === 'Appointment' && savedAppointment.id) {
    return savedAppointment as WithId<Appointment>;
  }
  return medplum.readResource('Appointment', appointment.id);
}

function createObservation(
  patient: Reference<Patient>,
  appointment: WithId<Appointment>,
  code: string,
  display: string,
  valueQuantity: Quantity,
  effectiveDateTime: string
): Observation {
  return { ...createObservationBase(patient, appointment, code, display, effectiveDateTime), valueQuantity };
}

function createObservationBase(
  patient: Reference<Patient>,
  appointment: WithId<Appointment>,
  code: string,
  display: string,
  effectiveDateTime: string
): Observation {
  return {
    resourceType: 'Observation',
    status: 'final',
    subject: patient,
    effectiveDateTime,
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ],
    code: loincCode(code, display),
    extension: [
      {
        url: CLINICBUDDY_VITALS_APPOINTMENT_EXTENSION,
        valueReference: { reference: `Appointment/${appointment.id}` },
      },
    ],
  };
}

function loincCode(code: string, display: string): Observation['code'] {
  return { coding: [{ system: LOINC, code, display }], text: display };
}

function quantity(value: number, unit: string): Quantity {
  return { value, system: UCUM, code: unit, unit };
}

function validateVitals(input: VitalSignsInput): void {
  validateRange(input.heightCm, 20, 260, 'Height');
  validateRange(input.weightKg, 0.5, 500, 'Weight');
  validateRange(input.temperatureC, 25, 45, 'Temperature');
  validateRange(input.systolic, 40, 300, 'Systolic blood pressure');
  validateRange(input.diastolic, 20, 200, 'Diastolic blood pressure');
  validateRange(input.pulse, 20, 300, 'Pulse');
  validateRange(input.respiratoryRate, 4, 100, 'Respiratory rate');
  validateRange(input.oxygenSaturation, 50, 100, 'Oxygen saturation');
  validateRange(input.bloodGlucoseMgDl, 10, 1000, 'Blood glucose');
}

function validateRange(value: number | undefined, minimum: number, maximum: number, label: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < minimum || value > maximum)) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
}
