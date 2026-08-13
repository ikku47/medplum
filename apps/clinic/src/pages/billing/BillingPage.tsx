// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import type { WithId } from '@medplum/core';
import { createReference } from '@medplum/core';
import type { Invoice, Patient, PaymentReconciliation, Practitioner } from '@medplum/fhirtypes';
import { ResourceInput, ResourceName, useMedplum, useMedplumProfile } from '@medplum/react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { FinancialTransactionType, InvoiceServiceLine, PaymentMethod } from '../../billing/financial';
import {
  buildInvoice,
  buildPayment,
  calculateInvoiceAmounts,
  calculateOutstanding,
  calculatePaidAmount,
  getInvoicePayments,
  reconcileInvoiceStatus,
} from '../../billing/financial';
import { showErrorNotification } from '../../utils/notifications';

type BillingFilter = 'outstanding' | 'paid' | 'all';

export function BillingPage(): JSX.Element {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const [invoices, setInvoices] = useState<WithId<Invoice>[]>([]);
  const [payments, setPayments] = useState<WithId<PaymentReconciliation>[]>([]);
  const [filter, setFilter] = useState<BillingFilter>('outstanding');
  const [loading, setLoading] = useState(true);
  const [newInvoiceOpened, setNewInvoiceOpened] = useState(false);
  const [transaction, setTransaction] = useState<{ invoice: WithId<Invoice>; type: FinancialTransactionType }>();

  const loadBilling = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [loadedInvoices, loadedPayments] = await Promise.all([
        medplum.searchResources('Invoice', [
          ['_count', '300'],
          ['_sort', '-date'],
        ]),
        medplum.searchResources('PaymentReconciliation', [
          ['_count', '500'],
          ['_sort', '-_lastUpdated'],
        ]),
      ]);
      setInvoices(loadedInvoices);
      setPayments(loadedPayments);
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- billing state follows the current tenant ledger
    loadBilling().catch(showErrorNotification);
  }, [loadBilling]);

  const visibleInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        if (filter === 'all') {
          return true;
        }
        const outstanding = calculateOutstanding(invoice, getInvoicePayments(payments, invoice));
        return filter === 'outstanding' ? outstanding > 0 : outstanding <= 0;
      }),
    [filter, invoices, payments]
  );
  const totalCollected = calculatePaidAmount(payments);
  const totalOutstanding = invoices.reduce(
    (total, invoice) => total + calculateOutstanding(invoice, getInvoicePayments(payments, invoice)),
    0
  );

  const handleInvoiceCreated = (invoice: WithId<Invoice>): void => {
    setInvoices((current) => [invoice, ...current]);
    setNewInvoiceOpened(false);
  };

  const handleTransactionSaved = (invoice: WithId<Invoice>, payment: WithId<PaymentReconciliation>): void => {
    setInvoices((current) => current.map((item) => (item.id === invoice.id ? invoice : item)));
    setPayments((current) => [payment, ...current]);
    setTransaction(undefined);
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Text tt="uppercase" fw={800} size="xs" c="teal.7" lts="0.14em">
              Financial
            </Text>
            <Title order={1}>Billing desk</Title>
            <Text c="dimmed">INR invoices, split payments, refunds, balances and receipts.</Text>
          </div>
          <Group>
            <Button component={Link} to="/billing/reports" variant="light">
              Financial reports
            </Button>
            <Button leftSection={<IconPlus size={17} />} onClick={() => setNewInvoiceOpened(true)}>
              New invoice
            </Button>
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Metric label="Invoices" value={invoices.length.toString()} />
          <Metric label="Collected" value={formatInr(totalCollected)} color="teal" />
          <Metric label="Outstanding" value={formatInr(totalOutstanding)} color="orange" />
        </SimpleGrid>
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as BillingFilter)}
          data={[
            { value: 'outstanding', label: 'Outstanding' },
            { value: 'paid', label: 'Paid' },
            { value: 'all', label: 'All' },
          ]}
        />
        {loading && invoices.length === 0 ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Stack gap="sm">
            {visibleInvoices.map((invoice) => {
              const invoicePayments = getInvoicePayments(payments, invoice);
              const paid = calculatePaidAmount(invoicePayments);
              const outstanding = calculateOutstanding(invoice, invoicePayments);
              const latestPayment = invoicePayments[0];
              return (
                <Card key={invoice.id} withBorder radius="lg" p="lg">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Text fw={900}>{getInvoiceNumber(invoice)}</Text>
                        <Badge color={outstanding > 0 ? 'orange' : 'teal'}>
                          {outstanding > 0 ? 'Outstanding' : 'Paid'}
                        </Badge>
                      </Group>
                      {invoice.subject?.reference && (
                        <Text component={Link} to={`/${invoice.subject.reference}`} fw={600}>
                          {invoice.subject.display || <ResourceName value={invoice.subject} />}
                        </Text>
                      )}
                      <Text size="sm" c="dimmed">
                        {invoice.date ? formatDate(invoice.date) : 'No invoice date'} · {invoice.lineItem?.length ?? 0}{' '}
                        services
                      </Text>
                      <Group gap="lg" mt="xs">
                        <Text size="sm">
                          Total <b>{formatInr(invoice.totalGross?.value ?? 0)}</b>
                        </Text>
                        <Text size="sm">
                          Paid <b>{formatInr(paid)}</b>
                        </Text>
                        <Text size="sm">
                          Balance <b>{formatInr(outstanding)}</b>
                        </Text>
                      </Group>
                    </Stack>
                    <Group gap="xs">
                      {latestPayment?.id && (
                        <Button component={Link} to={`/billing/receipt/${latestPayment.id}`} variant="subtle" size="xs">
                          Receipt
                        </Button>
                      )}
                      {paid > 0 && (
                        <Button
                          variant="light"
                          color="red"
                          size="xs"
                          onClick={() => setTransaction({ invoice, type: 'refund' })}
                        >
                          Refund
                        </Button>
                      )}
                      {outstanding > 0 && (
                        <Button size="xs" onClick={() => setTransaction({ invoice, type: 'payment' })}>
                          Record payment
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Card>
              );
            })}
            {visibleInvoices.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                No invoices in this view.
              </Text>
            )}
          </Stack>
        )}
      </Stack>
      <NewInvoiceModal
        opened={newInvoiceOpened}
        onClose={() => setNewInvoiceOpened(false)}
        onCreated={handleInvoiceCreated}
      />
      {transaction && (
        <PaymentModal
          opened
          invoice={transaction.invoice}
          existingPayments={getInvoicePayments(payments, transaction.invoice)}
          type={transaction.type}
          collector={profile?.resourceType === 'Practitioner' ? profile : undefined}
          onClose={() => setTransaction(undefined)}
          onSaved={handleTransactionSaved}
        />
      )}
    </Container>
  );
}

