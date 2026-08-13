// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-nested-ternary */
import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { Invoice, Patient } from '@medplum/fhirtypes';
import { IconCreditCard, IconInfoCircle, IconReceiptRupee } from '@tabler/icons-react';
import type { JSX } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PortalPage } from '../components/PortalPage';
import { usePortalSearch } from '../hooks';
import { formatInr, formatPortalDate, getInvoiceNumber, getInvoiceOutstanding } from '../lib/portal';

export function BillingPage({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const invoices = usePortalSearch<Invoice>('Invoice', `subject=Patient/${patient.id}&_sort=-date&_count=100`);
  const outstanding = invoices.data.reduce((sum, invoice) => sum + getInvoiceOutstanding(invoice), 0);
  return (
    <PortalPage title="Billing & payments" description="Review clinic invoices, balances, and payment status.">
      {invoices.loading ? (
        <LoadingState />
      ) : invoices.error ? (
        <ErrorState error={invoices.error} />
      ) : (
        <Stack gap="lg">
          <Card className="balance-card" radius="xl" padding="xl">
            <Group justify="space-between">
              <div>
                <Text c="dimmed" fw={650}>
                  Total outstanding
                </Text>
                <Title order={2} mt={4}>
                  {formatInr(outstanding)}
                </Title>
              </div>
              <ThemeIcon color="orange" variant="light" radius="xl" size={48}>
                <IconCreditCard size={24} />
              </ThemeIcon>
            </Group>
            {outstanding > 0 && (
              <Alert mt="lg" variant="light" color="orange" icon={<IconInfoCircle size={18} />}>
                Online payment checkout requires the clinic's payment gateway to be activated. You can currently pay at
                reception by cash, card, bank transfer, or online reference.
              </Alert>
            )}
          </Card>
          {invoices.data.length === 0 ? (
            <EmptyState title="No invoices" message="Your clinic invoices will appear here." />
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {invoices.data.map((invoice) => (
                <Card key={invoice.id} withBorder radius="lg" padding="lg">
                  <Group justify="space-between">
                    <ThemeIcon color="teal" variant="light" radius="xl">
                      <IconReceiptRupee size={19} />
                    </ThemeIcon>
                    <Badge
                      color={invoice.status === 'balanced' ? 'teal' : invoice.status === 'issued' ? 'orange' : 'gray'}
                      variant="light"
                    >
                      {invoice.status}
                    </Badge>
                  </Group>
                  <Text fw={750} size="lg" mt="lg">
                    {getInvoiceNumber(invoice)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatPortalDate(invoice.date)}
                  </Text>
                  <Group justify="space-between" mt="lg">
                    <Text c="dimmed">Total</Text>
                    <Text fw={800}>{formatInr(invoice.totalGross?.value ?? invoice.totalNet?.value)}</Text>
                  </Group>
                  <Group justify="space-between" mt={4}>
                    <Text c="dimmed">Outstanding</Text>
                    <Text fw={800} c={getInvoiceOutstanding(invoice) > 0 ? 'orange.8' : 'teal.8'}>
                      {formatInr(getInvoiceOutstanding(invoice))}
                    </Text>
                  </Group>
                  {getInvoiceOutstanding(invoice) > 0 && (
                    <Button mt="lg" fullWidth disabled leftSection={<IconCreditCard size={17} />}>
                      Pay online
                    </Button>
                  )}
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      )}
    </PortalPage>
  );
}
