// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { ProfileResource } from '@medplum/core';
import { createReference, getDisplayString } from '@medplum/core';
import type {
  Appointment,
  Communication,
  DiagnosticReport,
  Invoice,
  MedicationRequest,
  Patient,
  Reference,
} from '@medplum/fhirtypes';

export function requirePatientProfile(profile: ProfileResource | undefined): Patient & { id: string } {
  if (profile?.resourceType !== 'Patient' || !profile.id) {
    throw new Error('A signed-in Patient profile is required.');
  }
  return profile as Patient & { id: string };
}

export function formatPortalDate(value: string | undefined, includeTime = false): string {
  if (!value) {
    return 'Not recorded';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
    timeZone: 'Asia/Kolkata',
  }).format(parsed);
}

export function formatInr(value: number | undefined): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function getAppointmentTitle(appointment: Appointment): string {
  return (
    appointment.serviceType?.[0]?.text ??
    appointment.serviceType?.[0]?.coding?.[0]?.display ??
    appointment.appointmentType?.text ??
    appointment.reasonCode?.[0]?.text ??
    'Clinic appointment'
  );
}

export function getMedicationName(request: MedicationRequest): string {
  return (
    request.medicationCodeableConcept?.text ??
    request.medicationCodeableConcept?.coding?.[0]?.display ??
    request.medicationReference?.display ??
    'Medication'
  );
}

export function getResultTitle(report: DiagnosticReport): string {
  return report.code.text ?? report.code.coding?.[0]?.display ?? 'Clinical result';
}

export function getInvoiceNumber(invoice: Invoice): string {
  return invoice.identifier?.[0]?.value ?? (invoice.id ? `Invoice ${invoice.id.slice(0, 8)}` : 'Invoice');
}

export function getInvoiceOutstanding(invoice: Invoice): number {
  return invoice.status === 'balanced' || invoice.status === 'cancelled' || invoice.status === 'entered-in-error'
    ? 0
    : (invoice.totalGross?.value ?? invoice.totalNet?.value ?? 0);
}

export function getMessageText(message: Communication): string {
  return (
    message.payload?.find((payload) => payload.contentString)?.contentString ??
    message.note?.[0]?.text ??
    'Secure message'
  );
}

export function buildPatientMessage(
  patient: Patient & { id: string },
  recipient: NonNullable<Communication['recipient']>[number],
  body: string,
  sentAt = new Date().toISOString()
): Communication {
  const text = body.trim();
  if (!text) {
    throw new Error('Message cannot be empty.');
  }
  return {
    resourceType: 'Communication',
    status: 'completed',
    sent: sentAt,
    sender: createReference(patient),
    recipient: [recipient],
    subject: createReference(patient),
    payload: [{ contentString: text }],
  };
}

export function getReferenceLabel(reference: Reference | undefined): string {
  return reference?.display ?? reference?.reference ?? 'Clinic team';
}

export function getPatientName(patient: Patient): string {
  return getDisplayString(patient);
}
