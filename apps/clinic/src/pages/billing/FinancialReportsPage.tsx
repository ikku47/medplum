// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Card, Container, Group, Loader, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { Invoice, PaymentReconciliation } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  calculateOutstanding,
  calculatePaidAmount,
  getInvoicePayments,
  getPaymentMethod,
  getPaymentType,
} from '../../billing/financial';
import { showErrorNotification } from '../../utils/notifications';

export function FinancialReportsPage(): JSX.Element {
  const medplum = useMedplum();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentReconciliation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const [loadedInvoices, loadedPayments] = await Promise.all([
        medplum.searchResources('Invoice', [
          ['_count', '500'],
          ['_sort', '-date'],
        ]),
        medplum.searchResources('PaymentReconciliation', [
          ['_count', '1000'],
          ['_sort', '-_lastUpdated'],
        ]),
      ]);
      setInvoices(loadedInvoices);
      setPayments(loadedPayments);
      setLoading(false);
    };
    load().catch((error) => {
      setLoading(false);
      showErrorNotification(error);
    });
  }, [medplum]);

  const report = useMemo(() => buildFinancialReport(invoices, payments), [invoices, payments]);
  if (loading) {
    return (
      <Group justify="center" py="6rem">
        <Loader />
      </Group>
    );
  }
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Text tt="uppercase" fw={800} size="xs" c="teal.7" lts="0.14em">
            Reporting
          </Text>
          <Title order={1}>Financial performance</Title>
          <Text c="dimmed">Revenue, collections, balances, services, providers and payment methods.</Text>
        </div>
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Metric label="Invoiced revenue" value={formatInr(report.invoiced)} />
          <Metric label="Net collections" value={formatInr(report.collected)} color="teal" />
          <Metric label="Outstanding" value={formatInr(report.outstanding)} color="orange" />
          <Metric label="Collection rate" value={`${report.collectionRate.toFixed(1)}%`} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, lg: 3 }}>
          <Breakdown title="Revenue by service" rows={report.services} />
          <Breakdown title="Revenue by provider" rows={report.providers} />
          <Breakdown title="Payments by method" rows={report.methods} />
        </SimpleGrid>
      </Stack>
    </Container>
  );
}

interface BreakdownRow {
  label: string;
  value: number;
}
interface FinancialReport {
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  services: BreakdownRow[];
  providers: BreakdownRow[];
  methods: BreakdownRow[];
}

function buildFinancialReport(invoices: Invoice[], payments: PaymentReconciliation[]): FinancialReport {
  const validInvoices = invoices.filter(
    (invoice) => invoice.status !== 'cancelled' && invoice.status !== 'entered-in-error'
  );
  const invoiced = validInvoices.reduce((total, invoice) => total + (invoice.totalGross?.value ?? 0), 0);
  const collected = calculatePaidAmount(payments);
  const outstanding = validInvoices.reduce(
    (total, invoice) =>
      invoice.id
        ? total + calculateOutstanding(invoice, getInvoicePayments(payments, { ...invoice, id: invoice.id }))
        : total,
    0
  );
  const services = new Map<string, number>();
  const providers = new Map<string, number>();
  const methods = new Map<string, number>();
  for (const invoice of validInvoices) {
    for (const line of invoice.lineItem ?? []) {
      addAmount(
        services,
        line.chargeItemCodeableConcept?.text ?? 'Other service',
        line.priceComponent?.find((component) => component.type === 'base')?.amount?.value ?? 0
      );
    }
    addAmount(
      providers,
      invoice.participant?.[0]?.actor.display ?? invoice.participant?.[0]?.actor.reference ?? 'Unassigned provider',
      invoice.totalGross?.value ?? 0
    );
  }
  for (const payment of payments) {
    addAmount(
      methods,
      getPaymentMethod(payment)?.replace('-', ' ') ?? 'Unspecified',
      (getPaymentType(payment) === 'refund' ? -1 : 1) * (payment.paymentAmount.value ?? 0)
    );
  }
  return {
    invoiced,
    collected,
    outstanding,
    collectionRate: invoiced > 0 ? Math.max(0, (collected / invoiced) * 100) : 0,
    services: sortedRows(services),
    providers: sortedRows(providers),
    methods: sortedRows(methods),
  };
}

function addAmount(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}
function sortedRows(map: Map<string, number>): BreakdownRow[] {
  return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
function Metric(props: { label: string; value: string; color?: string }): JSX.Element {
  return (
    <Card withBorder radius="lg">
      <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
        {props.label}
      </Text>
      <Text fz="1.6rem" fw={900} c={props.color}>
        {props.value}
      </Text>
    </Card>
  );
}
function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }): JSX.Element {
  return (
    <Card withBorder radius="lg">
      <Title order={3} mb="md">
        {title}
      </Title>
      <Table>
        <Table.Tbody>
          {rows.slice(0, 10).map((row) => (
            <Table.Tr key={row.label}>
              <Table.Td>{row.label}</Table.Td>
              <Table.Td ta="right" fw={700}>
                {formatInr(row.value)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && <Text c="dimmed">No data.</Text>}
    </Card>
  );
}
function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
}
