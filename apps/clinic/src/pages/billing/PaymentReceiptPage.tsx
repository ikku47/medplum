// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Container, Divider, Group, Loader, Paper, Stack, Table, Text, Title } from '@mantine/core';
import type { Invoice, Patient, PaymentReconciliation } from '@medplum/fhirtypes';
import { ResourceName, useMedplum } from '@medplum/react';
import { IconPrinter } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { calculateOutstanding, getInvoicePayments, getPaymentMethod, getPaymentType } from '../../billing/financial';
import { showErrorNotification } from '../../utils/notifications';

export function PaymentReceiptPage(): JSX.Element {
  const medplum = useMedplum();
  const { paymentId } = useParams() as { paymentId: string };
  const [payment, setPayment] = useState<PaymentReconciliation & { id: string }>();
  const [invoice, setInvoice] = useState<Invoice & { id: string }>();
  const [patient, setPatient] = useState<Patient>();
  const [payments, setPayments] = useState<PaymentReconciliation[]>([]);

  useEffect(() => {
    const loadReceipt = async (): Promise<void> => {
      const loadedPayment = await medplum.readResource('PaymentReconciliation', paymentId);
      const invoiceReference = loadedPayment.detail?.[0]?.request?.reference;
      if (!invoiceReference?.startsWith('Invoice/')) {
        throw new Error('Payment is not linked to an invoice.');
      }
      const loadedInvoice = await medplum.readResource('Invoice', invoiceReference.slice('Invoice/'.length));
      const loadedPayments = await medplum.searchResources('PaymentReconciliation', [['_count', '500']]);
      setPayment(loadedPayment);
      setInvoice(loadedInvoice);
      setPayments(getInvoicePayments(loadedPayments, loadedInvoice));
      if (loadedInvoice.subject?.reference?.startsWith('Patient/')) {
        setPatient(await medplum.readResource('Patient', loadedInvoice.subject.reference.slice('Patient/'.length)));
      }
    };
    loadReceipt().catch(showErrorNotification);
  }, [medplum, paymentId]);

  if (!payment || !invoice) {
    return (
      <Group justify="center" py="6rem">
        <Loader />
      </Group>
    );
  }
  const type = getPaymentType(payment);
  return (
    <Container size="md" py="xl">
      <Stack gap="md">
        <Group justify="flex-end" className="no-print">
          <Button leftSection={<IconPrinter size={17} />} onClick={() => window.print()}>
            Print receipt
          </Button>
        </Group>
        <Paper withBorder radius="md" p="xl">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={1}>ClinicBuddy</Title>
                <Text c="dimmed">{type === 'refund' ? 'Refund receipt' : 'Payment receipt'}</Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text fw={700}>{medplum.getProject()?.name ?? 'Clinic'}</Text>
                <Text size="sm">Receipt {payment.identifier?.[0]?.value?.slice(0, 12) ?? payment.id.slice(0, 12)}</Text>
              </div>
            </Group>
            <Divider />
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">
                  Received from
                </Text>
                <Text fw={700}>
                  {patient ? <ResourceName value={patient} /> : (invoice.subject?.display ?? 'Patient')}
                </Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text size="xs" c="dimmed">
                  Date
                </Text>
                <Text fw={700}>{formatDate(payment.created)}</Text>
              </div>
            </Group>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Service</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invoice.lineItem?.map((line, index) => (
                  <Table.Tr key={line.sequence ?? index}>
                    <Table.Td>{line.chargeItemCodeableConcept?.text ?? 'Service'}</Table.Td>
                    <Table.Td ta="right">
                      {formatInr(
                        line.priceComponent?.find((component) => component.type === 'base')?.amount?.value ?? 0
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Divider />
            <Group justify="space-between">
              <Text>
                {type === 'refund' ? 'Amount refunded' : 'Amount received'} ·{' '}
                {formatPaymentMethod(getPaymentMethod(payment))}
              </Text>
              <Title order={2}>{formatInr(payment.paymentAmount.value ?? 0)}</Title>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">Invoice {invoice.identifier?.[0]?.value}</Text>
              <Text fw={700}>Remaining balance {formatInr(calculateOutstanding(invoice, payments))}</Text>
            </Group>
            <Text size="sm" c="dimmed">
              This computer-generated receipt records the financial transaction in the clinic audit trail.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}
function formatPaymentMethod(value: ReturnType<typeof getPaymentMethod>): string {
  return value ? value.replace('-', ' ') : 'Unspecified method';
}
