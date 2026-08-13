// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Invoice } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import {
  buildInvoice,
  buildPayment,
  buildServiceDefinition,
  calculateInvoiceAmounts,
  calculateOutstanding,
  calculatePaidAmount,
  getPaymentMethod,
  reconcileInvoiceStatus,
} from './financial';

const invoice = buildInvoice({
  patient: { reference: 'Patient/patient-1' },
  lines: [
    { code: 'CONSULT', description: 'Consultation', quantity: 1, unitPrice: 1000 },
    { code: 'PROC', description: 'Procedure', quantity: 2, unitPrice: 250 },
  ],
  discount: 100,
  taxRate: 5,
  invoiceNumber: 'CB-1001',
  date: '2026-08-12T10:00:00.000Z',
});

describe('ClinicBuddy financial model', () => {
  test('calculates transparent INR invoice totals', () => {
    expect(calculateInvoiceAmounts([{ description: 'Consultation', quantity: 1, unitPrice: 1000 }], 100, 5)).toEqual({
      subtotal: 1000,
      discount: 100,
      tax: 45,
      total: 945,
    });
    expect(invoice.totalGross).toEqual({ value: 1470, currency: 'INR' });
    expect(invoice.totalPriceComponent?.map((component) => component.type)).toEqual(['base', 'discount', 'tax']);
  });

  test('supports split payments, refunds and outstanding reconciliation', () => {
    const withId = { ...invoice, id: 'invoice-1' };
    const cash = buildPayment({
      invoice: withId,
      input: { amount: 500, method: 'cash', type: 'payment' },
      transactionId: 'pay-1',
      date: '2026-08-12T10:00:00.000Z',
    });
    const card = buildPayment({
      invoice: withId,
      input: { amount: 970, method: 'card', type: 'payment' },
      transactionId: 'pay-2',
      date: '2026-08-12T10:05:00.000Z',
    });
    const refund = buildPayment({
      invoice: withId,
      input: { amount: 100, method: 'card', type: 'refund' },
      transactionId: 'refund-1',
      date: '2026-08-12T10:10:00.000Z',
    });

    expect(getPaymentMethod(cash)).toBe('cash');
    expect(calculatePaidAmount([cash, card])).toBe(1470);
    expect(reconcileInvoiceStatus(withId, [cash, card]).status).toBe('balanced');
    expect(calculateOutstanding(withId, [cash, card, refund])).toBe(100);
    expect(reconcileInvoiceStatus(withId, [cash, card, refund]).status).toBe('issued');
  });

  test('builds an INR service catalog definition', () => {
    const service = buildServiceDefinition({ code: 'CONSULT', title: 'General consultation', price: 800, taxRate: 0 });
    expect(service).toMatchObject({
      status: 'active',
      code: { coding: [{ code: 'CONSULT' }] },
      propertyGroup: [{ priceComponent: [{ type: 'base', amount: { value: 800, currency: 'INR' } }] }],
    });
  });

  test('does not rebalance cancelled invoices', () => {
    const cancelled: Invoice = { ...invoice, status: 'cancelled' };
    expect(reconcileInvoiceStatus(cancelled, []).status).toBe('cancelled');
  });
});
