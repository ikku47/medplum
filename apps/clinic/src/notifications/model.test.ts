// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test, vi } from 'vitest';
import type { NotificationAdapter } from './model';
import { buildNotificationRequest, dispatchExternalNotification } from './model';

describe('notification model', () => {
  test('builds a tenant-bound FHIR notification request', () => {
    const request = buildNotificationRequest({
      event: 'Payment.Received',
      channel: 'sms',
      patient: { reference: 'Patient/p1' },
      message: 'Payment received.',
      tenantId: 'clinic-1',
    });
    expect(request.resourceType).toBe('CommunicationRequest');
    expect(request.subject?.reference).toBe('Patient/p1');
    expect(request.medium?.[0]?.coding?.[0]?.code).toBe('sms');
    expect(request.extension?.[0]?.extension).toContainEqual({ url: 'tenant', valueString: 'clinic-1' });
  });

  test('does not send through an unconfigured external adapter', async () => {
    const adapter: NotificationAdapter = {
      channel: 'whatsapp',
      isConfigured: vi.fn().mockResolvedValue(false),
      send: vi.fn(),
    };
    const request = {
      ...buildNotificationRequest({
        event: 'Appointment.Reminder',
        channel: 'whatsapp',
        patient: { reference: 'Patient/p1' },
        message: 'Reminder',
        tenantId: 'clinic-1',
      }),
      id: 'request-1',
    };
    await expect(dispatchExternalNotification(request, 'clinic-1', adapter)).rejects.toThrow('not configured');
    expect(adapter.send).not.toHaveBeenCalled();
  });
});
