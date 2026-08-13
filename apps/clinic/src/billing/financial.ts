// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type {
  ChargeItemDefinition,
  Extension,
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemPriceComponent,
  Organization,
  Patient,
  PaymentReconciliation,
  Practitioner,
  Reference,
} from '@medplum/fhirtypes';

export const CLINICBUDDY_FINANCIAL_EXTENSION = 'https://clinicbuddy.health/fhir/StructureDefinition/financial';
export const CLINICBUDDY_PAYMENT_IDENTIFIER = 'https://clinicbuddy.health/fhir/identifier/payment';
export const CLINICBUDDY_INVOICE_IDENTIFIER = 'https://clinicbuddy.health/fhir/identifier/invoice';
export const CLINICBUDDY_SERVICE_CODE_SYSTEM = 'https://clinicbuddy.health/fhir/CodeSystem/service';

export type PaymentMethod = 'cash' | 'card' | 'bank-transfer' | 'online';
export type FinancialTransactionType = 'payment' | 'refund';

export interface InvoiceServiceLine {
  code?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceAmounts {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  type: FinancialTransactionType;
  reference?: string;
  note?: string;
}

export function calculateInvoiceAmounts(
  lines: InvoiceServiceLine[],
  discount: number,
  taxRate: number
): InvoiceAmounts {
  const subtotal = roundMoney(
    lines.reduce((total, line) => total + positive(line.quantity, 'Quantity') * nonNegative(line.unitPrice, 'Price'), 0)
  );
  const normalizedDiscount = roundMoney(Math.min(nonNegative(discount, 'Discount'), subtotal));
  const net = roundMoney(subtotal - normalizedDiscount);
  const tax = roundMoney(net * (nonNegative(taxRate, 'Tax rate') / 100));
  return { subtotal, discount: normalizedDiscount, tax, total: roundMoney(net + tax) };
}

export function buildInvoice(args: {
  patient: Reference<Patient>;
  lines: InvoiceServiceLine[];
  discount: number;
  taxRate: number;
  encounter?: string;
  issuer?: Reference<Organization>;
  participant?: Reference<Practitioner>;
  invoiceNumber?: string;
  date?: string;
}): Invoice {
  if (args.lines.length === 0) {
    throw new Error('At least one invoice line is required.');
  }
  const normalizedLines = args.lines.map(normalizeLine);
  const amounts = calculateInvoiceAmounts(normalizedLines, args.discount, args.taxRate);
  const currency = 'INR';
  const lineItems: InvoiceLineItem[] = normalizedLines.map((line, index) => ({
    sequence: index + 1,
    chargeItemCodeableConcept: {
      coding: line.code ? [{ system: CLINICBUDDY_SERVICE_CODE_SYSTEM, code: line.code }] : undefined,
      text: line.description,
    },
    priceComponent: [
      {
        type: 'base',
        factor: line.quantity,
        amount: { value: roundMoney(line.quantity * line.unitPrice), currency },
      },
    ],
  }));
  const totalPriceComponent: InvoiceLineItemPriceComponent[] = [
    { type: 'base', amount: { value: amounts.subtotal, currency } },
  ];
  if (amounts.discount > 0) {
    totalPriceComponent.push({ type: 'discount', amount: { value: amounts.discount, currency } });
  }
  if (amounts.tax > 0) {
    totalPriceComponent.push({ type: 'tax', factor: args.taxRate / 100, amount: { value: amounts.tax, currency } });
  }

  return {
    resourceType: 'Invoice',
    status: 'issued',
    identifier: [
      {
        system: CLINICBUDDY_INVOICE_IDENTIFIER,
        value: args.invoiceNumber ?? `CB-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      },
    ],
    type: { text: 'Self-pay outpatient invoice' },
    subject: args.patient,
    recipient: args.patient,
    date: args.date ?? new Date().toISOString(),
    issuer: args.issuer,
    participant: args.participant ? [{ role: { text: 'Rendering clinician' }, actor: args.participant }] : undefined,
    lineItem: lineItems,
    totalPriceComponent,
    totalNet: { value: roundMoney(amounts.subtotal - amounts.discount), currency },
    totalGross: { value: amounts.total, currency },
    extension: args.encounter
      ? [
          {
            url: CLINICBUDDY_FINANCIAL_EXTENSION,
            extension: [{ url: 'encounter', valueReference: { reference: args.encounter } }],
          },
        ]
      : undefined,
    paymentTerms: 'Payment due on receipt',
  };
}

export function buildPayment(args: {
  invoice: Invoice & { id: string };
  input: PaymentInput;
  collector?: Reference<Practitioner | Organization>;
  transactionId?: string;
  date?: string;
}): PaymentReconciliation {
  if (args.input.amount <= 0 || !Number.isFinite(args.input.amount)) {
    throw new Error('Payment or refund amount must be positive.');
  }
  const transactionId = args.transactionId ?? crypto.randomUUID();
  const date = args.date ?? new Date().toISOString();
  return {
    resourceType: 'PaymentReconciliation',
    status: 'active',
    identifier: [{ system: CLINICBUDDY_PAYMENT_IDENTIFIER, value: transactionId }],
    created: date,
    paymentDate: date.slice(0, 10),
    paymentAmount: { value: roundMoney(args.input.amount), currency: 'INR' },
    requestor: args.collector,
    outcome: 'complete',
    disposition: args.input.type === 'refund' ? 'Patient refund completed' : 'Patient payment received',
    detail: [
      {
        type: {
          coding: [
            {
              system: 'https://clinicbuddy.health/fhir/CodeSystem/financial-transaction',
              code: args.input.type,
              display: args.input.type === 'refund' ? 'Refund' : 'Payment',
            },
          ],
        },
        request: { reference: `Invoice/${args.invoice.id}` },
        amount: { value: roundMoney(args.input.amount), currency: 'INR' },
      },
    ],
    extension: [
      {
        url: CLINICBUDDY_FINANCIAL_EXTENSION,
        extension: [
          { url: 'transaction-type', valueCode: args.input.type },
          { url: 'payment-method', valueCode: args.input.method },
          ...(args.invoice.subject ? [{ url: 'patient', valueReference: args.invoice.subject }] : []),
          ...(args.input.reference ? [{ url: 'external-reference', valueString: args.input.reference }] : []),
        ],
      },
    ],
    processNote: args.input.note ? [{ type: 'display', text: args.input.note.trim() }] : undefined,
  };
}

export function getPaymentType(payment: PaymentReconciliation): FinancialTransactionType {
  return getFinancialExtension(payment, 'transaction-type')?.valueCode === 'refund' ? 'refund' : 'payment';
}

export function getPaymentMethod(payment: PaymentReconciliation): PaymentMethod | undefined {
  const value = getFinancialExtension(payment, 'payment-method')?.valueCode;
  return value === 'cash' || value === 'card' || value === 'bank-transfer' || value === 'online' ? value : undefined;
}

export function getInvoicePayments(
  payments: PaymentReconciliation[],
  invoice: Invoice & { id: string }
): PaymentReconciliation[] {
  const reference = `Invoice/${invoice.id}`;
  return payments.filter((payment) => payment.detail?.some((detail) => detail.request?.reference === reference));
}

export function calculatePaidAmount(payments: PaymentReconciliation[]): number {
  return roundMoney(
    payments.reduce((total, payment) => {
      const amount = payment.paymentAmount.value ?? 0;
      return total + (getPaymentType(payment) === 'refund' ? -amount : amount);
    }, 0)
  );
}

export function calculateOutstanding(invoice: Invoice, payments: PaymentReconciliation[]): number {
  return roundMoney(
    Math.max(0, (invoice.totalGross?.value ?? invoice.totalNet?.value ?? 0) - calculatePaidAmount(payments))
  );
}

export function reconcileInvoiceStatus<T extends Invoice>(invoice: T, payments: PaymentReconciliation[]): T {
  if (invoice.status === 'cancelled' || invoice.status === 'entered-in-error') {
    return invoice;
  }
  return { ...invoice, status: calculateOutstanding(invoice, payments) <= 0.009 ? 'balanced' : 'issued' };
}

export function buildServiceDefinition(input: {
  code: string;
  title: string;
  price: number;
  taxRate: number;
  category?: string;
  url?: string;
}): ChargeItemDefinition {
  const code = input.code.trim();
  const title = input.title.trim();
  if (!code || !title) {
    throw new Error('Service code and title are required.');
  }
  nonNegative(input.price, 'Price');
  nonNegative(input.taxRate, 'Tax rate');
  return {
    resourceType: 'ChargeItemDefinition',
    url: input.url ?? `https://clinicbuddy.health/fhir/ChargeItemDefinition/${encodeURIComponent(code)}`,
    status: 'active',
    title,
    code: { coding: [{ system: CLINICBUDDY_SERVICE_CODE_SYSTEM, code, display: title }], text: title },
    propertyGroup: [
      {
        priceComponent: [
          { type: 'base', amount: { value: roundMoney(input.price), currency: 'INR' } },
          ...(input.taxRate > 0
            ? [{ type: 'tax' as const, factor: input.taxRate / 100, code: { text: `${input.taxRate}% tax` } }]
            : []),
        ],
      },
    ],
    extension: input.category
      ? [{ url: CLINICBUDDY_FINANCIAL_EXTENSION, extension: [{ url: 'category', valueString: input.category }] }]
      : undefined,
  };
}

function normalizeLine(line: InvoiceServiceLine): InvoiceServiceLine {
  const description = line.description.trim();
  if (!description) {
    throw new Error('Every invoice line requires a description.');
  }
  return {
    ...line,
    code: line.code?.trim() || undefined,
    description,
    quantity: positive(line.quantity, 'Quantity'),
    unitPrice: nonNegative(line.unitPrice, 'Price'),
  };
}

function getFinancialExtension(resource: PaymentReconciliation, url: string): Extension | undefined {
  return resource.extension
    ?.find((extension) => extension.url === CLINICBUDDY_FINANCIAL_EXTENSION)
    ?.extension?.find((extension) => extension.url === url);
}

function nonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} cannot be negative.`);
  }
  return value;
}

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive.`);
  }
  return value;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
