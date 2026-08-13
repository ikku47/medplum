// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { ChargeItemDefinition } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconEdit, IconPlus, IconReceiptRupee, IconToggleLeft, IconToggleRight } from '@tabler/icons-react';
import type { FormEvent, JSX } from 'react';
import { useEffect, useState } from 'react';
import { buildServiceDefinition, CLINICBUDDY_FINANCIAL_EXTENSION } from '../../billing/financial';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';

interface ServiceForm {
  code: string;
  title: string;
  category: string;
  price: number;
  taxRate: number;
}

const emptyForm: ServiceForm = { code: '', title: '', category: 'Consultation', price: 0, taxRate: 0 };

export function ServiceCatalogPage(): JSX.Element {
  const medplum = useMedplum();
  const [services, setServices] = useState<ChargeItemDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<ChargeItemDefinition>();
  const [form, setForm] = useState<ServiceForm>(emptyForm);

  useEffect(() => {
    let active = true;
    async function loadServices(): Promise<void> {
      try {
        const result = await medplum.searchResources('ChargeItemDefinition', { _count: '200', _sort: 'title' });
        if (active) {
          setServices(result.filter(isClinicBuddyService));
        }
      } catch (error) {
        showErrorNotification(error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadServices().catch(showErrorNotification);
    return () => {
      active = false;
    };
  }, [medplum]);

  const openNew = (): void => {
    setEditing(undefined);
    setForm(emptyForm);
    setOpened(true);
  };

  const openEdit = (service: ChargeItemDefinition): void => {
    setEditing(service);
    setForm({
      code: service.code?.coding?.[0]?.code ?? '',
      title: service.title ?? service.code?.text ?? '',
      category: getCategory(service),
      price: getPrice(service),
      taxRate: getTaxRate(service),
    });
    setOpened(true);
  };

  const saveService = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const input = buildServiceDefinition({ ...form, url: editing?.url });
      const saved = editing?.id
        ? await medplum.updateResource({ ...editing, ...input, id: editing.id })
        : await medplum.createResource(input);
      setServices((current) =>
        [...current.filter((service) => service.id !== saved.id), saved].sort((a, b) =>
          (a.title ?? '').localeCompare(b.title ?? '')
        )
      );
      setOpened(false);
      showSuccessNotification({ title: 'Service saved', message: `${saved.title} is ready for billing.` });
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleService = async (service: ChargeItemDefinition): Promise<void> => {
    if (!service.id) {
      return;
    }
    try {
      const saved = await medplum.updateResource({
        ...service,
        status: service.status === 'active' ? 'retired' : 'active',
      });
      setServices((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      showSuccessNotification({
        title: saved.status === 'active' ? 'Service activated' : 'Service retired',
        message: saved.title ?? 'Service catalog updated.',
      });
    } catch (error) {
      showErrorNotification(error);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <IconReceiptRupee size={36} color="var(--mantine-primary-color-filled)" />
            <div>
              <Title order={2}>Service catalog</Title>
              <Text c="dimmed">Clinic-specific INR prices and tax rates used to prepare patient invoices.</Text>
            </div>
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
            Add service
          </Button>
        </Group>

        <Paper withBorder radius="lg" p="md">
          {loading && (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          )}
          {!loading && services.length === 0 && (
            <Stack align="center" py="xl" gap="xs">
              <Text fw={600}>No billing services yet</Text>
              <Text c="dimmed" size="sm">
                Add consultation, procedure, imaging, laboratory, or administrative services.
              </Text>
            </Stack>
          )}
          {!loading && services.length > 0 && (
            <Table.ScrollContainer minWidth={720}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Service</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th ta="right">Price</Table.Th>
                    <Table.Th ta="right">Tax</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th ta="right">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {services.map((service) => (
                    <Table.Tr key={service.id ?? service.url}>
                      <Table.Td>{service.code?.coding?.[0]?.code}</Table.Td>
                      <Table.Td fw={600}>{service.title}</Table.Td>
                      <Table.Td>{getCategory(service)}</Table.Td>
                      <Table.Td ta="right">{formatInr(getPrice(service))}</Table.Td>
                      <Table.Td ta="right">{getTaxRate(service)}%</Table.Td>
                      <Table.Td>
                        <Badge color={service.status === 'active' ? 'teal' : 'gray'} variant="light">
                          {service.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group justify="flex-end" gap="xs">
                          <ActionIcon variant="subtle" aria-label="Edit service" onClick={() => openEdit(service)}>
                            <IconEdit size={18} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color={service.status === 'active' ? 'orange' : 'teal'}
                            aria-label={service.status === 'active' ? 'Retire service' : 'Activate service'}
                            onClick={() => toggleService(service)}
                          >
                            {service.status === 'active' ? <IconToggleRight size={20} /> : <IconToggleLeft size={20} />}
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>
      </Stack>

      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? 'Edit service' : 'Add service'}>
        <form onSubmit={saveService}>
          <Stack>
            <TextInput
              required
              label="Service code"
              placeholder="CONSULT-GP"
              value={form.code}
              disabled={Boolean(editing)}
              onChange={(event) => setForm((current) => ({ ...current, code: event.currentTarget.value }))}
            />
            <TextInput
              required
              label="Service name"
              placeholder="General consultation"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.currentTarget.value }))}
            />
            <Select
              label="Category"
              data={['Consultation', 'Procedure', 'Laboratory', 'Imaging', 'Pharmacy', 'Administrative', 'Other']}
              searchable
              allowDeselect={false}
              value={form.category}
              onChange={(value) => setForm((current) => ({ ...current, category: value ?? 'Other' }))}
            />
            <NumberInput
              required
              label="Price"
              prefix="₹ "
              min={0}
              decimalScale={2}
              value={form.price}
              onChange={(value) => setForm((current) => ({ ...current, price: Number(value) || 0 }))}
            />
            <NumberInput
              label="Tax rate"
              suffix="%"
              min={0}
              max={100}
              decimalScale={2}
              value={form.taxRate}
              onChange={(value) => setForm((current) => ({ ...current, taxRate: Number(value) || 0 }))}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save service
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}

function isClinicBuddyService(service: ChargeItemDefinition): boolean {
  return (
    service.code?.coding?.some((coding) => coding.system === 'https://clinicbuddy.health/fhir/CodeSystem/service') ??
    false
  );
}

function getPrice(service: ChargeItemDefinition): number {
  return service.propertyGroup?.[0]?.priceComponent?.find((component) => component.type === 'base')?.amount?.value ?? 0;
}

function getTaxRate(service: ChargeItemDefinition): number {
  const factor = service.propertyGroup?.[0]?.priceComponent?.find((component) => component.type === 'tax')?.factor ?? 0;
  return Number((factor * 100).toFixed(2));
}

function getCategory(service: ChargeItemDefinition): string {
  return (
    service.extension
      ?.find((extension) => extension.url === CLINICBUDDY_FINANCIAL_EXTENSION)
      ?.extension?.find((extension) => extension.url === 'category')?.valueString ?? 'Other'
  );
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}
