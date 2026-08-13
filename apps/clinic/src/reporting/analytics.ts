// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Appointment, Condition, MedicationRequest, Procedure, ServiceRequest } from '@medplum/fhirtypes';
import { getClinicFlowHistory } from '../reception/queue';

export interface CountRow {
  label: string;
  count: number;
}

export interface OperationalReport {
  patientVolume: number;
  completed: number;
  cancelled: number;
  noShow: number;
  noShowRate: number;
  averageWaitMinutes?: number;
  providers: CountRow[];
}

export interface ClinicalReport {
  diagnoses: CountRow[];
  procedures: CountRow[];
  medications: CountRow[];
  labOrders: number;
  imagingOrders: number;
  referrals: number;
}

export function buildOperationalReport(appointments: Appointment[]): OperationalReport {
  const completed = appointments.filter((appointment) => appointment.status === 'fulfilled').length;
  const cancelled = appointments.filter((appointment) => appointment.status === 'cancelled').length;
  const noShow = appointments.filter((appointment) => appointment.status === 'noshow').length;
  const terminal = completed + cancelled + noShow;
  const waits = appointments
    .map((appointment) => {
      const history = getClinicFlowHistory(appointment);
      const checkedIn = history.find((transition) => transition.stage === 'checked-in')?.enteredAt;
      const consultation = history.find((transition) => transition.stage === 'consultation')?.enteredAt;
      if (!checkedIn || !consultation) {
        return undefined;
      }
      const minutes = (new Date(consultation).getTime() - new Date(checkedIn).getTime()) / 60_000;
      return minutes >= 0 && Number.isFinite(minutes) ? minutes : undefined;
    })
    .filter((minutes): minutes is number => minutes !== undefined);

  return {
    patientVolume: new Set(
      appointments.flatMap(
        (appointment) =>
          appointment.participant
            ?.map((participant) => participant.actor?.reference)
            .filter((reference): reference is string => reference?.startsWith('Patient/') ?? false) ?? []
      )
    ).size,
    completed,
    cancelled,
    noShow,
    noShowRate: terminal > 0 ? (noShow / terminal) * 100 : 0,
    averageWaitMinutes: waits.length > 0 ? waits.reduce((sum, value) => sum + value, 0) / waits.length : undefined,
    providers: countLabels(
      appointments.flatMap(
        (appointment) =>
          appointment.participant
            ?.filter((participant) => participant.actor?.reference?.startsWith('Practitioner/'))
            .map((participant) => participant.actor?.display ?? participant.actor?.reference ?? 'Unassigned') ?? []
      )
    ),
  };
}

export function buildClinicalReport(input: {
  conditions: Condition[];
  procedures: Procedure[];
  medications: MedicationRequest[];
  orders: ServiceRequest[];
}): ClinicalReport {
  return {
    diagnoses: countLabels(input.conditions.map((condition) => conceptLabel(condition.code, 'Unspecified diagnosis'))),
    procedures: countLabels(input.procedures.map((procedure) => conceptLabel(procedure.code, 'Unspecified procedure'))),
    medications: countLabels(
      input.medications.map((request) =>
        request.medicationCodeableConcept
          ? conceptLabel(request.medicationCodeableConcept, 'Unspecified medication')
          : (request.medicationReference?.display ?? request.medicationReference?.reference ?? 'Unspecified medication')
      )
    ),
    labOrders: input.orders.filter((order) => hasCategory(order, 'laboratory')).length,
    imagingOrders: input.orders.filter((order) => hasCategory(order, 'imaging')).length,
    referrals: input.orders.filter((order) => hasCategory(order, 'referral')).length,
  };
}

function hasCategory(order: ServiceRequest, value: string): boolean {
  return (
    order.category?.some((category) =>
      [...(category.coding ?? []), { display: category.text }].some((coding) =>
        `${coding.code ?? ''} ${coding.display ?? ''}`.toLowerCase().includes(value)
      )
    ) ?? false
  );
}

function conceptLabel(
  concept: { text?: string; coding?: { display?: string; code?: string }[] } | undefined,
  fallback: string
): string {
  return concept?.text ?? concept?.coding?.[0]?.display ?? concept?.coding?.[0]?.code ?? fallback;
}

function countLabels(labels: string[]): CountRow[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}