function NewInvoiceModal(props: {
  opened: boolean;
  onClose: () => void;
  onCreated: (invoice: WithId<Invoice>) => void;
}): JSX.Element {
  const medplum = useMedplum();
  const [patient, setPatient] = useState<Patient>();
  const [lines, setLines] = useState<InvoiceServiceLine[]>([
    { description: 'Consultation', quantity: 1, unitPrice: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [saving, setSaving] = useState(false);
  const amounts = calculateInvoiceAmounts(lines, discount, taxRate);

  const updateLine = (index: number, patch: Partial<InvoiceServiceLine>): void => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  };

  const save = async (): Promise<void> => {
    if (!patient?.id) {
      showErrorNotification('Select a patient.');
      return;
    }
    setSaving(true);
    try {
      props.onCreated(
        await medplum.createResource(buildInvoice({ patient: createReference(patient), lines, discount, taxRate }))
      );
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={props.opened} onClose={props.onClose} title="New self-pay invoice" size="lg">
      <Stack gap="md">
        <ResourceInput<Patient> resourceType="Patient" name="patient" label="Patient" required onChange={setPatient} />
        <Divider label="Services" />
        {lines.map((line, index) => (
          <Group key={index} align="flex-end" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              label="Description"
              value={line.description}
              onChange={(event) => updateLine(index, { description: event.currentTarget.value })}
            />
            <NumberInput
              w={90}
              label="Qty"
              min={1}
              value={line.quantity}
              onChange={(value) => updateLine(index, { quantity: Number(value) })}
            />
            <NumberInput
              w={150}
              label="Unit price (INR)"
              min={0}
              decimalScale={2}
              value={line.unitPrice}
              onChange={(value) => updateLine(index, { unitPrice: Number(value) })}
            />
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label="Remove service"
              disabled={lines.length === 1}
              onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="light"
          size="xs"
          onClick={() => setLines((current) => [...current, { description: '', quantity: 1, unitPrice: 0 }])}
        >
          Add service
        </Button>
        <Group grow>
          <NumberInput
            label="Discount (INR)"
            min={0}
            value={discount}
            onChange={(value) => setDiscount(Number(value))}
          />
          <NumberInput label="Tax rate (%)" min={0} value={taxRate} onChange={(value) => setTaxRate(Number(value))} />
        </Group>
        <Card withBorder>
          <Group justify="space-between">
            <Text>
              Subtotal {formatInr(amounts.subtotal)} · Discount {formatInr(amounts.discount)} · Tax{' '}
              {formatInr(amounts.tax)}
            </Text>
            <Text fw={900}>Total {formatInr(amounts.total)}</Text>
          </Group>
        </Card>
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => save()}>
            Issue invoice
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function PaymentModal(props: {
  opened: boolean;
  invoice: WithId<Invoice>;
  existingPayments: PaymentReconciliation[];
  type: FinancialTransactionType;
  collector?: Practitioner;
  onClose: () => void;
  onSaved: (invoice: WithId<Invoice>, payment: WithId<PaymentReconciliation>) => void;
}): JSX.Element {
  const medplum = useMedplum();
  const outstanding = calculateOutstanding(props.invoice, props.existingPayments);
  const paid = calculatePaidAmount(props.existingPayments);
  const [amount, setAmount] = useState(props.type === 'payment' ? outstanding : paid);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    if (props.type === 'payment' && amount > outstanding + 0.009) {
      showErrorNotification('Payment cannot exceed the outstanding balance.');
      return;
    }
    if (props.type === 'refund' && amount > paid + 0.009) {
      showErrorNotification('Refund cannot exceed the amount paid.');
      return;
    }
    setSaving(true);
    try {
      const payment = buildPayment({
        invoice: props.invoice,
        input: { amount, method, type: props.type, reference, note },
        collector: props.collector?.id ? { reference: `Practitioner/${props.collector.id}` } : undefined,
      });
      const savedPayment = await medplum.createResource(payment);
      const updatedInvoice = await medplum.updateResource(
        reconcileInvoiceStatus(props.invoice, [...props.existingPayments, savedPayment])
      );
      props.onSaved(updatedInvoice, savedPayment);
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={props.type === 'refund' ? 'Record refund' : 'Record payment'}
    >
      <Stack gap="md">
        <Text>
          Invoice {getInvoiceNumber(props.invoice)} ·{' '}
          {props.type === 'payment' ? `Outstanding ${formatInr(outstanding)}` : `Paid ${formatInr(paid)}`}
        </Text>
        <NumberInput
          label="Amount (INR)"
          min={0.01}
          decimalScale={2}
          value={amount}
          onChange={(value) => setAmount(Number(value))}
        />
        <Select
          label="Payment method"
          value={method}
          onChange={(value) => value && setMethod(value as PaymentMethod)}
          data={[
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
            { value: 'bank-transfer', label: 'Bank transfer' },
            { value: 'online', label: 'Online payment' },
          ]}
        />
        <TextInput
          label="Transaction reference"
          value={reference}
          onChange={(event) => setReference(event.currentTarget.value)}
        />
        <Textarea label="Note" value={note} onChange={(event) => setNote(event.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>
            Cancel
          </Button>
          <Button color={props.type === 'refund' ? 'red' : 'teal'} loading={saving} onClick={() => save()}>
            {props.type === 'refund' ? 'Record refund' : 'Record payment'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function Metric(props: { label: string; value: string; color?: string }): JSX.Element {
  return (
    <Card withBorder radius="lg">
      <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
        {props.label}
      </Text>
      <Text fz="1.7rem" fw={900} c={props.color}>
        {props.value}
      </Text>
    </Card>
  );
}
function getInvoiceNumber(invoice: Invoice): string {
  return invoice.identifier?.[0]?.value ?? `Invoice ${invoice.id?.slice(0, 8) ?? ''}`;
}
function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
