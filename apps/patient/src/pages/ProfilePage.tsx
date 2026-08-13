// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Card, Grid, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { ContactPoint, Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconDeviceFloppy, IconShieldCheck } from '@tabler/icons-react';
import type { FormEvent, JSX } from 'react';
import { useState } from 'react';
import { PortalPage } from '../components/PortalPage';

const ABHA_NUMBER_SYSTEM = 'https://healthid.ndhm.gov.in';

export function ProfilePage({
  patient,
  onUpdated,
}: {
  patient: Patient & { id: string };
  onUpdated: (patient: Patient & { id: string }) => void;
}): JSX.Element {
  const medplum = useMedplum();
  const name = patient.name?.[0];
  const address = patient.address?.[0];
  const [form, setForm] = useState({
    given: name?.given?.join(' ') ?? '',
    family: name?.family ?? '',
    phone: patient.telecom?.find((item) => item.system === 'phone')?.value ?? '',
    email: patient.telecom?.find((item) => item.system === 'email')?.value ?? '',
    gender: patient.gender ?? '',
    birthDate: patient.birthDate ?? '',
    address: address?.line?.[0] ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    postalCode: address?.postalCode ?? '',
  });
  const [saving, setSaving] = useState(false);
  const update = (field: keyof typeof form, value: string): void =>
    setForm((current) => ({ ...current, [field]: value }));
  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const telecom: ContactPoint[] = [];
      if (form.phone.trim()) {
        telecom.push({ system: 'phone', value: form.phone.trim(), use: 'mobile' });
      }
      if (form.email.trim()) {
        telecom.push({ system: 'email', value: form.email.trim() });
      }
      const saved = await medplum.updateResource<Patient>({
        ...patient,
        name: [
          {
            ...name,
            use: name?.use ?? 'official',
            given: form.given.trim().split(/\s+/).filter(Boolean),
            family: form.family.trim(),
          },
        ],
        telecom,
        gender: (form.gender || undefined) as Patient['gender'],
        birthDate: form.birthDate || undefined,
        address: [
          {
            ...address,
            use: 'home',
            type: 'physical',
            line: form.address.trim() ? [form.address.trim()] : undefined,
            city: form.city.trim() || undefined,
            state: form.state.trim() || undefined,
            postalCode: form.postalCode.trim() || undefined,
            country: 'IN',
          },
        ],
      });
      onUpdated(saved);
      showNotification({ color: 'teal', message: 'Profile updated.' });
    } catch (error) {
      showNotification({ color: 'red', message: error instanceof Error ? error.message : 'Profile update failed.' });
    } finally {
      setSaving(false);
    }
  };
  const abha = patient.identifier?.find((identifier) => identifier.system === ABHA_NUMBER_SYSTEM)?.value;
  return (
    <PortalPage title="Profile" description="Keep your contact and demographic details current.">
      <Card component="form" onSubmit={save} withBorder radius="lg" padding="xl">
        <Stack gap="lg">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="First name"
                required
                value={form.given}
                onChange={(event) => update('given', event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Last name"
                required
                value={form.family}
                onChange={(event) => update('family', event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Mobile number"
                value={form.phone}
                onChange={(event) => update('phone', event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Email"
                type="email"
                value={form.email}
                onChange={(event) => update('email', event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Gender"
                data={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'other', label: 'Other' },
                  { value: 'unknown', label: 'Prefer not to say' },
                ]}
                value={form.gender}
                onChange={(value) => update('gender', value ?? '')}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Date of birth"
                type="date"
                value={form.birthDate}
                onChange={(event) => update('birthDate', event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput
                label="Address"
                value={form.address}
                onChange={(event) => update('address', event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                label="City"
                value={form.city}
                onChange={(event) => update('city', event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                label="State"
                value={form.state}
                onChange={(event) => update('state', event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                label="PIN code"
                value={form.postalCode}
                onChange={(event) => update('postalCode', event.currentTarget.value)}
              />
            </Grid.Col>
          </Grid>
          <Group justify="flex-end">
            <Button type="submit" loading={saving} leftSection={<IconDeviceFloppy size={18} />}>
              Save profile
            </Button>
          </Group>
        </Stack>
      </Card>
      <Card withBorder radius="lg" padding="lg">
        <Group>
          <IconShieldCheck color="var(--mantine-color-teal-7)" />
          <div>
            <Text fw={700}>ABHA</Text>
            <Text size="sm" c="dimmed">
              {abha ? `Linked ABHA: ${abha}` : 'No ABHA has been linked to this clinic record.'}
            </Text>
          </div>
        </Group>
      </Card>
    </PortalPage>
  );
}
