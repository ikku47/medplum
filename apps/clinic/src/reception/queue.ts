// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Appointment, Extension } from '@medplum/fhirtypes';

export const CLINICBUDDY_FLOW_EXTENSION = 'https://clinicbuddy.health/fhir/StructureDefinition/appointment-flow';

export const clinicFlowStages = [
  'scheduled',
  'arrived',
  'checked-in',
  'vitals',
  'waiting',
  'consultation',
  'billing',
  'completed',
  'cancelled',
  'no-show',
  'left-without-consultation',
] as const;

export type ClinicFlowStage = (typeof clinicFlowStages)[number];

export const clinicFlowLabels: Record<ClinicFlowStage, string> = {
  scheduled: 'Scheduled',
  arrived: 'Arrived',
  'checked-in': 'Checked in',
  vitals: 'Vitals',
  waiting: 'Waiting for doctor',
  consultation: 'With doctor',
  billing: 'Billing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
  'left-without-consultation': 'Left without consultation',
};

const nextStage: Partial<Record<ClinicFlowStage, ClinicFlowStage>> = {
  scheduled: 'arrived',
  arrived: 'checked-in',
  'checked-in': 'vitals',
  vitals: 'waiting',
  waiting: 'consultation',
  consultation: 'billing',
  billing: 'completed',
};

export function getAppointmentFlowStage(appointment: Appointment): ClinicFlowStage {
  if (appointment.status === 'fulfilled') {
    return 'completed';
  }
  if (appointment.status === 'noshow') {
    return 'no-show';
  }
  if (appointment.status === 'cancelled') {
    return appointment.cancelationReason?.coding?.some(
      (coding) =>
        coding.system === 'https://clinicbuddy.health/fhir/CodeSystem/appointment-cancellation' &&
        coding.code === 'left'
    )
      ? 'left-without-consultation'
      : 'cancelled';
  }

  const configuredStage = appointment.extension
    ?.find((extension) => extension.url === CLINICBUDDY_FLOW_EXTENSION)
    ?.extension?.find((extension) => extension.url === 'stage')?.valueCode;
  if (configuredStage && clinicFlowStages.includes(configuredStage as ClinicFlowStage)) {
    return configuredStage as ClinicFlowStage;
  }

  if (appointment.status === 'arrived') {
    return 'arrived';
  }
  if (appointment.status === 'checked-in') {
    return 'checked-in';
  }
  return 'scheduled';
}

export function getNextClinicFlowStage(stage: ClinicFlowStage): ClinicFlowStage | undefined {
  return nextStage[stage];
}

export function getStageEnteredAt(appointment: Appointment): string | undefined {
  return appointment.extension
    ?.find((extension) => extension.url === CLINICBUDDY_FLOW_EXTENSION)
    ?.extension?.find((extension) => extension.url === 'entered-at')?.valueInstant;
}

export interface ClinicFlowTransition {
  stage: ClinicFlowStage;
  enteredAt: string;
}

export function getClinicFlowHistory(appointment: Appointment): ClinicFlowTransition[] {
  const flow = appointment.extension?.find((extension) => extension.url === CLINICBUDDY_FLOW_EXTENSION);
  return (
    flow?.extension
      ?.filter((extension) => extension.url === 'transition')
      .map((transition) => {
        const stage = transition.extension?.find((item) => item.url === 'stage')?.valueCode;
        const enteredAt = transition.extension?.find((item) => item.url === 'entered-at')?.valueInstant;
        return stage && clinicFlowStages.includes(stage as ClinicFlowStage) && enteredAt
          ? { stage: stage as ClinicFlowStage, enteredAt }
          : undefined;
      })
      .filter((transition): transition is ClinicFlowTransition => Boolean(transition)) ?? []
  );
}

export function transitionAppointment(
  appointment: Appointment,
  target: ClinicFlowStage,
  enteredAt: string = new Date().toISOString()
): Appointment {
  const current = getAppointmentFlowStage(appointment);
  const allowedTargets = getAllowedTargets(current);
  if (!allowedTargets.includes(target)) {
    throw new Error(`Cannot move an appointment from ${clinicFlowLabels[current]} to ${clinicFlowLabels[target]}.`);
  }

  const previousFlow = appointment.extension?.find((item) => item.url === CLINICBUDDY_FLOW_EXTENSION);
  const extension = appointment.extension?.filter((item) => item.url !== CLINICBUDDY_FLOW_EXTENSION) ?? [];
  const history = getClinicFlowHistory(appointment);
  const previousEnteredAt = previousFlow?.extension?.find((item) => item.url === 'entered-at')?.valueInstant;
  if (history.length === 0 && previousEnteredAt) {
    history.push({ stage: current, enteredAt: previousEnteredAt });
  }
  const updated: Appointment = {
    ...appointment,
    extension: [...extension, buildFlowExtension(target, enteredAt, [...history, { stage: target, enteredAt }])],
    status: statusForStage(target),
  };

  if (target === 'left-without-consultation') {
    updated.cancelationReason = {
      coding: [
        {
          system: 'https://clinicbuddy.health/fhir/CodeSystem/appointment-cancellation',
          code: 'left',
          display: 'Left without consultation',
        },
      ],
      text: 'Left without consultation',
    };
  } else if (target !== 'cancelled') {
    updated.cancelationReason = undefined;
  }

  return updated;
}

export function getAllowedTargets(stage: ClinicFlowStage): ClinicFlowStage[] {
  const targets = nextStage[stage] ? [nextStage[stage]] : [];
  if (stage === 'scheduled' || stage === 'arrived') {
    targets.push('no-show');
  }
  if (!isTerminalStage(stage)) {
    targets.push('cancelled');
  }
  if (['checked-in', 'vitals', 'waiting', 'consultation', 'billing'].includes(stage)) {
    targets.push('left-without-consultation');
  }
  return targets;
}

export function isTerminalStage(stage: ClinicFlowStage): boolean {
  return ['completed', 'cancelled', 'no-show', 'left-without-consultation'].includes(stage);
}

function statusForStage(stage: ClinicFlowStage): Appointment['status'] {
  switch (stage) {
    case 'scheduled':
      return 'booked';
    case 'arrived':
      return 'arrived';
    case 'completed':
      return 'fulfilled';
    case 'cancelled':
    case 'left-without-consultation':
      return 'cancelled';
    case 'no-show':
      return 'noshow';
    default:
      return 'checked-in';
  }
}

function buildFlowExtension(stage: ClinicFlowStage, enteredAt: string, history: ClinicFlowTransition[]): Extension {
  return {
    url: CLINICBUDDY_FLOW_EXTENSION,
    extension: [
      { url: 'stage', valueCode: stage },
      { url: 'entered-at', valueInstant: enteredAt },
      ...history.map((transition) => ({
        url: 'transition',
        extension: [
          { url: 'stage', valueCode: transition.stage },
          { url: 'entered-at', valueInstant: transition.enteredAt },
        ],
      })),
    ],
  };
}
