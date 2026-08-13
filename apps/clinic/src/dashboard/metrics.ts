// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Appointment, Invoice } from '@medplum/fhirtypes';
import type { ClinicFlowStage } from '../reception/queue';
import { getAppointmentFlowStage } from '../reception/queue';
import type { ClinicBuddyRole } from '../tenancy/roles';

export type DashboardVariant = 'reception' | 'doctor' | 'administrator';

export interface AppointmentMetrics {
  total: number;
  checkedIn: number;
  waiting: number;
  late: number;
  noShows: number;
  completed: number;
}

export function getDashboardVariant(role: ClinicBuddyRole): DashboardVariant {
  if (role === 'doctor') {
    return 'doctor';
  }
  if (role === 'receptionist' || role === 'nurse') {
    return 'reception';
  }
  return 'administrator';
}

export function calculateAppointmentMetrics(appointments: Appointment[], now: Date = new Date()): AppointmentMetrics {
  const stages = appointments.map((appointment) => ({
    appointment,
    stage: getAppointmentFlowStage(appointment),
  }));

  return {
    total: appointments.length,
    checkedIn: countStages(stages, ['checked-in', 'vitals']),
    waiting: countStages(stages, ['waiting']),
    late: stages.filter(
      ({ appointment, stage }) =>
        stage === 'scheduled' &&
        Boolean(appointment.start) &&
        new Date(appointment.start as string).getTime() < now.getTime()
    ).length,
    noShows: countStages(stages, ['no-show']),
    completed: countStages(stages, ['completed']),
  };
}

export function calculateNoShowRate(metrics: AppointmentMetrics): number {
  return metrics.total === 0 ? 0 : (metrics.noShows / metrics.total) * 100;
}

export function calculateDoctorUtilization(metrics: AppointmentMetrics): number {
  return metrics.total === 0 ? 0 : ((metrics.completed + metrics.waiting) / metrics.total) * 100;
}

export function sumInvoiceTotals(invoices: Invoice[]): number {
  return invoices.reduce((total, invoice) => total + (invoice.totalGross?.value ?? invoice.totalNet?.value ?? 0), 0);
}

function countStages(
  values: { appointment: Appointment; stage: ClinicFlowStage }[],
  stages: ClinicFlowStage[]
): number {
  return values.filter((value) => stages.includes(value.stage)).length;
}
