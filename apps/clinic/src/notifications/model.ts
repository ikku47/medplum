// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { CommunicationRequest, Patient, Practitioner, Reference } from '@medplum/fhirtypes';

export const CLINICBUDDY_NOTIFICATION_EXTENSION = 'https://clinicbuddy.health/fhir/StructureDefinition/notification';

export const clinicBuddyNotificationEvents = [
  'Appointment.Created',
  'Appointment.Reminder',
  'Patient.CheckedIn',
  'Result.Available',
  'Invoice.Created',
  'Payment.Received',
  'Prescription.Created',
] as const;

export type ClinicBuddyNotificationEvent = (typeof clinicBuddyNotificationEvents)[number];
export type NotificationChannel = 'internal' | 'email' | 'sms' | 'push' | 'whatsapp';

export interface NotificationRequestInput {
  event: ClinicBuddyNotificationEvent;
  channel: NotificationChannel;
  patient: Reference<Patient>;
  message: string;
  recipient?: Reference<Patient | Practitioner>;
  requester?: Reference<Practitioner>;
  occurrence?: string;
  tenantId: string;
}

export interface NotificationAdapter {
  readonly channel: Exclude<NotificationChannel, 'internal'>;
  isConfigured(tenantId: string): Promise<boolean>;
  send(request: CommunicationRequest & { id: string }): Promise<{ providerReference: string }>;
}

export function buildNotificationRequest(input: NotificationRequestInput): CommunicationRequest {
  if (!input.tenantId.trim()) {
    throw new Error('A tenant is required for every notification.');
  }
  if (!input.message.trim()) {
    throw new Error('Notification content is required.');
  }
  return {
    resourceType: 'CommunicationRequest',
    status: 'active',
    priority: input.event === 'Result.Available' ? 'urgent' : 'routine',
    medium: [
      { coding: [{ system: 'https://clinicbuddy.health/fhir/CodeSystem/notification-channel', code: input.channel }] },
    ],
    subject: input.patient,
    recipient: [input.recipient ?? input.patient],
    authoredOn: new Date().toISOString(),
    occurrenceDateTime: input.occurrence,
    requester: input.requester,
    payload: [{ contentString: input.message.trim() }],
    extension: [
      {
        url: CLINICBUDDY_NOTIFICATION_EXTENSION,
        extension: [
          { url: 'event', valueCode: input.event },
          { url: 'channel', valueCode: input.channel },
          { url: 'tenant', valueString: input.tenantId },
        ],
      },
    ],
  };
}

export async function dispatchExternalNotification(
  request: CommunicationRequest & { id: string },
  tenantId: string,
  adapter: NotificationAdapter
): Promise<{ providerReference: string }> {
  const configured = await adapter.isConfigured(tenantId);
  if (!configured) {
    throw new Error(`${adapter.channel} notifications are not configured for this clinic.`);
  }
  return adapter.send(request);
}
