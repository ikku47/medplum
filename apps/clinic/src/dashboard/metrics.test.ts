// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Appointment, Invoice } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { transitionAppointment } from '../reception/queue';
import {
  calculateAppointmentMetrics,
  calculateDoctorUtilization,
  calculateNoShowRate,
  getDashboardVariant,
  sumInvoiceTotals,
} from './metrics';

const baseAppointment: Appointment = {
  resourceType: 'Appointment',
  status: 'booked',
  start: '2026-08-12T08:00:00.000Z',
  participant: [],
};

describe('dashboard metrics', () => {
  test('selects a dashboard from the ClinicBuddy role', () => {
    expect(getDashboardVariant('receptionist')).toBe('reception');
    expect(getDashboardVariant('nurse')).toBe('reception');
    expect(getDashboardVariant('doctor')).toBe('doctor');
    expect(getDashboardVariant('clinic-admin')).toBe('administrator');
  });

  test('summarizes the live appointment flow', () => {
    const waiting = transitionAppointment(
      transitionAppointment(
        transitionAppointment(transitionAppointment(baseAppointment, 'arrived'), 'checked-in'),
        'vitals'
      ),
      'waiting'
    );
    const noShow = transitionAppointment(baseAppointment, 'no-show');
    const metrics = calculateAppointmentMetrics(
      [baseAppointment, waiting, noShow],
      new Date('2026-08-12T09:00:00.000Z')
    );

    expect(metrics).toMatchObject({ total: 3, waiting: 1, late: 1, noShows: 1 });
    expect(calculateNoShowRate(metrics)).toBeCloseTo(33.33, 1);
    expect(calculateDoctorUtilization(metrics)).toBeCloseTo(33.33, 1);
  });

  test('totals invoice gross values without assuming every invoice has a total', () => {
    const invoices: Invoice[] = [
      { resourceType: 'Invoice', status: 'issued', totalGross: { value: 1250, currency: 'INR' } },
      { resourceType: 'Invoice', status: 'balanced', totalNet: { value: 750, currency: 'INR' } },
      { resourceType: 'Invoice', status: 'draft' },
    ];
    expect(sumInvoiceTotals(invoices)).toBe(2000);
  });
});
