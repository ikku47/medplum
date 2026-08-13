// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Container, Grid, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import type { Location, Organization } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconBuildingHospital, IconDeviceFloppy } from '@tabler/icons-react';
import type { FormEvent, JSX } from 'react';
import { useEffect, useState } from 'react';
import {
  buildClinicFacility,
  buildClinicOrganization,
  CLINICBUDDY_TENANT_IDENTIFIER_SYSTEM,
} from '../../tenancy/resources';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';

interface SetupForm {
  organizationName: string;
  facilityName: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
}

const emptyForm: SetupForm = {
  organizationName: '',
  facilityName: '',
  phone: '',
  email: '',
  addressLine: '',
  city: '',
  state: '',
  postalCode: '',
};

export function OrganizationSetupPage(): JSX.Element {
  const medplum = useMedplum();
  const project = medplum.getProject();
  const [organization, setOrganization] = useState<Organization>();
  const [facility, setFacility] = useState<Location>();
  const [form, setForm] = useState<SetupForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        if (!project?.id) {
          throw new Error('No active ClinicBuddy tenant project was found.');
        }
        const loadedOrganization = await medplum.searchOne('Organization', {
          identifier: `${CLINICBUDDY_TENANT_IDENTIFIER_SYSTEM}|${project.id}`,
        });
        const loadedFacility = loadedOrganization?.id
          ? await medplum.searchOne('Location', { organization: `Organization/${loadedOrganization.id}` })
          : undefined;

        if (active) {
          setOrganization(loadedOrganization);
          setFacility(loadedFacility);
          setForm({
            organizationName: loadedOrganization?.name ?? project.name ?? '',
            facilityName: loadedFacility?.name ?? '',
            phone:
              loadedFacility?.telecom?.find((contact) => contact.system === 'phone')?.value ??
              loadedOrganization?.telecom?.find((contact) => contact.system === 'phone')?.value ??
              '',
            email: loadedOrganization?.telecom?.find((contact) => contact.system === 'email')?.value ?? '',
            addressLine: loadedFacility?.address?.line?.[0] ?? '',
            city: loadedFacility?.address?.city ?? '',
            state: loadedFacility?.address?.state ?? '',
            postalCode: loadedFacility?.address?.postalCode ?? '',
          });
        }
      } catch (error) {
        showErrorNotification(error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load().catch(showErrorNotification);
    return () => {
      active = false;
    };
  }, [medplum, project?.id, project?.name]);

  const updateField = (field: keyof SetupForm, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!project) {
      showErrorNotification(new Error('No active ClinicBuddy tenant project was found.'));
      return;
    }

    setSaving(true);
    try {
      const organizationInput = buildClinicOrganization(
        project,
        { name: form.organizationName, phone: form.phone, email: form.email },
        organization
      );
      const savedOrganization = organizationInput.id
        ? await medplum.updateResource(organizationInput)
        : await medplum.createResource(organizationInput);
      const facilityInput = buildClinicFacility(
        project,
        savedOrganization,
        {
          name: form.facilityName,
          phone: form.phone,
          addressLine: form.addressLine,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
        },
        facility
      );
      const savedFacility = facilityInput.id
        ? await medplum.updateResource(facilityInput)
        : await medplum.createResource(facilityInput);

      setOrganization(savedOrganization);
      setFacility(savedFacility);
      showSuccessNotification({
        title: 'Clinic configured',
        message: 'Your organization and primary India facility are ready.',
      });
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Group gap="md">
          <IconBuildingHospital size={36} color="var(--mantine-primary-color-filled)" />
          <div>
            <Title order={2}>Organization & facility</Title>
            <Text c="dimmed">Configure the legal clinic organization and its primary India care location.</Text>
          </div>
        </Group>
        <Paper component="form" onSubmit={handleSubmit} withBorder radius="lg" p="xl">
          <Stack gap="lg">
            <Title order={4}>Organization</Title>
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Organization name"
                  required
                  disabled={loading}
                  value={form.organizationName}
                  onChange={(event) => updateField('organizationName', event.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Primary facility name"
                  required
                  disabled={loading}
                  value={form.facilityName}
                  onChange={(event) => updateField('facilityName', event.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Phone"
                  placeholder="+91"
                  disabled={loading}
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Administrative email"
                  type="email"
                  disabled={loading}
                  value={form.email}
                  onChange={(event) => updateField('email', event.currentTarget.value)}
                />
              </Grid.Col>
            </Grid>
            <Title order={4} mt="sm">
              Facility address
            </Title>
            <TextInput
              label="Address"
              disabled={loading}
              value={form.addressLine}
              onChange={(event) => updateField('addressLine', event.currentTarget.value)}
            />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="City"
                  disabled={loading}
                  value={form.city}
                  onChange={(event) => updateField('city', event.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="State"
                  disabled={loading}
                  value={form.state}
                  onChange={(event) => updateField('state', event.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="PIN code"
                  inputMode="numeric"
                  disabled={loading}
                  value={form.postalCode}
                  onChange={(event) => updateField('postalCode', event.currentTarget.value)}
                />
              </Grid.Col>
            </Grid>
            <Group justify="flex-end">
              <Button type="submit" loading={saving} disabled={loading} leftSection={<IconDeviceFloppy size={18} />}>
                Save clinic setup
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
