// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Appointment, Invoice, Patient } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { buildPatientMessage, getInvoiceOutstanding, requirePatientProfile } from './portal';
import { cancelPatientAppointment, preparePatientBooking } from './scheduling';

const patient: Patient & { id: string } = { resourceType: 'Patient', id: 'patient-1' };

describe('patient portal safeguards', () => {
  test('requires the authenticated profile to be a Patient', () => {
    expect(requirePatientProfile(patient)).toBe(patient);
    expect(() => requirePatientProfile({ resourceType: 'Practitioner', id: 'staff-1' })).toThrow(/Patient profile/);
  });

  test('adds only the signed-in patient to a proposed booking', () => {
    const proposed: Appointment = {
      resourceType: 'Appointment',
      status: 'proposed',
      start: '2026-08-20T04:30:00Z',
      end: '2026-08-20T05:00:00Z',
      participant: [{ actor: { reference: 'Practitioner/doctor-1' }, status: 'needs-action' }],
    };
    const booking = preparePatientBooking(proposed, patient);
    expect(booking.participant).toContainEqual({
      actor: { reference: 'Patient/patient-1' },
      status: 'accepted',
      required: 'required',
    });
  });

  test('builds a compartment-linked secure message', () => {
    const message = buildPatientMessage(patient, { reference: 'Practitioner/doctor-1' }, ' Need help ');
    expect(message.sender?.reference).toBe('Patient/patient-1');
    expect(message.subject?.reference).toBe('Patient/patient-1');
    expect(message.payload?.[0]?.contentString).toBe('Need help');
  });

  test('does not count balanced invoices as outstanding', () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      status: 'balanced',
      totalGross: { value: 800, currency: 'INR' },
    };
    expect(getInvoiceOutstanding(invoice)).toBe(0);
  });

  test('only cancels upcoming appointments', () => {
    const booked = {
      resourceType: 'Appointment',
      id: 'appointment-1',
      status: 'booked',
      participant: [],
    } satisfies Appointment & { id: string };
    expect(cancelPatientAppointment(booked).status).toBe('cancelled');
    expect(() => cancelPatientAppointment({ ...booked, status: 'fulfilled' })).toThrow(/upcoming/);
  });
});
